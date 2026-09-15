import type { ApiError, components } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, type WriteHeaders } from '../../patterns/master';
import { ApiRequestError, runRequest, toApiError } from '../../patterns/request';
import { toReplaceBody, type LayoutDraft } from './layout-draft';
import { layoutKeys, layoutPath, useDrawingUpload } from './queries';
import type { LayoutView } from './types';

/**
 * 도면 교체 한 흐름 — **올리기와 저장을 잇는다.**
 *
 * ⭐ **첨부를 올리는 것만으로는 도면이 바뀌지 않는다.** 이 창고의 도면이 되는 것은 배치도
 * 저장이 그 첨부 id 를 실은 뒤다(계약 · `POST /app/attachments` → `PUT …/layout`). 두 호출
 * 사이에서 멈추면 **올라갔지만 아무 데도 붙지 않은 첨부**가 남으므로, 그 사이 상태
 * (`pendingAttachmentId`)를 화면이 볼 수 있게 들고 있다가 **다시 올리지 않고 저장만** 다시
 * 시도할 수 있게 한다.
 *
 * ⭐ **단계는 하나의 값이다**(`phase`). 버튼과 가림막이 같은 값을 읽어야 「올리는 중」과
 * 「저장하는 중」이 서로 어긋나지 않는다.
 *
 * ⛔ **부품(`useMasterWrite`) 둘을 잇는 것으로는 이 흐름을 만들 수 없다.** 저장의 409 를 잡아
 * 배치도를 다시 읽고 **조건이 맞을 때만** 한 번 더 보내야 하는데, 부품에는 실패 처리기가 없고
 * `write()` 도 약속을 돌려주지 않아 「실패했을 때 무엇을 더 한다」를 표현할 자리가 없다.
 * 그래서 **올리기만 부품에 맡기고**(멱등 키·필드 오류 분해가 그대로 필요하다) **저장은 여기서
 * 직접 보낸다.** 그 대신 멱등 키 수명과 `If-Match` 규율은 부품과 같은 모양으로 지킨다.
 */

type WarehouseLayout = components['schemas']['WarehouseLayout'];
type WarehouseLayoutReplace = components['schemas']['WarehouseLayoutReplace'];
type Attachment = components['schemas']['Attachment'];

/** `idle → uploading → saving → idle`. 화면의 버튼·가림막·판 잠금이 모두 이 값을 읽는다. */
export type DrawingReplacePhase = 'idle' | 'uploading' | 'saving';

/** 실패가 어느 단계에서 났는가 — 올리기 실패와 저장 실패는 **할 수 있는 조치가 다르다.** */
export type DrawingReplaceStep = 'upload' | 'save';

/**
 * 배치도를 서버에서 다시 읽는다. 화면의 `useLayout(...).refetch` 가 그대로 들어맞는다.
 *
 * ⭐ **결과를 돌려받아야 한다** — 409 뒤에 「도면이 그사이 바뀌었는가」를 그 값으로 판정한다.
 *
 * ⛔ **`data` 만으로는 판정할 수 없다.** react-query 의 `refetch` 는 **실패해도 직전 데이터를
 * 그대로 돌려준다** — 그 값을 성공으로 읽으면 옛 도면 id 가 「바뀌지 않았다」로 통과해, 이미
 * 낡은 잠금 토큰으로 두 번째 저장이 나간다. 그래서 `isSuccess` 를 함께 받아 **이번 조회가
 * 실제로 성공했을 때만** 값을 믿는다(`QueryObserverResult` 와 구조가 맞는다).
 */
export type RefetchLayout = () => Promise<{
  data?: LayoutView | undefined;
  isSuccess: boolean;
}>;

export interface DrawingReplaceOptions {
  warehouseId: number | null;
  /** 화면이 지금 보고 있는 도면 첨부. 409 때 **「그사이 도면이 바뀌었는가」의 기준**이 된다. */
  currentDrawingAttachmentId: number | null;
  refetchLayout: RefetchLayout;
  /** 도면이 실제로 바뀐 뒤 — 화면이 안내를 띄운다. */
  onReplaced?: () => void;
}

export interface DrawingReplaceResult {
  phase: DrawingReplacePhase;
  /** 올리기·저장 중 하나라도 도는 중인가. `phase !== 'idle'` 과 같은 사실을 짧게 읽는 자리다. */
  isBusy: boolean;
  /** **올라갔지만 아직 어느 배치도에도 붙지 않은 첨부.** 없으면 `null`. */
  pendingAttachmentId: number | null;
  /** 배너로 낼 오류. 올리기의 입력칸 오류(`fileError`)는 여기 오지 않는다. */
  error: ApiError | null;
  errorStep: DrawingReplaceStep | null;
  /** 올리기 자리에 낼 문구(400 `field: file`). 파일을 다시 고르면 풀린다. */
  fileError: string | null;
  /**
   * **파일 자리의 서버 오류만 지운다.**
   *
   * ⛔ 화면이 새 파일을 고르는 **그 순간** 부른다 — 요청까지 가지 않는 파일(사전 검사에 걸린
   * 것·확인 창에서 취소한 것)은 `start` 를 부르지 않으므로, 지우지 않으면 **직전 파일의 서버
   * 문구가 새 파일의 사유와 나란히 두 줄로 남는다.** 사용자는 둘 중 어느 것이 방금 고른 파일의
   * 이야기인지 알 수 없다.
   */
  clearFileError: () => void;
  start: (file: File) => void;
  /** **올리기 없이 저장만** 다시 보낸다. `pendingAttachmentId` 가 있을 때만 뜻이 있다. */
  retrySave: () => void;
  /** 창고가 바뀔 때 화면이 부른다 — 남은 첨부·오류·멱등 키를 버린다. */
  reset: () => void;
}

/** 저장 한 번이 들고 가는 것 — **시작할 때의 값**이다. 늦게 온 응답도 자기 시도의 값을 본다. */
interface SaveInput {
  warehouseId: number;
  attachmentId: number;
  /** 시작 시점에 보고 있던 도면. 409 뒤 이 값이 그대로면 아무도 도면을 건드리지 않은 것이다. */
  baselineDrawingId: number | null;
}

/**
 * 서버가 준 배치를 들고 있지 않아 **저장을 시작조차 못 한** 상태.
 *
 * 부품의 「잠금 토큰 없음」과 같은 안내다 — 사용자가 할 일은 다시 불러오는 것 하나다.
 */
const reloadNeeded = (): ApiError => ({
  kind: 'validation',
  errors: [{ scope: 'screen', code: 'STALE_TOKEN', message: messages.save.staleToken }],
});

export const useDrawingReplace = (options: DrawingReplaceOptions): DrawingReplaceResult => {
  const { client, etags } = useApiClient();
  const queryClient = useQueryClient();

  const [pendingAttachmentId, setPendingAttachmentId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  /**
   * 지금 올리는 중인 파일 — 성공 응답이 올 때 **그 첨부의 그림 자리에 그대로 심는다.**
   *
   * 참조에 두는 것은 처리기가 «올리기를 시작한 렌더»에 매여 있어 값으로는 받을 수 없기
   * 때문이다. 한 번에 한 흐름만 돌므로 덮어써도 뒤섞이지 않는다.
   */
  const pickedFile = useRef<File | null>(null);

  /**
   * 저장의 멱등 키 — 수명은 **`until-applied`** 다(`use-master-write` 의 표와 같은 판단).
   * 빠진 점이 지워지는 되돌릴 수 없는 쓰기라, 통신이 끊긴 뒤 다시 보낼 때 같은 저장이 두 번
   * 적용되지 않도록 키를 붙들어 둔다.
   *
   * | 사태 | 키 |
   * | --- | --- |
   * | 보낼 값이 바뀜(재조회한 새 점) | **새 키** — 다른 쓰기다 |
   * | 통신 실패 · 5xx · 409 | **유지** — 적용됐는지 모르거나 실행 전 거부다 |
   * | 성공 | **버린다** — 끝난 키로 다시 보내면 서버가 실행 없이 앞 응답을 되돌려 준다 |
   */
  const savedKey = useRef<{ signature: string; key: string } | null>(null);

  const idempotencyKeyFor = (body: WarehouseLayoutReplace): string => {
    /* 본문은 수와 고정된 키뿐이라 그대로 직렬화해도 같은 값이면 같은 지문이다. */
    const signature = JSON.stringify(body);

    if (savedKey.current === null || savedKey.current.signature !== signature) {
      savedKey.current = { signature, key: createIdempotencyKey() };
    }

    return savedKey.current.key;
  };

  /**
   * 저장에 실을 점 — **서버가 준 것 그대로**다. 도면만 바꾸는 저장이라 화면의 편집 중인 점을
   * 섞지 않는다(화면은 편집이 남아 있으면 올리기 자체를 막는다).
   *
   * ⛔ **들고 있지 않으면 보내지 않는다.** 빈 배열로 메우면 이 저장이 「점을 전부 지우라」는
   * 뜻이 된다 — 도면을 갈려다 배치를 통째로 잃는다.
   */
  const serverMarkers = (warehouseId: number): LayoutDraft => {
    const layout = queryClient.getQueryData<LayoutView>(layoutKeys.layout(warehouseId));

    if (layout === undefined) throw new ApiRequestError(reloadNeeded());

    return layout.markers;
  };

  const putLayout = (input: SaveInput, markers: LayoutDraft): Promise<WarehouseLayout> => {
    const body = toReplaceBody(markers, input.attachmentId);
    const headers: WriteHeaders = { 'Idempotency-Key': idempotencyKeyFor(body) };
    /* ⭐ 잠금 토큰은 **가장 마지막 배치도 응답**의 것이다 — 재조회가 보관소를 갱신해 둔다. */
    const ifMatch = etags.ifMatch(layoutPath(input.warehouseId));

    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;

    return runRequest(() =>
      client.PUT('/mdm/warehouses/{warehouseId}/layout', {
        params: {
          path: { warehouseId: input.warehouseId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            /* 토큰이 없으면 보내지 않고 멈춘다 — 빈 If-Match 는 계약 위반이다. */
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    );
  };

  const save = useMutation({
    mutationFn: async (input: SaveInput): Promise<WarehouseLayout> => {
      try {
        return await putLayout(input, serverMarkers(input.warehouseId));
      } catch (cause) {
        if (toApiError(cause).kind !== 'conflict') throw cause;

        /*
         * ⭐ **409 는 「내가 본 배치 위에 적는다」가 깨졌다는 뜻이다.** 다시 읽어 **도면이
         * 그대로면** 남이 옮긴 것은 점뿐인데, 이 저장이 싣는 점은 **방금 서버가 준 최신값**이라
         * 그 변경을 덮지 않는다 — 그래서 새 점·새 토큰으로 **딱 한 번** 다시 보낸다.
         *
         * ⛔ **도면까지 달라졌으면 멈춘다.** 그 저장은 남이 방금 올린 도면을 덮는다 — 사람이
         * 보고 정할 일이다.
         *
         * ⚠ 재조회 자체가 실패하면 보관소의 토큰도 그대로라 다시 보내도 같은 409 다. 그래서
         * **옛 값으로는 보내지 않는다** — `refetch` 는 실패해도 직전 데이터를 돌려주므로
         * **`isSuccess` 로 이번 조회의 성패를 본다.** 들고 온 것이 없으면 충돌 그대로 멈춘다.
         */
        const refetched = await options.refetchLayout();
        const fresh = refetched.data;

        if (
          !refetched.isSuccess ||
          fresh === undefined ||
          fresh.drawingAttachmentId !== input.baselineDrawingId
        ) {
          throw cause;
        }

        /*
         * ⛔ **새 키로 보낸다.** 409 는 **실행 전 거부**가 확실하므로 앞 키를 붙들 이유가 없는데,
         * 재조회한 점이 앞 시도와 같으면 지문도 같아 **같은 키가 다시 나간다** — 그러면 서버가
         * 이 시도를 앞 요청의 중복으로 보고 **앞선 409 를 그대로 되돌려 준다.** 자동 재시도가
         * 무엇을 해도 실패하는 자리가 된다.
         */
        savedKey.current = null;

        /* 여기서 또 409 면 그대로 올라간다 — 재시도는 한 번뿐이다. */
        return await putLayout(input, fresh.markers);
      }
    },
    onSuccess: () => {
      savedKey.current = null;
      pickedFile.current = null;
      setPendingAttachmentId(null);
      setSaveError(null);

      /*
       * ⛔ **방금 심어 둔 그림은 되받지 않는다** — 첨부 내용은 불변이라 다시 물을 이유가 없고,
       * 도면은 수 MB 다. 배치도·위치만 다시 읽는다.
       */
      void queryClient.invalidateQueries({
        queryKey: layoutKeys.all,
        predicate: (query) => query.queryKey[1] !== 'drawing',
      });
      options.onReplaced?.();
    },
    onError: (cause) => {
      /* ⭐ **`pendingAttachmentId` 를 지우지 않는다** — 올라간 첨부는 그대로 있고 저장만 남았다. */
      setSaveError(toApiError(cause));
    },
  });

  const startSave = (warehouseId: number, attachmentId: number): void => {
    save.mutate({
      warehouseId,
      attachmentId,
      baselineDrawingId: options.currentDrawingAttachmentId,
    });
  };

  const upload = useDrawingUpload(options.warehouseId, (attachment: Attachment) => {
    /*
     * ⚠ 이 처리기는 **올리기를 시작한 렌더**의 것이다(부품이 그 렌더의 처리기를 함께 실어
     * 보낸다) — 그래서 여기서 읽는 창고·도면 id 가 곧 「시작 시점의 값」이다.
     */
    const warehouseId = options.warehouseId;

    if (warehouseId === null) return;

    /*
     * ⭐ **방금 올린 그림을 다시 받지 않는다** — 고른 파일이 곧 그 첨부의 내용이다. 저장이
     * 끝나 화면이 새 id 를 보게 될 때 이 자리에 이미 그림이 들어 있다.
     */
    if (pickedFile.current !== null) {
      queryClient.setQueryData(layoutKeys.drawing(attachment.attachmentId), pickedFile.current);
    }

    setPendingAttachmentId(attachment.attachmentId);
    startSave(warehouseId, attachment.attachmentId);
  });

  /**
   * ⭐ **저장을 먼저 본다.** 부품은 올리기 성공을 «처리기를 부른 뒤에» 기록하므로, 그 한 렌더
   * 동안 둘 다 참이 된다 — 저장을 앞세우면 그 사이가 「올리는 중」으로 되돌아가지 않는다.
   * 어느 쪽이든 실패하면 도는 것이 없으니 `idle` 이다.
   */
  const phase: DrawingReplacePhase = save.isPending
    ? 'saving'
    : upload.isSaving
      ? 'uploading'
      : 'idle';
  const isBusy = phase !== 'idle';
  const fileError = upload.fieldErrors.file ?? null;

  /**
   * 화면이 부르는 자리들. **매 렌더 새로 만들어진다** — 의존성 배열에 넣지 말고 이벤트
   * 처리기(창고가 바뀔 때의 효과 포함)에서 부른다.
   */
  const clearFileError = (): void => {
    upload.clearFieldError('file');
  };

  const start = (file: File): void => {
    const warehouseId = options.warehouseId;

    /* 창고가 없으면 붙일 대상이 없다 — 화면이 여기까지 오게 두지 않지만 값을 지어내지 않는다. */
    if (warehouseId === null || isBusy) return;

    setSaveError(null);
    setPendingAttachmentId(null);
    pickedFile.current = file;
    /* 부품이 제 오류를 지우고 **시도마다 새 멱등 키**로 보낸다. */
    upload.write({ file });
  };

  const retrySave = (): void => {
    const warehouseId = options.warehouseId;

    if (warehouseId === null || pendingAttachmentId === null || isBusy) return;

    setSaveError(null);
    startSave(warehouseId, pendingAttachmentId);
  };

  const reset = (): void => {
    setPendingAttachmentId(null);
    setSaveError(null);
    pickedFile.current = null;
    /*
     * ⛔ **남은 멱등 키를 버린다.** 창고가 바뀌면 그 키로 다시 보낼 일이 없는데, 붙들고 있으면
     * 다음 저장이 앞 쓰기의 중복으로 **흡수된다.**
     */
    savedKey.current = null;
    upload.reset();
    save.reset();
  };

  return {
    phase,
    isBusy,
    pendingAttachmentId,
    error: saveError ?? upload.error,
    errorStep:
      saveError !== null ? 'save' : upload.error !== null || fileError !== null ? 'upload' : null,
    fileError,
    clearFileError,
    start,
    retrySave,
    reset,
  };
};

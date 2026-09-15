import type { components, paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { LayoutView, LocationView } from './types';
import { toLayoutView, toLocationView } from './types';

/**
 * 이 화면의 오퍼레이션 — 배치도 하나, 위치 목록 하나, 배치도 저장 하나, 도면 첨부 둘.
 *
 * ⭐ **잠금 토큰은 배치도 조회가 준 것이다.** 바꾸는 자원이 스스로 판 번호를 갖고, 빠진 점이
 * 지워지는 저장이라 「내가 본 배치 위에 적는다」가 반드시 참이어야 한다.
 *
 * ⭐ **도면은 첨부 경로 둘로 다룬다**(#1064 · 서버 `v0.1.11`). 파일은 `POST /app/attachments` 에
 * 대상 유형 `WAREHOUSE` 로 올리고, 그림은 `GET /app/attachments/{id}/content` 로 받는다.
 * ⛔ **올리기만으로는 도면이 바뀌지 않는다** — 첨부는 그저 올라가 있을 뿐이고, 이 창고의 도면이
 * 되는 것은 **배치도 저장이 그 첨부 id 를 실은 뒤**다. 그래서 둘을 잇는 것은 교체 흐름
 * (`use-drawing-replace`)이 맡고, 이 파일은 호출 하나씩만 소유한다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type WarehouseLayout = components['schemas']['WarehouseLayout'];
type WarehouseLayoutReplace = components['schemas']['WarehouseLayoutReplace'];
type Attachment = components['schemas']['Attachment'];
/** 첨부 올리기 본문 — 계약이 `multipart/form-data` 로 정의한 그 모양. */
type AttachmentUpload =
  paths['/app/attachments']['post']['requestBody']['content']['multipart/form-data'];

export const LOCATION_PAGE_SIZE = 200;

export const layoutKeys = {
  all: ['warehouse-layout'] as const,
  layout: (warehouseId: number | null) => ['warehouse-layout', 'layout', warehouseId ?? 0] as const,
  locations: (warehouseId: number | null, includeInactive: boolean) =>
    ['warehouse-layout', 'locations', warehouseId ?? 0, includeInactive] as const,
  /** ⭐ **창고가 아니라 첨부로 잡는다** — 같은 그림을 두 창고가 가리켜도 한 벌만 받는다. */
  drawing: (attachmentId: number | null) => ['warehouse-layout', 'drawing', attachmentId] as const,
};

/** 배치도 경로 — **저장의 잠금 토큰이 여기 보관된다.** */
export const layoutPath = (warehouseId: number): string =>
  `/mdm/warehouses/${String(warehouseId)}/layout`;

export const useLayout = (warehouseId: number | null): UseQueryResult<LayoutView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: layoutKeys.layout(warehouseId),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) throw new Error('창고를 고르기 전에는 배치도를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/warehouses/{warehouseId}/layout', {
          params: { path: { warehouseId } },
        }),
      ).then(toLayoutView);
    },
  });
};

/**
 * 이 창고의 위치들.
 *
 * ⭐ **한 쪽에 다 담는다.** 창고 하나의 위치는 목록이자 지도의 범례라, 쪽을 나누면 2쪽의
 * 위치를 도면에서 고를 수 없다.
 */
export const useLocations = (
  warehouseId: number | null,
  includeInactive: boolean,
): UseQueryResult<LocationView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: layoutKeys.locations(warehouseId, includeInactive),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) throw new Error('창고를 고르기 전에는 위치를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/locations', {
          params: {
            query: {
              warehouseId,
              ...(includeInactive ? { includeInactive: true } : {}),
              page: 1,
              size: LOCATION_PAGE_SIZE,
            },
          },
        }),
      ).then((data) => data.items.map(toLocationView));
    },
  });
};

/**
 * 도면 그림 한 장.
 *
 * ⭐ **`<img src>` 에 주소를 걸지 않고 계약 클라이언트로 받는다.** 내려받기도 세션 쿠키를
 * 요구하는데, 화면과 API 의 출처가 다르면(개발 프록시 없이 띄운 경우·POP) 브라우저가
 * `SameSite=Lax` 쿠키를 **이미지 요청에는 싣지 않는다** — 목록·배치도는 멀쩡한데 그림만 비고,
 * 그 어긋남은 화면에서 「깨진 이미지」로만 보인다. 클라이언트에는 `credentials: 'include'` 와
 * 기준 URL·프록시가 이미 붙어 있으니 같은 길로 받는다.
 *
 * ⭐ **첨부 내용은 불변이다** — 첨부 id 가 곧 그 파일이라 한 번 받으면 다시 물을 이유가 없다
 * (`staleTime: Infinity`). 그래서 방금 올린 파일을 이 자리에 그대로 심어 둘 수 있다.
 * 보관 기간(`gcTime`)은 기본값이다 — 화면을 떠나면 수 MB 를 오래 들고 있을 이유가 없다.
 *
 * ⚠ 실패 응답은 `parseAs` 와 무관하게 JSON 으로 읽힌다(계약 클라이언트) — 404 도 여느 오류와
 * 같은 모양으로 화면에 온다.
 */
export const useDrawingContent = (attachmentId: number | null): UseQueryResult<Blob> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: layoutKeys.drawing(attachmentId),
    enabled: attachmentId !== null,
    staleTime: Infinity,
    queryFn: () => {
      if (attachmentId === null) throw new Error('도면이 없으면 그림을 받지 않습니다.');

      return runRequest(() =>
        client.GET('/app/attachments/{attachmentId}/content', {
          params: { path: { attachmentId } },
          /* 그림이라 본문을 그대로 받는다 — JSON 으로 읽으면 첫 바이트에서 깨진다. */
          parseAs: 'blob',
        }),
      );
    },
  });
};

/** 올리기 입력 — 파일 하나. 붙일 대상은 훅이 받은 창고다. */
export interface DrawingUploadInput {
  file: File;
}

/**
 * 올리기 본문.
 *
 * ⚠ **생성된 타입이 `file: string` 이다** — openapi-typescript 가 `format: binary` 를 문자열로
 * 옮기기 때문이고, 실제로 보내야 하는 것은 `File` 이다. 계약이 틀린 것이 아니라 **옮기는
 * 도구의 한계**라 형 단언이 필요하고, 그 단언을 **여기 한 곳에 가둔다**(툴 마스터의 엑셀
 * 올리기와 같은 자리 · `screens/tool-master/screen.tsx`).
 *
 * `FormData` 를 그대로 넘긴다 — 계약 클라이언트가 이것만은 직렬화하지 않고 `Content-Type` 도
 * 붙이지 않는다. 경계 문자열은 브라우저가 정해야 한다.
 *
 * ⛔ **대상 유형을 화면이 고르게 두지 않는다** — 창고 도면은 `WAREHOUSE` 하나뿐이고, 값이
 * 어긋나면 첨부가 **엉뚱한 대상에 붙는다.**
 */
const toUploadBody = (warehouseId: number, file: File): AttachmentUpload => {
  const form = new FormData();

  form.append('targetTypeCode', 'WAREHOUSE');
  form.append('targetId', String(warehouseId));
  form.append('file', file);

  return form as unknown as AttachmentUpload;
};

/**
 * 도면 파일을 첨부로 올린다 — **교체의 첫 단계**다.
 *
 * ⛔ **여기서 배치도를 무효화하지 않는다.** 올리기가 끝난 시점의 배치도는 아직 옛 도면을
 * 가리킨다 — 다시 읽어 봐야 같은 값이고, 도면이 바뀌는 것은 저장이 끝난 뒤다. 무효화는 교체
 * 훅이 저장에 성공하고 한 번만 한다.
 *
 * ⛔ **멱등 키 수명을 `until-applied` 로 두면 안 된다.** 부품이 보낼 값의 지문을
 * `JSON.stringify` 로 만드는데 **`File` 은 그것으로 `{}` 가 된다** — 다른 파일을 골라도 같은
 * 지문이라 같은 키가 나가고, 서버는 「같은 키에 다른 파일」로 보아 409 로 막는다(서버
 * `v0.1.11` 사실). 기본값(`per-attempt`)이 맞다. 툴 마스터의 엑셀 올리기와 같은 판단이다.
 */
export const useDrawingUpload = (
  warehouseId: number | null,
  onUploaded: (attachment: Attachment) => void,
): MasterWriteResult<DrawingUploadInput> => {
  const { client } = useApiClient();

  return useMasterWrite<DrawingUploadInput, Attachment>({
    request: ({ file }, headers) =>
      client.POST('/app/attachments', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        /* 창고를 고르기 전에는 부르는 쪽이 올리기를 시작하지 않는다 — 여기 0은 닿지 않는다. */
        body: toUploadBody(warehouseId ?? 0, file),
      }),
    /* 올리기에는 낙관적 잠금이 없다 — 새로 만드는 첨부라 덮어쓸 앞판이 없다. */
    etagPath: null,
    invalidateKeys: [],
    /* 400 `field: file` 은 **올리기 자리**에 낸다 — 배너로 올리면 무엇을 다시 고를지가 멀어진다. */
    knownFields: ['file'],
    onSuccess: onUploaded,
  });
};

/**
 * 배치도 저장 — **도면과 점을 통째로 바꾼다.**
 *
 * ⭐ 멱등 키 수명이 `until-applied` 다. 빠진 점이 지워지고 화면이 되살릴 수 없는 쓰기라,
 * 통신이 끊긴 뒤 다시 눌렀을 때 같은 저장이 두 번 적용되지 않도록 키를 붙들어 둔다.
 */
export const useLayoutReplace = (
  warehouseId: number | null,
  onSuccess: () => void,
): MasterWriteResult<WarehouseLayoutReplace> => {
  const { client } = useApiClient();

  return useMasterWrite<WarehouseLayoutReplace, WarehouseLayout>({
    request: (body, headers) =>
      client.PUT('/mdm/warehouses/{warehouseId}/layout', {
        params: {
          path: { warehouseId: warehouseId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: warehouseId === null ? null : layoutPath(warehouseId),
    /*
     * ⛔ **도면 그림까지 무효화하지 않는다.** `layoutKeys.all` 은 앞자리가 같아 그림 캐시
     * (`drawing`)까지 묶는데, **첨부 내용은 불변**이라 점만 고친 저장 뒤에 그림을 다시 받는 것은
     * 수 MB 를 이유 없이 버리는 일이다. 이 저장이 바꾸는 것은 이 창고의 배치 하나다.
     */
    invalidateKeys: [layoutKeys.layout(warehouseId)],
    /*
     * ⛔ **대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다**(툴 마스터의 엑셀 올리기와
     * 같은 판단 · `screens/tool-master/screen.tsx`). 이 저장이 보내는 `markers` 는 판 위의 점이고
     * `drawingAttachmentId` 는 화면이 싣기만 하는 값이라, 둘 다 「그 칸 옆에 적을」 자리가
     * 없다. 이름만 알아보고 인라인으로 분류하면 **배너에서 빠진 채 어디에도 보이지 않는다.**
     */
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

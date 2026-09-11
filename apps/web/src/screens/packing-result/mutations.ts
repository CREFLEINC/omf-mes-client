import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { ApiRequestError, runRequestWithResponse, runRequest } from '../../patterns/request';

import { withOccurrence, type HandlingUnitPackDraft } from './occurrence';
import { packingResultKeys } from './queries';
import type { PackedLine } from './types';

/**
 * 포장 쓰기 — **세 번이고, 첫 번째는 «담는 동안» 일어난다.**
 *
 * ```
 * ① POST /inventory/handling-units                       빈 취급 단위를 만든다(01 계약)
 * ② POST /inventory/handling-units/{id}:pack             내용물과 함께 닫는다(01 계약)
 * ③ PUT  /logistics/shipment-lot-allocations/{id}        배분에 포장을 잇는다(04 계약) — 담긴 줄마다
 * ```
 *
 * ⭐ **①을 확정까지 미루지 않는다.** 계약이 「빈 포장 단위를 만들고 :pack 이 내용물과 함께
 * 닫는다 — **두 왕복인 것은 스캔이 여러 번 일어나기 때문이다**」라고 적었고, 스펙 §3 의 ③ 구획이
 * 담는 동안 **포장 번호를 보여 준다.** 번호는 서버가 매기므로 먼저 만들지 않으면 그 자리가 빈다.
 *
 * ⚠ **먼저 만든 포장은 화면이 되돌리지 못한다** — 포장 해체는 이 화면에 두지 않기로 한 조작이다
 * (§5-6). 담다가 그만두면 빈 포장이 남는다.
 *
 * ⭐ 취급 단위는 01 자재창고가, 배분과 포장의 연결은 04 제품출하가 소유한다 — 한 계약에
 * 몰아넣을 수 없다.
 *
 * ⛔ **앞 단계가 실패하면 뒤를 부르지 않는다.** 절반만 진행된 상태를 만들지 않기 위해서이고,
 * 그 실패는 그대로 화면에 올라간다. ⚠ 이미 만들어진 취급 단위를 화면이 되돌리지 않는다 —
 * 포장 해체는 이 화면에 두지 않기로 한 조작이다(스펙 §5-6).
 *
 * ⭐ **`If-Match` 는 ① 응답의 `ETag` 다.** 잠그는 단위가 취급 단위 자신이고(공유계약 B-1),
 * 그 토큰은 방금 만든 자원의 것이라 경로별 보관소를 거치지 않고 손에서 손으로 넘긴다.
 *
 * ⭐ **멱등 키는 단계마다 «따로»이면서 재전송에는 «그대로»다.** 세 요청이 서로 다른 쓰기이므로
 * 같은 키를 쓰면 서버가 뒤엣것을 재시도로 본다. 반대로 매번 새 키를 만들면 통신이 끊긴 뒤 다시
 * 누른 것이 **새 쓰기로 읽혀 같은 포장이 두 벌 생긴다** — 되돌릴 조작이 이 화면에 없으므로
 * (§5-6 포장 해체 없음) 그 중복은 지워지지 않는다. 그래서 키의 수명은 `until-applied` 다:
 * 담은 것이 그대로면 앞 시도의 키를 다시 쓰고, 달라지면 새 키를 준다.
 *
 * ⭐ **발생 시각도 함께 얼린다.** 키만 같고 본문이 다르면 서버가 재시도로 묶어 줄 근거가 없다 —
 * 재전송은 **처음 누른 순간**을 그대로 다시 보낸다.
 *
 * ⚠ **사번 헤더는 인증이 아니라 귀속이다**(공유계약 D-5 · 통지 #563). 없으면 서버가 거부하므로
 * 부르는 쪽이 값을 확보한 뒤에만 확정을 연다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/** ① 취급 단위를 만들 때 서버에 보내는 값. 이것이 같으면 «같은 쓰기»다. */
export interface CreateHandlingUnitBody {
  handlingUnitTypeCode: string;
  parentHandlingUnitId: number | null;
  /** 배분 응답의 `warehouseId` 를 그대로 보낸다(`omf-mes#330` D). ⛔ 비우지 않는다. */
  warehouseId: number;
}

/** ① 취급 단위를 만들 때 필요한 것. */
export interface CreateHandlingUnitInput extends CreateHandlingUnitBody {
  workerNo: string;
  /** 이 생성의 멱등 키. **부르는 쪽이 쥐고 있다** — 재전송이면 앞의 것을 그대로 넘긴다. */
  idempotencyKey: string;
}

/** 살아 있는 멱등 키와 그것이 매인 값의 지문. */
export interface KeptKey {
  signature: string;
  key: string;
}

/**
 * 같은 값이면 같은 지문 — 칸 이름을 붙여 잇는다.
 *
 * ⛔ **객체를 그대로 직렬화하지 않는다.** 칸 순서가 다르면 같은 쓰기가 다른 지문이 되어,
 * 재전송에 새 키가 나가고 이중 실행을 막지 못한다.
 */
const signatureOf = (parts: readonly (string | number | null)[]): string =>
  parts.map((part) => String(part)).join('|');

/**
 * ① 생성의 키 — **보낼 값이 그대로면 앞 키를 다시 쓴다.**
 *
 * 되돌릴 수 없는 쓰기다. 담기 시작이 실패한 뒤 사용자가 줄을 하나 더 읽어 다시 시도할 때
 * 새 키가 나가면, 앞의 요청이 서버에 닿아 있었을 경우 **내용물 0 인 포장이 한 벌 남는다.**
 */
export const keptCreateKey = (previous: KeptKey | null, body: CreateHandlingUnitBody): KeptKey => {
  const signature = signatureOf([
    body.handlingUnitTypeCode,
    body.parentHandlingUnitId,
    body.warehouseId,
  ]);

  return previous !== null && previous.signature === signature
    ? previous
    : { signature, key: crypto.randomUUID() };
};

/** 만들어진 포장 — **번호를 화면이 보이고, 토큰은 확정이 쓴다.** */
export interface OpenHandlingUnit {
  handlingUnitId: number;
  handlingUnitNo: string;
  /** ① 응답의 `ETag`. 확정의 `If-Match` 가 된다(공유계약 B-1). */
  etag: string | null;
}

/** 확정이 무엇을 쓰는가 — 이것이 같으면 «같은 쓰기»다. */
export interface PackingTarget {
  handlingUnit: OpenHandlingUnit;
  lines: readonly PackedLine[];
}

/** 확정 한 «시도». 재전송이면 앞의 것을 그대로 다시 쓴다. */
export interface PackingAttempt {
  signature: string;
  /** 확정을 **처음** 누른 순간. 재전송에도 이 값이 나간다. */
  now: Date;
  /** ② 포장 확정의 키. */
  packKey: string;
  /** ③ 배분 연결의 키 — 배분마다 «따로»다. 서로 다른 쓰기이기 때문이다. */
  linkKeys: Readonly<Record<number, string>>;
}

export interface ConfirmPackingInput extends PackingTarget {
  workerNo: string;
  attempt: PackingAttempt;
}

/**
 * 확정의 키와 발생 시각 — **담은 것이 그대로면 앞 시도를 다시 쓴다.**
 *
 * ⚠ 줄이 하나 늘거나 수량이 바뀌면 다른 쓰기다 — 새 시도를 준다. 그때 시각도 다시 찍힌다.
 */
export const keptPackingAttempt = (
  previous: PackingAttempt | null,
  target: PackingTarget,
  now: Date,
): PackingAttempt => {
  const signature = signatureOf([
    target.handlingUnit.handlingUnitId,
    ...target.lines.flatMap((line) => [line.shipmentLotAllocationId, line.lotId, line.qty]),
  ]);

  if (previous !== null && previous.signature === signature) return previous;

  return {
    signature,
    now,
    packKey: crypto.randomUUID(),
    linkKeys: Object.fromEntries(
      target.lines.map((line) => [line.shipmentLotAllocationId, crypto.randomUUID()]),
    ),
  };
};

export const createHandlingUnit = async (
  client: Client,
  input: CreateHandlingUnitInput,
): Promise<OpenHandlingUnit> => {
  const { data, response } = await runRequestWithResponse(() =>
    client.POST('/inventory/handling-units', {
      params: {
        header: { 'Idempotency-Key': input.idempotencyKey, 'X-Worker-No': input.workerNo },
      },
      body: {
        handlingUnitTypeCode: input.handlingUnitTypeCode,
        ...(input.parentHandlingUnitId === null
          ? {}
          : { parentHandlingUnitId: input.parentHandlingUnitId }),
        warehouseId: input.warehouseId,
      },
    }),
  );

  return {
    handlingUnitId: data.handlingUnit.handlingUnitId,
    handlingUnitNo: data.handlingUnit.handlingUnitNo,
    etag: response.headers.get('ETag'),
  };
};

const packHandlingUnit = async (client: Client, input: ConfirmPackingInput): Promise<void> => {
  const draft: HandlingUnitPackDraft = {
    contents: input.lines.map((line) => ({
      itemId: line.itemId,
      lotId: line.lotId,
      qty: line.qty,
      uomId: line.uomId,
    })),
  };

  await runRequest(() =>
    client.POST('/inventory/handling-units/{handlingUnitId}:pack', {
      params: {
        path: { handlingUnitId: input.handlingUnit.handlingUnitId },
        header: {
          'Idempotency-Key': input.attempt.packKey,
          'X-Worker-No': input.workerNo,
          /* 계약이 선택으로 두었다 — 만들 때 받은 토큰이라 없을 수 없으나, 없으면 그냥 보낸다. */
          ...(input.handlingUnit.etag === null ? {} : { 'If-Match': input.handlingUnit.etag }),
        },
      },
      body: withOccurrence(draft, input.attempt.now),
    }),
  );
};

const linkAllocations = async (client: Client, input: ConfirmPackingInput): Promise<void> => {
  /*
   * ⛔ **한 줄씩 «순서대로» 잇는다.** 동시에 보내면 하나가 409(이미 다른 포장이 붙어 있다)로
   * 막혔을 때 나머지가 이미 나가 버려, 어디까지 이어졌는지 화면이 말할 수 없게 된다.
   */
  for (const line of input.lines) {
    const key = input.attempt.linkKeys[line.shipmentLotAllocationId];

    /* 빈 키는 계약 위반이라 서버가 400 으로 되돌린다 — 짝이 어긋났으면 보내지 않고 멈춘다. */
    if (key === undefined) throw new Error('이 줄의 멱등 키가 없습니다.');

    await runRequest(() =>
      client.PUT('/logistics/shipment-lot-allocations/{shipmentLotAllocationId}', {
        params: {
          path: { shipmentLotAllocationId: line.shipmentLotAllocationId },
          header: {
            'Idempotency-Key': key,
            'X-Worker-No': input.workerNo,
          },
        },
        body: { handlingUnitId: input.handlingUnit.handlingUnitId },
      }),
    );
  }
};

export const confirmPacking = async (
  client: Client,
  input: ConfirmPackingInput,
): Promise<OpenHandlingUnit> => {
  await packHandlingUnit(client, input);
  await linkAllocations(client, input);

  return input.handlingUnit;
};

/** 화면이 넘기는 값 — **멱등 키는 넘기지 않는다.** 훅이 쥐고 재전송에 다시 쓴다. */
export type CreateHandlingUnitVariables = Omit<CreateHandlingUnitInput, 'idempotencyKey'>;

/** ① 취급 단위 생성 — 담기 시작에 한 번. 번호가 ③ 구획에 선다. */
export const useHandlingUnitCreate = (): UseMutationResult<
  OpenHandlingUnit,
  Error,
  CreateHandlingUnitVariables
> => {
  const { client } = useApiClient();

  /*
   * 살아 있는 키. **성공하면 버린다**(`until-applied`) — 그 뒤의 생성은 다른 포장이다.
   * ⛔ 상태로 두지 않는다. 키가 바뀐다고 화면을 다시 그릴 일이 없다.
   */
  const kept = useRef<KeptKey | null>(null);

  return useMutation({
    mutationFn: (variables) => {
      kept.current = keptCreateKey(kept.current, variables);

      return createHandlingUnit(client, { ...variables, idempotencyKey: kept.current.key });
    },
    onSuccess: () => {
      kept.current = null;
    },
  });
};

export interface CancelHandlingUnitInput {
  handlingUnitId: number;
  workerNo: string;
}

/**
 * ⛔⛔ **`DELETE /inventory/handling-units/{handlingUnitId}` 는 서버에 경로 자체가 없다**
 * (생성 타입 `paths['/inventory/handling-units/{handlingUnitId}']['delete']` 가 `never` ·
 * 2026-09-11 전달본 — 이 자리는 `get` 만 있다). 이 경로는 **설계 공지 3(2026-09-08)** 이
 * 더한 것이라 이번 임시 서버 기준선(설계 공지 2 · `a6a87e14`)에는 없다 — 서버 저장소의
 * 계약 사본(`contracts/COMMIT.txt`)도 아직 `a6a87e14` 라 서버는 공지 3을 모른다.
 *
 * ⭐ **사용자 결정 — 「준비 중」으로 닫고 서버팀에 보고한다.** 코드는 지우지 않는다. 서버가
 * 공지 3을 구현하면 아래 `useHandlingUnitCancel` 의 `mutationFn` 을 원래의
 * `client.DELETE(...)` 호출로 되돌리면 된다.
 *
 * ⛔ **요청을 만들었다가 거부당한 척하지 않는다.** 실제로 보냈다가 실패한 것처럼 다루면
 * 사용자가 「다시 시도」를 반복하게 된다 — `ApiRequestError` 를 곧바로 던져
 * `patterns/request.ts` 가 이미 갖고 있는 「정규화된 실패는 연결 문제로 덮지 않는다」는
 * 약속(`runRequestWithResponse` 머리말) 위에 얹는다. 이 화면은 이 실패를 저장 실패나
 * 네트워크 오류가 아니라 **아직 지원하지 않는 기능**으로 보여야 한다.
 */
export const HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE =
  '빈 포장 취소는 서버가 아직 지원하지 않습니다. 포장은 그대로 남아 있고, 서버팀에 보고했습니다.';

const handlingUnitCancelNotReadyError = (): ApiError => ({
  kind: 'validation',
  errors: [
    {
      scope: 'screen',
      code: 'HANDLING_UNIT_CANCEL_NOT_READY',
      message: HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE,
    },
  ],
});

/**
 * 확정 전 빈 포장 취소.
 *
 * ⛔ **지금은 항상 거부된다** — 위 머리말 참고. 네트워크 요청을 만들지 않고 곧바로 거부한다.
 */
export const useHandlingUnitCancel = (): UseMutationResult<void, Error, CancelHandlingUnitInput> =>
  useMutation({
    mutationFn: (_input: CancelHandlingUnitInput): Promise<void> =>
      Promise.reject(new ApiRequestError(handlingUnitCancelNotReadyError())),
  });

export interface PackingWriteOptions {
  shipmentId: number | null;
  onSuccess: (handlingUnit: OpenHandlingUnit) => void;
}

/** 화면이 넘기는 값 — **키도 발생 시각도 넘기지 않는다.** 훅이 쥐고 재전송에 다시 쓴다. */
export type ConfirmPackingVariables = Omit<ConfirmPackingInput, 'attempt'>;

export const usePackingConfirm = ({
  shipmentId,
  onSuccess,
}: PackingWriteOptions): UseMutationResult<OpenHandlingUnit, Error, ConfirmPackingVariables> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  /* 살아 있는 시도. **확정이 서버에 닿으면 버린다** — 그 뒤의 확정은 다음 포장의 것이다. */
  const attempt = useRef<PackingAttempt | null>(null);

  return useMutation({
    mutationFn: (variables: ConfirmPackingVariables) => {
      attempt.current = keptPackingAttempt(attempt.current, variables, new Date());

      return confirmPacking(client, { ...variables, attempt: attempt.current });
    },
    onSuccess: (handlingUnit) => {
      attempt.current = null;
      /* 확정하면 이 출하의 잔여·포장 수가 바뀐다 — 다시 읽어야 ④ 진행이 방금 담은 것을 반영한다. */
      if (shipmentId !== null) {
        void queryClient.invalidateQueries({ queryKey: packingResultKeys.progress(shipmentId) });
      }
      /* 방금 만든 포장이 다음 포장의 «상위 후보»가 된다 — 창고별 목록을 통째로 무르게 한다. */
      void queryClient.invalidateQueries({ queryKey: packingResultKeys.parentsRoot });
      onSuccess(handlingUnit);
    },
  });
};

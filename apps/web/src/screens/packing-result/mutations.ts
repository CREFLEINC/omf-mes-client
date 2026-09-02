import type { ApiClient } from '@omf-mes/api-client';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequestWithResponse, runRequest } from '../../patterns/request';

import { withOccurrence, type HandlingUnitPackDraft } from './occurrence';
import { packingResultKeys } from './queries';
import type { HandlingUnit, PackedLine } from './types';

/**
 * 포장 확정 — **세 번의 쓰기가 한 조작이다.**
 *
 * ```
 * ① POST /inventory/handling-units                       빈 취급 단위를 만든다(01 계약)
 * ② POST /inventory/handling-units/{id}:pack             내용물과 함께 닫는다(01 계약)
 * ③ PUT  /logistics/shipment-lot-allocations/{id}        배분에 포장을 잇는다(04 계약) — 담긴 줄마다
 * ```
 *
 * ⭐ **두 왕복인 것은 스캔이 여러 번 일어나기 때문이다**(계약 주석). 취급 단위는 01 자재창고가,
 * 배분과 포장의 연결은 04 제품출하가 소유한다 — 한 계약에 몰아넣을 수 없다.
 *
 * ⛔ **앞 단계가 실패하면 뒤를 부르지 않는다.** 절반만 진행된 상태를 만들지 않기 위해서이고,
 * 그 실패는 그대로 화면에 올라간다. ⚠ 이미 만들어진 취급 단위를 화면이 되돌리지 않는다 —
 * 포장 해체는 이 화면에 두지 않기로 한 조작이다(스펙 §5-6).
 *
 * ⭐ **`If-Match` 는 ① 응답의 `ETag` 다.** 잠그는 단위가 취급 단위 자신이고(공유계약 B-1),
 * 그 토큰은 방금 만든 자원의 것이라 경로별 보관소를 거치지 않고 손에서 손으로 넘긴다.
 *
 * ⭐ **멱등 키는 단계마다 «따로»다.** 세 요청이 서로 다른 쓰기이므로 같은 키를 쓰면 서버가
 * 두 번째를 재시도로 본다. 통신이 끊긴 뒤 다시 누르면 같은 포장이 두 벌 생기는 것은 막지
 * 못하나, 그것은 이 화면의 재시도 규약이 아니라 계약의 몫이다.
 *
 * ⚠ **사번 헤더는 인증이 아니라 귀속이다**(공유계약 D-5 · 통지 #563). 없으면 서버가 거부하므로
 * 부르는 쪽이 값을 확보한 뒤에만 확정을 연다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

export interface ConfirmPackingInput {
  handlingUnitTypeCode: string;
  parentHandlingUnitId: number | null;
  /** 배분 응답의 `warehouseId` 를 그대로 보낸다(`omf-mes#330` D). ⛔ 비우지 않는다. */
  warehouseId: number;
  lines: readonly PackedLine[];
  workerNo: string;
  /** 확정을 누른 순간. 시험이 시각을 고정할 수 있도록 부르는 쪽이 넘긴다. */
  now: Date;
}

const newIdempotencyKey = (): string => crypto.randomUUID();

const createHandlingUnit = async (
  client: Client,
  input: ConfirmPackingInput,
): Promise<{ handlingUnit: HandlingUnit; etag: string | null }> => {
  const { data, response } = await runRequestWithResponse(() =>
    client.POST('/inventory/handling-units', {
      params: {
        header: { 'Idempotency-Key': newIdempotencyKey(), 'X-Worker-No': input.workerNo },
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

  return { handlingUnit: data.handlingUnit, etag: response.headers.get('ETag') };
};

const packHandlingUnit = async (
  client: Client,
  input: ConfirmPackingInput,
  handlingUnitId: number,
  etag: string | null,
): Promise<void> => {
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
        path: { handlingUnitId },
        header: {
          'Idempotency-Key': newIdempotencyKey(),
          'X-Worker-No': input.workerNo,
          /* 계약이 선택으로 두었다 — 방금 만든 자원이라 토큰이 없을 수 없으나, 없으면 그냥 보낸다. */
          ...(etag === null ? {} : { 'If-Match': etag }),
        },
      },
      body: withOccurrence(draft, input.now),
    }),
  );
};

const linkAllocations = async (
  client: Client,
  input: ConfirmPackingInput,
  handlingUnitId: number,
): Promise<void> => {
  /*
   * ⛔ **한 줄씩 «순서대로» 잇는다.** 동시에 보내면 하나가 409(이미 다른 포장이 붙어 있다)로
   * 막혔을 때 나머지가 이미 나가 버려, 어디까지 이어졌는지 화면이 말할 수 없게 된다.
   */
  for (const line of input.lines) {
    await runRequest(() =>
      client.PUT('/logistics/shipment-lot-allocations/{shipmentLotAllocationId}', {
        params: {
          path: { shipmentLotAllocationId: line.shipmentLotAllocationId },
          header: { 'Idempotency-Key': newIdempotencyKey(), 'X-Worker-No': input.workerNo },
        },
        body: { handlingUnitId },
      }),
    );
  }
};

export const confirmPacking = async (
  client: Client,
  input: ConfirmPackingInput,
): Promise<HandlingUnit> => {
  const { handlingUnit, etag } = await createHandlingUnit(client, input);

  await packHandlingUnit(client, input, handlingUnit.handlingUnitId, etag);
  await linkAllocations(client, input, handlingUnit.handlingUnitId);

  return handlingUnit;
};

export interface PackingWriteOptions {
  shipmentId: number | null;
  onSuccess: (handlingUnit: HandlingUnit) => void;
}

export const usePackingConfirm = ({
  shipmentId,
  onSuccess,
}: PackingWriteOptions): UseMutationResult<HandlingUnit, Error, ConfirmPackingInput> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConfirmPackingInput) => confirmPacking(client, input),
    onSuccess: (handlingUnit) => {
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

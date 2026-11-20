import type { components } from '@omf-mes/api-client';
import { useMutation } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * M-04-05 LOT 분리 확인의 서버 호출(피처 013 · contracts §2 · §3).
 *
 * | 무엇 | 경로 |
 * | --- | --- |
 * | 첫 스캔 — 그 LOT 의 분리 | `GET /logistics/product-lot-splits?lotNo=` (많아야 한 건: 확인 대기 → 최근 확인됨) |
 * | 둘째 스캔 — 확인 | `POST /logistics/product-lot-splits/{id}:confirm` |
 *
 * ⛔ 큐에 담지 않는다 — 확인은 곧 피킹을 여는 일이라 서버에 바로 기록되어야 한다(온라인 전용).
 */
export type ProductLotSplit = components['schemas']['ProductLotSplit'];

/** 첫 스캔 — 조회지만 스캔마다 «다시» 읽는다(다른 PDA 가 그사이 확인했을 수 있다). */
export const useFindSplit = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: async (lotNo: string): Promise<ProductLotSplit | null> => {
      const data = await runRequest(() =>
        client.GET('/logistics/product-lot-splits', { params: { query: { lotNo } } }),
      );

      return data.items[0] ?? null;
    },
  });
};

export interface ConfirmVariables {
  split: ProductLotSplit;
  lotIds: [number, number];
  workerNo: string;
  idempotencyKey: string;
}

/** 두 라벨이 짝이면 확인한다. 같은 키로 다시 보내면 두 번 기록되지 않는다. */
export const useConfirmSplit = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: ({ split, lotIds, workerNo, idempotencyKey }: ConfirmVariables) =>
      runRequest(() =>
        client.POST('/logistics/product-lot-splits/{productLotSplitId}:confirm', {
          params: {
            path: { productLotSplitId: split.productLotSplitId },
            header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
          },
          body: { lotIds },
        }),
      ),
  });
};

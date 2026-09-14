import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { isFillable, type InboundReceipt, type InboundReceiptLine } from './lot';

const PAGE_SIZE = 200;

type LineClient = ReturnType<typeof useApiClient>['client'];

const linesKey = (inboundReceiptId: number) => ['material-lot-lines', inboundReceiptId] as const;

const fetchFillableLines = async (
  client: LineClient,
  inboundReceiptId: number,
): Promise<InboundReceiptLine[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts/{inboundReceiptId}/lines', {
      params: { path: { inboundReceiptId }, query: { supplierLotMissing: false } },
    }),
  );

  return data.items.filter(isFillable);
};

/**
 * 사전부착 라인을 가진 입하 건.
 *
 * 헤더 목록인데 판정은 라인 단위다 - 한 건에 사전부착과 미부착이 섞여 있을 수 있어, 라인을
 * 고를 때 같은 이름의 필터를 다시 건다.
 */
export const useSupplierLotReceipts = (): UseQueryResult<InboundReceipt[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['material-lot-receipts'] as const,
    /*
     * 공유계약 C-6 - 판정에 쓰는 값은 캐시하지 않는다. 다른 단말이 방금 채운 라인을 낡은
     * 목록으로 보이면 같은 라인에 LOT 을 또 만들어 서버에서 되돌아온다.
     */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/inbound-receipts', {
          params: { query: { supplierLotMissing: false, size: PAGE_SIZE } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * LOT 이 비어 있는 사전부착 라인.
 *
 * 대상 판정을 화면이 흉내 내지 않는다 - 계약이 `lotId` 를 응답에 실어 주므로 그 값이 빈
 * 라인만 남긴다.
 */
export const useFillableLines = (
  inboundReceiptId: number | null,
): UseQueryResult<InboundReceiptLine[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: linesKey(inboundReceiptId ?? 0),
    enabled: inboundReceiptId !== null,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (inboundReceiptId === null) {
        throw new Error('입하 건을 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchFillableLines(client, inboundReceiptId);
    },
  });
};

export interface FillableLineIds {
  /** 건별로 채울 수 있는 라인 식별자. 아직 답하지 않은 건은 없다. */
  byReceipt: Map<number, number[]>;
  /** 하나라도 아직 답하지 않았는가. 다 받기 전에 거르면 목록이 섰다가 줄어든다. */
  isPending: boolean;
}

/**
 * 건마다 채울 라인이 남았는지.
 *
 * 계약의 입하 건 목록에는 채울 라인이 남았는지로 거르는 축이 없다. `supplierLotMissing`
 * 은 사전부착 라인을 가졌는지만 보므로, 그 라인이 이미 다 채워진 건도 그대로 온다 - 실측
 * 2026-09-14 에 29건 중 27건이 고를 수 없는 건이었고 작업자가 그 29개를 훑어야 했다.
 *
 * 라인 조회와 같은 열쇠를 쓴다. 건을 고르는 순간 이미 받아 둔 것이 있어 다시 부르지 않는다.
 */
export const useFillableLineIds = (receiptIds: readonly number[]): FillableLineIds => {
  const { client } = useApiClient();
  const ids = [...new Set(receiptIds)];

  return useQueries({
    queries: ids.map((inboundReceiptId) => ({
      queryKey: linesKey(inboundReceiptId),
      staleTime: 0,
      gcTime: 0,
      queryFn: () => fetchFillableLines(client, inboundReceiptId),
    })),
    combine: (results) => ({
      byReceipt: new Map(
        results.flatMap((result, index) => {
          const inboundReceiptId = ids[index];

          return result.data === undefined || inboundReceiptId === undefined
            ? []
            : [[inboundReceiptId, result.data.map((line) => line.inboundReceiptLineId)] as const];
        }),
      ),
      isPending: results.some((result) => result.isPending),
    }),
  });
};

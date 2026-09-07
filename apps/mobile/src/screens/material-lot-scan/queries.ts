import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { isFillable, type InboundReceipt, type InboundReceiptLine } from './lot';

const PAGE_SIZE = 200;

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
    queryKey: ['material-lot-lines', inboundReceiptId] as const,
    enabled: inboundReceiptId !== null,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (inboundReceiptId === null) {
        throw new Error('입하 건을 고르기 전에는 라인을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/inbound-receipts/{inboundReceiptId}/lines', {
          params: { path: { inboundReceiptId }, query: { supplierLotMissing: false } },
        }),
      );

      return data.items.filter(isFillable);
    },
  });
};

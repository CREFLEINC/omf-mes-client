import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InboundReceipt, InboundReceiptLine, InboundVariance } from './variance';

/**
 * 공통코드 그룹 코드.
 *
 * 값 목록은 서버가 내려준다. 채번 식별자를 하드코딩하지 않는다 - 환경마다 다르다.
 */
export const INBOUND_VARIANCE_TYPE = 'INBOUND_VARIANCE_TYPE';
export const INBOUND_VARIANCE_REASON = 'INBOUND_VARIANCE_REASON';

export const varianceKeys = {
  receipts: (query: string) => ['variance-receipts', query] as const,
  lines: (inboundReceiptId: number | null) => ['variance-lines', inboundReceiptId] as const,
  known: (lineId: number | null) => ['variance-known', lineId] as const,
};

/**
 * 오류를 적을 입하.
 *
 * 상태 코드로 거르지 않는다 - 값 목록이 확정 전이라 지어내 실으면 값이 달라지는 날 목록이
 * 조용히 빈다. 기간으로도 거르지 않는다 - 계약이 요구하지 않고, 창을 지어내면 그 밖의 입하가
 * 없는 것처럼 보인다.
 */
export const useInboundReceipts = (query: string): UseQueryResult<InboundReceipt[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: varianceKeys.receipts(query),
    queryFn: async () => {
      const trimmed = query.trim();
      const data = await runRequest(() =>
        client.GET('/logistics/inbound-receipts', {
          params: { query: trimmed === '' ? { size: 50 } : { q: trimmed, size: 50 } },
        }),
      );

      return data.items;
    },
  });
};

export const useReceiptLines = (
  inboundReceiptId: number | null,
): UseQueryResult<InboundReceiptLine[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: varianceKeys.lines(inboundReceiptId),
    enabled: inboundReceiptId !== null,
    queryFn: async () => {
      if (inboundReceiptId === null) {
        throw new Error('입하를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/inbound-receipts/{inboundReceiptId}/lines', {
          params: { path: { inboundReceiptId } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 이 줄에 이미 적힌 오류.
 *
 * 한 줄에 여러 건을 적을 수 있어 막지 않지만, 무엇이 이미 적혀 있는지 보이지 않으면 같은 것을
 * 두 번 적게 된다. 수정도 삭제도 없으므로 두 번 적힌 것은 그대로 남는다.
 */
export const useKnownVariances = (lineId: number | null): UseQueryResult<InboundVariance[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: varianceKeys.known(lineId),
    enabled: lineId !== null,
    queryFn: async () => {
      if (lineId === null) {
        throw new Error('줄을 고르기 전에는 적힌 오류를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/inbound-receipt-lines/{inboundReceiptLineId}/variances', {
          params: { path: { inboundReceiptLineId: lineId } },
        }),
      );

      return data.items;
    },
  });
};

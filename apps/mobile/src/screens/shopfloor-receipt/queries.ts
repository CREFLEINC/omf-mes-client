import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { GoodsIssue, GoodsIssueLine } from './receipt';

type Client = ReturnType<typeof useApiClient>['client'];

/**
 * 스캔 하나로 모은 것.
 *
 * 수령 전표는 작업지시와 도착 위치를 필수로 요구하는데 출고 전표에는 둘 다 없다. 출고 →
 * 피킹 지시 → 자재출고요청으로 두 번 더 따라가야 나온다.
 */
export interface ScannedIssue {
  issue: GoodsIssue;
  lines: GoodsIssueLine[];
  workOrderId: number;
  destinationLocationId: number;
}

/**
 * 이 경로에는 번호 정확 일치 축이 없어 부분 검색으로 묻고 화면이 고른다.
 *
 * 쪽을 넉넉히 받는다 - 목록이 쪽 단위라 일치 건이 뒷쪽에 있으면 못 찾는데, 못 찾은 것과
 * 없는 것이 화면에서 같아 보인다.
 */
const SEARCH_SIZE = 200;

const findIssue = async (client: Client, code: string): Promise<ScannedIssue | null> => {
  const found = await runRequest(() =>
    client.GET('/logistics/goods-issues', { params: { query: { q: code, size: SEARCH_SIZE } } }),
  );

  const issue = found.items.find((each) => each.goodsIssueNo === code);

  if (issue === undefined) {
    return null;
  }

  const lines = await runRequest(() =>
    client.GET('/logistics/goods-issues/{goodsIssueId}/lines', {
      params: { path: { goodsIssueId: issue.goodsIssueId } },
    }),
  );

  const picking = await runRequest(() =>
    client.GET('/logistics/picking-orders/{pickingOrderId}', {
      params: { path: { pickingOrderId: issue.sourceDocumentId } },
    }),
  );

  const request = await runRequest(() =>
    client.GET('/logistics/material-issue-requests/{materialIssueRequestId}', {
      params: { path: { materialIssueRequestId: picking.pickingOrder.sourceDocumentId } },
    }),
  );

  return {
    issue,
    lines: lines.items,
    workOrderId: request.materialIssueRequest.workOrderId,
    destinationLocationId: request.materialIssueRequest.destinationLocationId,
  };
};

export const useScannedGoodsIssue = (code: string | null): UseQueryResult<ScannedIssue | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shopfloor-receipt-issue', code] as const,
    enabled: code !== null,
    queryFn: () => {
      if (code === null) {
        throw new Error('스캔하기 전에는 출고 전표를 조회하지 않습니다.');
      }

      return findIssue(client, code);
    },
  });
};

/**
 * 출고 라인이 가리키는 LOT 의 번호표.
 *
 * 라인은 LOT 식별자만 준다. 그 번호를 그대로 보이면 작업자가 실물 라벨과 대조할 수 없다 -
 * 라벨에는 LOT 번호가 찍혀 있지 대리키가 찍혀 있지 않다.
 */
export const useLineLotLabels = (lines: GoodsIssueLine[]): Map<number, string> => {
  const { client } = useApiClient();
  const lotIds = [...new Set(lines.map((line) => line.lotId))];

  return useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: ['shopfloor-receipt-lot', lotId] as const,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
        );

        return [lotId, data.lot.lotNo] as const;
      },
    })),
    combine: (results) =>
      new Map(
        results
          .map((result) => result.data)
          .filter((pair): pair is readonly [number, string] => pair !== undefined),
      ),
  });
};

/** 확인하지 못한 것은 받지 않은 것과 다르다. */
export type ReceivedCheck = 'received' | 'clear' | 'unknown' | 'checking';

/**
 * 이 출고 전표를 이미 받았는가.
 *
 * 수령 전표는 출고 전표 하나에 하나다. 단말이 기억하는 것으로는 재시작을 넘지 못해 - 앱을
 * 다시 켜거나 다른 단말로 같은 전표를 열면 기억이 비어 있다 - 서버에 묻는다.
 */
export const useAlreadyReceived = (goodsIssueId: number | null): ReceivedCheck => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['shopfloor-receipt-existing', goodsIssueId] as const,
    enabled: goodsIssueId !== null,
    /*
     * 공유계약 C-6 - 판정에 쓰는 값은 캐시하지 않는다. 수령은 이 화면 밖에서도 서므로
     * 조금 전에 없었다는 것이 지금 없다는 뜻이 아니다.
     */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (goodsIssueId === null) {
        throw new Error('출고 전표를 찾기 전에는 수령 여부를 묻지 않습니다.');
      }

      const found = await runRequest(() =>
        client.GET('/logistics/shopfloor-receipts', {
          params: { query: { goodsIssueId, size: 1 } },
        }),
      );

      return found.items.length > 0;
    },
  });

  if (goodsIssueId === null) {
    return 'clear';
  }

  if (query.isPending) {
    return 'checking';
  }

  return query.data === undefined ? 'unknown' : query.data ? 'received' : 'clear';
};

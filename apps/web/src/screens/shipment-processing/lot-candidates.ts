import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * ①출하 내역의 LOT 수동 선택 목록 — `GET /trace/lots?itemId=&heldOnly=false`.
 *
 * **자동 프리필을 하지 않는다**(계획서 미결 항목 — `ShipmentRequestLine.picks[]`가 baseline에
 * 없다). `heldOnly=false`로 보류·비보류 LOT을 함께 받고, 보류 LOT은 목록에 보이되 화면이
 * 선택하지 못하게 막는다(`shipment-lines-pane.tsx`가 `held`로 옵션을 잠근다).
 *
 * 라인마다 다른 품목일 수 있어 **품목별로 한 번씩** 받는다. 화면이 선택된 출하작업지시의
 * 라인에서 고유 품목 id 목록을 뽑아 넘긴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const LOT_CANDIDATE_PAGE_SIZE = 100;

export interface LotCandidate {
  lotId: number;
  lotNo: string;
  held: boolean;
  expiryDate: string | null;
}

export interface LotCandidateResult {
  items: LotCandidate[];
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_RESULT: LotCandidateResult = {
  items: [],
  truncated: false,
  isError: false,
  isLoading: false,
};

const lotCandidateKeys = {
  forItem: (itemId: number) => ['shipment-processing-lookups', 'lots', itemId] as const,
};

/** 품목 id마다 하나씩 LOT 후보를 받아 `Record<itemId, LotCandidateResult>`로 낸다. */
export const useLotCandidatesByItem = (
  itemIds: readonly number[],
): Record<number, LotCandidateResult> => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];

  const queries = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: lotCandidateKeys.forItem(itemId),
      queryFn: () =>
        runRequest(() =>
          client.GET('/trace/lots', {
            params: {
              query: { itemId, heldOnly: false, page: 1, size: LOT_CANDIDATE_PAGE_SIZE },
            },
          }),
        ),
    })),
  });

  const result: Record<number, LotCandidateResult> = {};

  uniqueIds.forEach((itemId, index) => {
    const query = queries[index];

    if (query === undefined) {
      result[itemId] = EMPTY_RESULT;
      return;
    }

    const data = query.data;

    result[itemId] = {
      items:
        data?.items.map((lot) => ({
          lotId: lot.lotId,
          lotNo: lot.lotNo,
          held: lot.held ?? false,
          expiryDate: lot.expiryDate ?? null,
        })) ?? [],
      truncated: data !== undefined && data.page.total > data.items.length,
      isError: query.isError,
      isLoading: query.isPending,
    };
  });

  return result;
};

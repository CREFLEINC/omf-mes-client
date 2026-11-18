import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PickedLot } from './types';

/**
 * ①출하 내역의 LOT 수동 선택 목록 — **이 출하작업지시에서 집은 LOT**(`ShipmentRequestLine.picks[]`)만 낸다.
 * 평시 출하는 피킹분만 낼 수 있어(계약 L-2) 집지 않은 LOT — 입고 전 · 검사 대기 LOT 까지 — 을 고르면
 * 서버가 거절한다(omf-all-around#302).
 *
 * 집은 LOT 마다 `GET /trace/lots?itemId=&lotNo=&heldOnly=false` 로 한 건씩 받는다 — 품목의 LOT 목록 첫
 * 쪽에서 거르면 쪽 밖의 집은 LOT 이 빠진다. 보류 여부·유효기한은 이 응답에서 온다.
 *
 * **자동 프리필을 하지 않는다.** 보류 LOT은 목록에 보이되 화면이 선택하지 못하게 막는다
 * (`shipment-lines-pane.tsx`가 `held`로 옵션을 잠근다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface LotCandidate {
  lotId: number;
  lotNo: string;
  held: boolean;
  expiryDate: string | null;
}

export interface LotCandidateResult {
  items: LotCandidate[];
  isError: boolean;
  isLoading: boolean;
}

const lotCandidateKeys = {
  forLot: (itemId: number, lotNo: string) =>
    ['shipment-processing-lookups', 'lots', itemId, lotNo] as const,
};

/** 품목 id마다 집은 LOT 후보를 `Record<itemId, LotCandidateResult>`로 낸다. `pickedLots` 는 품목별로 집은 LOT 이다. */
export const useLotCandidatesByItem = (
  itemIds: readonly number[],
  pickedLots: Readonly<Record<number, readonly PickedLot[]>>,
): Record<number, LotCandidateResult> => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const targets = uniqueIds.flatMap((itemId) =>
    [...new Set((pickedLots[itemId] ?? []).map((lot) => lot.lotNo))].map((lotNo) => ({
      itemId,
      lotNo,
    })),
  );

  const queries = useQueries({
    queries: targets.map(({ itemId, lotNo }) => ({
      queryKey: lotCandidateKeys.forLot(itemId, lotNo),
      queryFn: () =>
        runRequest(() =>
          client.GET('/trace/lots', {
            params: { query: { itemId, lotNo, heldOnly: false, page: 1, size: 1 } },
          }),
        ),
    })),
  });

  const result: Record<number, LotCandidateResult> = {};

  for (const itemId of uniqueIds) {
    const own = queries.filter((_, index) => targets[index]?.itemId === itemId);

    result[itemId] = {
      items: own.flatMap(
        (query) =>
          query.data?.items.map((lot) => ({
            lotId: lot.lotId,
            lotNo: lot.lotNo,
            held: lot.held ?? false,
            expiryDate: lot.expiryDate ?? null,
          })) ?? [],
      ),
      isError: own.some((query) => query.isError),
      isLoading: own.some((query) => query.isPending),
    };
  }

  return result;
};

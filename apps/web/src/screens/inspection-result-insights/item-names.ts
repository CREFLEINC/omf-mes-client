import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 목록 줄의 품목 이름 — 품목 번호마다 단건으로 받는다(「코드 · 이름」).
 *
 * ⚠ 조회 조건용 품목 목록(`useInspectionItemLookup`)은 첫 쪽만 받아, 그 밖 품목의 줄이 「알 수 없음」으로 떴다
 *   (실검증 자료 2026-10-30 — 품목 9,270종 중 첫 20종). 줄에 보이는 품목만 부른다. 못 받으면 그 품목은 빠진다(부르는 쪽이 대체한다).
 */
export interface ItemName {
  code: string;
  name: string;
  /** 「코드 · 이름」 — 목록 칸이 쓴다. */
  label: string;
}

export const useItemNames = (itemIds: readonly (number | undefined)[]): Map<number, ItemName> => {
  const { client } = useApiClient();
  const ids = [...new Set(itemIds.filter((id): id is number => id !== undefined))];
  const results = useQueries({
    queries: ids.map((itemId) => ({
      queryKey: ['inspection-result-insights', 'item', itemId],
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
      staleTime: 5 * 60_000,
    })),
  });
  const names = new Map<number, ItemName>();
  results.forEach((result, index) => {
    const item = result.data?.item;
    const id = ids[index];
    if (item !== undefined && id !== undefined)
      names.set(id, {
        code: item.itemCode,
        name: item.itemName,
        label: `${item.itemCode} · ${item.itemName}`,
      });
  });
  return names;
};

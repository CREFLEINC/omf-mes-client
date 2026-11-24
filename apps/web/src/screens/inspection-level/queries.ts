import type { components } from '@omf-mes/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type ItemInspectionLevel = components['schemas']['ItemInspectionLevel'];
type ItemInspectionLevelHistory = components['schemas']['ItemInspectionLevelHistory'];

/** 처음 쪽 크기. 품목별 기준정보라 한 화면에 넉넉히 본다 — 건수 선택으로 바꿀 수 있다(사용자 지시 · #208). */
export const PAGE_SIZE = 50;

export const inspectionLevelKeys = {
  /** 무효화용 앞부분 — 저장하면 목록과 이력이 함께 낡는다. */
  all: ['inspection-level'] as const,
  history: (itemId: number | null, page: number, size: number) =>
    ['inspection-level', 'history', itemId, page, size] as const,
};

export interface PageMetaView {
  page: number;
  size: number;
  total: number;
}

export interface Paged<T> {
  items: T[];
  page: PageMetaView;
}

/** 전환 이력. 품목을 고르면 그 품목만 본다. */
export const useInspectionLevelHistories = (
  itemId: number | null,
  page: number,
  size: number = PAGE_SIZE,
) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inspectionLevelKeys.history(itemId, page, size),
    placeholderData: keepPreviousData,
    queryFn: (): Promise<Paged<ItemInspectionLevelHistory>> =>
      runRequest(() =>
        client.GET('/quality/item-inspection-level-histories', {
          params: { query: { ...(itemId === null ? {} : { itemId }), page, size } },
        }),
      ),
  });
};

/**
 * 품목 하나의 현재 검사 수준 — 없으면 `null`(미지정). 검사 기준 상세의 「검사 수준」 칸이 쓴다(omf-all-around#357).
 * 키는 IQC 검사 화면의 「검사 수준」 칸과 같다 — 저장하면 `inspectionLevelKeys.all` 무효화로 함께 낡는다.
 */
export const useItemInspectionLevel = (itemId: number) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: [...inspectionLevelKeys.all, 'item', itemId] as const,
    queryFn: (): Promise<ItemInspectionLevel | null> =>
      runRequest(() =>
        client.GET('/quality/item-inspection-levels', {
          params: { query: { itemId, page: 1, size: 1 } },
        }),
      ).then((paged: Paged<ItemInspectionLevel>) => paged.items[0] ?? null),
  });
};

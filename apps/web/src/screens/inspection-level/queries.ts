import type {
  InspectionLevelCode,
  ItemInspectionLevel,
  ItemInspectionLevelHistory,
} from '@omf-mes/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/** 한 쪽 크기. 품목별 기준정보라 한 화면에 넉넉히 본다. */
export const PAGE_SIZE = 50;

export const inspectionLevelKeys = {
  /** 무효화용 앞부분 — 저장하면 목록과 이력이 함께 낡는다. */
  all: ['inspection-level'] as const,
  list: (query: LevelListFilter) => ['inspection-level', 'list', query] as const,
  history: (itemId: number | null, page: number) =>
    ['inspection-level', 'history', itemId, page] as const,
};

export interface LevelListFilter {
  q: string;
  level: InspectionLevelCode | '';
  page: number;
}

export interface PageMetaView {
  page: number;
  size: number;
  total: number;
}

export interface Paged<T> {
  items: T[];
  page: PageMetaView;
}

export const useInspectionLevels = (filter: LevelListFilter) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inspectionLevelKeys.list(filter),
    placeholderData: keepPreviousData,
    queryFn: (): Promise<Paged<ItemInspectionLevel>> =>
      runRequest(() =>
        client.GET('/quality/item-inspection-levels', {
          params: {
            query: {
              ...(filter.q === '' ? {} : { q: filter.q }),
              ...(filter.level === '' ? {} : { inspectionLevelCode: filter.level }),
              page: filter.page,
              size: PAGE_SIZE,
            },
          },
        }),
      ),
  });
};

/** 전환 이력. 품목을 고르면 그 품목만 본다. */
export const useInspectionLevelHistories = (itemId: number | null, page: number) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inspectionLevelKeys.history(itemId, page),
    placeholderData: keepPreviousData,
    queryFn: (): Promise<Paged<ItemInspectionLevelHistory>> =>
      runRequest(() =>
        client.GET('/quality/item-inspection-level-histories', {
          params: { query: { ...(itemId === null ? {} : { itemId }), page, size: PAGE_SIZE } },
        }),
      ),
  });
};

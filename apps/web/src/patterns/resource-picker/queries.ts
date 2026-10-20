import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../api-context';
import { runRequest } from '../request';

export type ResourceKind = 'equipment' | 'mold';

/** 찾기 창 한 줄 — 설비·금형을 같은 모양으로 맞춘다. */
export interface ResourceRow {
  id: number;
  plantId: number;
  code: string;
  name: string;
  /** 설비의 라인. 금형은 늘 `null` */
  productionLineId: number | null;
  isActive: boolean;
}

export interface ResourcePage {
  items: ResourceRow[];
  total: number;
}

export const RESOURCE_PAGE_SIZE = 20;

export const resourcePickerKeys = {
  search: (
    kind: ResourceKind,
    plantId: number | null,
    lineId: number | null,
    term: string,
    page: number,
  ) => ['resource-picker', kind, plantId, lineId, term, page] as const,
};

/**
 * 서버가 찾는다(`q`) — 금형은 공장마다 수백 건이라 다 받아 화면에서 거르지 않는다.
 * 설비는 라인을 주면 그 라인 것만 낸다(4M 은 라인으로 설비를 좁혀 왔다).
 */
export const useResourceSearch = (
  kind: ResourceKind,
  plantId: number | null,
  lineId: number | null,
  term: string,
  page: number,
): UseQueryResult<ResourcePage> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: resourcePickerKeys.search(kind, plantId, lineId, term, page),
    enabled: plantId !== null,
    queryFn: async () => {
      if (plantId === null) throw new Error('A plant is required to search resources.');
      const q = term === '' ? {} : { q: term };

      if (kind === 'equipment') {
        const data = await runRequest(() =>
          client.GET('/mdm/equipments', {
            params: {
              query: {
                plantId,
                ...(lineId === null ? {} : { productionLineId: lineId }),
                ...q,
                includeInactive: true,
                page,
                size: RESOURCE_PAGE_SIZE,
              },
            },
          }),
        );
        return {
          items: data.items.map((item) => ({
            id: item.equipmentId,
            plantId: item.plantId,
            code: item.equipmentCode,
            name: item.equipmentName,
            productionLineId: item.productionLineId ?? null,
            isActive: item.isActive,
          })),
          total: data.page.total,
        };
      }

      const data = await runRequest(() =>
        client.GET('/mdm/molds', {
          params: {
            query: {
              plantId,
              toolTypeCode: 'MOLD',
              ...q,
              includeInactive: true,
              page,
              size: RESOURCE_PAGE_SIZE,
            },
          },
        }),
      );
      return {
        items: data.items.map((item) => ({
          id: item.moldId,
          plantId: item.plantId,
          code: item.moldCode,
          name: item.moldName,
          productionLineId: null,
          isActive: item.isActive,
        })),
        total: data.page.total,
      };
    },
  });
};

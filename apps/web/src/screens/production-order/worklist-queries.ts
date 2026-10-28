import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toProductionOrderFact } from './queries';
import type { ProductionOrderListResponse } from './types';
import type { WorklistFilter } from './worklist-model';

/**
 * 작업함 조회. 키는 `production-orders`와 `work-orders` 접두를 써서, 자동 계획과 배포가 끝나면 기존 무효화로 함께 갱신된다.
 */
export interface WorklistFilters {
  state: WorklistFilter;
  q: string;
  dueFrom: string;
  dueTo: string;
  item: string;
  page: number;
  size: number;
}

export const worklistKeys = {
  list: (filters: WorklistFilters) => ['production-orders', 'worklist', filters] as const,
  count: (state: WorklistFilter) => ['production-orders', 'worklist-count', state] as const,
  byNumber: (orderNo: string) => ['production-orders', 'by-number', orderNo] as const,
};

/** 「전체」는 거르지 않는다. 나머지는 서버 칩 판정(`worklistState`)으로 거른다. */
const stateQuery = (state: WorklistFilter) => (state === 'ALL' ? {} : { worklistState: state });

export const useWorklist = (filters: WorklistFilters) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: worklistKeys.list(filters),
    queryFn: async (): Promise<ProductionOrderListResponse> => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', {
          params: {
            query: {
              ...stateQuery(filters.state),
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...(filters.dueFrom === '' ? {} : { dueDateFrom: filters.dueFrom }),
              ...(filters.dueTo === '' ? {} : { dueDateTo: filters.dueTo }),
              ...(filters.item === '' ? {} : { itemId: Number(filters.item) }),
              page: filters.page,
              size: filters.size,
            },
          },
        }),
      );
      return { items: data.items.map(toProductionOrderFact), page: data.page };
    },
  });
};

/** 페이지 머리 상태별 건수. 목록과 같은 조건에 쪽 크기 1을 주고 서버 총계를 쓴다. */
export const useWorklistCount = (state: WorklistFilter) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: worklistKeys.count(state),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', {
          params: { query: { ...stateQuery(state), size: 1 } },
        }),
      );
      return data.page.total;
    },
  });
};

/** 처리 화면 주소의 업무 번호로 ERP W/O 한 건을 찾는다(번호 검색 후 같은 번호 한 건). */
export const useProductionOrderByNumber = (orderNo: string) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: worklistKeys.byNumber(orderNo),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', { params: { query: { q: orderNo, size: 20 } } }),
      );
      const found = data.items.find((item) => item.productionOrderNo === orderNo);
      return found === undefined ? null : toProductionOrderFact(found);
    },
  });
};

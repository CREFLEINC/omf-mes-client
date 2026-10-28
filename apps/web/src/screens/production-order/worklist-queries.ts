import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import { toProductionOrderFact } from './queries';
import type { ProductionOrderListResponse } from './types';
import { toReleaseBacklog, type AutoPlanFilter, type ReleaseBacklog } from './worklist-model';

type WorkOrderWithOrder = components['schemas']['WorkOrder'] & { productionOrderId?: number };

/**
 * 작업함 조회. 키는 `production-orders`와 `work-orders` 접두를 써서, 자동 계획과 배포가 끝나면 기존 무효화로 함께 갱신된다.
 */
export interface WorklistFilters {
  autoPlan: AutoPlanFilter;
  q: string;
  dueFrom: string;
  dueTo: string;
  item: string;
  page: number;
  size: number;
}

export const worklistKeys = {
  list: (filters: WorklistFilters) => ['production-orders', 'worklist', filters] as const,
  count: (status: AutoPlanFilter) => ['production-orders', 'worklist-count', status] as const,
  backlog: ['work-orders', 'release-backlog'] as const,
  byNumber: (orderNo: string) => ['production-orders', 'by-number', orderNo] as const,
};

export const useWorklist = (filters: WorklistFilters) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: worklistKeys.list(filters),
    queryFn: async (): Promise<ProductionOrderListResponse> => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', {
          params: {
            query: {
              ...(filters.autoPlan === 'ALL' ? {} : { autoPlanStatus: filters.autoPlan }),
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

/** 페이지 머리 상태별 건수. 서버 총계를 쓴다(쪽 크기 1). */
export const useWorklistCount = (status: AutoPlanFilter) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: worklistKeys.count(status),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', {
          params: { query: { ...(status === 'ALL' ? {} : { autoPlanStatus: status }), size: 1 } },
        }),
      );
      return data.page.total;
    },
  });
};

/** 배포 전 W/O 집계와 그 완전성. `complete`가 false면 목록이 잘려 없는 ERP W/O를 「배포 전 W/O 0건」으로 읽으면 안 된다. */
export interface ReleaseBacklogResult {
  byOrder: Map<number, ReleaseBacklog>;
  complete: boolean;
}

/**
 * 배포 전 W/O 집계. 배포 전 W/O 목록 하나를 받아 ERP W/O별로 묶는다(작업함 행 수와 무관한 고정 호출, C-15 2).
 * 목록 API의 `productionOrderId` 필터는 한 건만 받아 현재 쪽의 ERP W/O로 좁히면 행마다 부르게 되므로 쓰지 않는다
 * (여러 건 필터는 서버 요청 대상, omf-all-around#129). 상한에 걸려 잘리면 `complete`를 false로 두고, 화면은 목록에
 * 없는 ERP W/O를 「배포 완료」가 아니라 판정 불가로 보인다.
 * 목록에 실린 칸으로 판정할 수 있는 배포 불가는 생산 라인 없음뿐이다. 기본 위치와 점검 차단은 W/O 상세에만 있어
 * 행마다 불러야 하므로 작업함에서는 판정하지 않는다. 목록 필터 `releasable`은 실측에서 배포 요청 결과와 달라 쓰지 않는다.
 */
export const useReleaseBacklog = () => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: worklistKeys.backlog,
    queryFn: async (): Promise<ReleaseBacklogResult> => {
      const pending = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/production/work-orders', {
            params: { query: { released: false, page, size } },
          }),
        ),
      );
      const items = (pending.items as WorkOrderWithOrder[]).flatMap((item) =>
        item.productionOrderId === undefined
          ? []
          : [
              {
                productionOrderId: item.productionOrderId,
                lineMissing: item.productionLineId === undefined,
              },
            ],
      );
      return {
        byOrder: toReleaseBacklog(
          items,
          items.filter((item) => item.lineMissing),
        ),
        complete: !pending.truncated,
      };
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

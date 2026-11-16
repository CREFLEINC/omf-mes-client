import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { toProductionPlanFact } from '../../production-plan/queries';
import type { ProductionPlanFact } from '../../production-plan/types';
export interface WeeklyContextPlan extends ProductionPlanFact {
  orderNo: string;
  itemCode: string;
  itemName: string;
}
export const useWeeklyPlanContext = (
  plantId: number | null,
  from: string,
  to: string,
  enabled: boolean,
  excludedOrders: readonly number[],
) => {
  const { client } = useApiClient();
  const excluded = [...excludedOrders].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['production-plans', 'weekly-context', plantId, from, to, excluded],
    enabled: enabled && plantId !== null,
    queryFn: async (): Promise<WeeklyContextPlan[]> => {
      const plans = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/planning/production-plans', {
            params: { query: { planDateFrom: from, planDateTo: to, page, size } },
          }),
        ),
      );
      if (plans.truncated) throw new Error('전체 편성 목록을 모두 조회하지 못했습니다.');
      const candidates = plans.items.filter(
        (plan) =>
          !excluded.includes(plan.productionOrderId) &&
          plan.planDate >= from &&
          plan.planDate <= to,
      );
      const groups = await Promise.all(
        [...new Set(candidates.map((plan) => plan.productionOrderId))].map(async (id) => {
          const order = await runRequest(() =>
            client.GET('/planning/production-orders/{productionOrderId}', {
              params: { path: { productionOrderId: id } },
            }),
          );
          if (order.plantId !== plantId || order.statusCode === 'CANCELLED') return [];
          const [item, workOrders] = await Promise.all([
            runRequest(() =>
              client.GET('/mdm/items/{itemId}', { params: { path: { itemId: order.itemId } } }),
            ),
            fetchAllPages((page, size) =>
              runRequest(() =>
                client.GET('/production/work-orders', {
                  params: { query: { productionOrderId: id, page, size } },
                }),
              ),
            ),
          ]);
          if (workOrders.truncated)
            throw new Error('작업지시 취소 상태를 모두 확인하지 못했습니다.');
          return candidates
            .filter((plan) => plan.productionOrderId === id)
            .filter((plan) => {
              const work = workOrders.items.filter(
                (work) => work.productionPlanId === plan.productionPlanId,
              );
              return (
                plan.statusCode !== 'CANCELLED' &&
                !(work.length > 0 && work.every((work) => work.statusCode === 'CANCELLED'))
              );
            })
            .map((plan) => ({
              ...toProductionPlanFact(plan),
              orderNo: order.productionOrderNo,
              itemCode: item.item.itemCode,
              itemName: item.item.itemName,
            }));
        }),
      );
      return groups.flat();
    },
  });
};

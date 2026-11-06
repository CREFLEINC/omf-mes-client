import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';

type Location = components['schemas']['Location'];
export type ArrivalLocation = Pick<
  Location,
  'locationId' | 'warehouseId' | 'locationCode' | 'locationName' | 'isActive' | 'systemRoleCode'
>;
export const warehouseArrival = (items: readonly ArrivalLocation[]) => {
  const divided = items.some((item) => item.isActive && item.systemRoleCode === null);
  const role = divided ? 'PUTAWAY_STAGING' : 'WAREHOUSE_WHOLE';
  const location = items.find((item) => item.isActive && item.systemRoleCode === role);
  return { divided, location };
};

export const useWarehouseArrival = (warehouseId: number | undefined) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['production-order', 'warehouse-arrival', warehouseId],
    enabled: warehouseId !== undefined,
    queryFn: async () => {
      const items: Location[] = [];
      for (let page = 1; ; page++) {
        const data = await runRequest(() =>
          client.GET('/mdm/locations', {
            params: {
              query: { warehouseId: warehouseId!, includeInactive: true, page, size: 200 },
            },
          }),
        );
        items.push(...data.items.filter((item) => item.warehouseId === warehouseId));
        if (page * data.page.size >= data.page.total) break;
        if (data.items.length === 0) throw new Error('입고 위치 목록을 모두 확인하지 못했습니다.');
      }
      return { ...warehouseArrival(items), items };
    },
  });
};

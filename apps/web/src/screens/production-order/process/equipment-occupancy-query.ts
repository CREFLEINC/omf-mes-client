import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../../../patterns/api-context';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { runRequest } from '../../../patterns/request';
import { activeEquipmentAllocations } from './equipment-occupancy-model';

export const useEquipmentOccupancy = (equipmentId: number | null, selfId: number) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['work-orders', 'equipment-occupancy', equipmentId, selfId],
    enabled: equipmentId !== null,
    staleTime: 0,
    queryFn: async () => {
      if (equipmentId === null) throw new Error('설비를 선택하세요.');
      const result = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/production/work-orders', {
            params: { query: { plannedEquipmentId: equipmentId, page, size } },
          }),
        ),
      );
      // 불완전한 목록으로 중복 없음/저장 가능을 판정하지 않는다.
      if (
        result.truncated ||
        new Set(result.items.map((row) => row.workOrderId)).size !== result.page.total
      ) {
        throw new Error('설비 배정 내역 전체를 조회하지 못했습니다.');
      }
      return activeEquipmentAllocations(result.items, selfId);
    },
  });
};

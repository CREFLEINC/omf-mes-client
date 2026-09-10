import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

export type InspectionItem = components['schemas']['InspectionItemAssignment'];

/**
 * 점검 항목이 어느 층에서 왔는가.
 *
 * 설비에 직접 부여가 있으면 그것, 없으면 소속 그룹의 것이다. 화면은 고르지 않고 해석 결과를
 * 그대로 그린다.
 */
export interface InspectionItems {
  effective: InspectionItem[];
  /** 점검 대상이 아니라는 뜻의 값. 화면은 입력을 열지 않는다. */
  resolvedFromLevelCode: string;
  /** 이 목록을 받은 단말 시각. 부여가 바뀌어도 다시 받기 전까지는 이때 것으로 점검한다. */
  receivedAt: string;
}

export const NONE = 'NONE';

export const inspectionKeys = {
  items: (equipmentId: number | null) => ['equipment-inspection-items', equipmentId] as const,
};

/**
 * 이 설비의 점검 항목.
 *
 * 받지 못한 것을 등록되지 않은 것으로 말하지 않는다 - 오프라인에서 한 번도 받지 않은 설비를
 * 스캔하면 둘이 같아 보이는데, 앞엣것은 확인하지 못한 것이고 뒤엣것은 점검 대상이 아닌 것이다.
 */
export const useInspectionItems = (equipmentId: number | null): UseQueryResult<InspectionItems> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inspectionKeys.items(equipmentId),
    enabled: equipmentId !== null,
    queryFn: async () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 점검 항목을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/equipments/{equipmentId}/inspection-items', {
          params: { path: { equipmentId } },
        }),
      );

      return {
        effective: data.effective,
        resolvedFromLevelCode: data.resolvedFromLevelCode,
        receivedAt: new Date().toISOString(),
      };
    },
  });
};

export type Inspection = components['schemas']['Inspection'];

const startOfDay = (now: Date): string =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

/**
 * 오늘 이 설비를 이 유형으로 점검한 기록.
 *
 * 막지 않는다 - 재점검은 정상 행위다(고장 조치 뒤 재확인). 다만 이미 했다는 것을 말하지
 * 않으면 같은 점검이 모르는 채로 한 번 더 쌓인다.
 */
export const useTodaysInspection = (
  equipmentId: number | null,
  inspectionTypeCode: string,
): UseQueryResult<Inspection | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['equipment-inspection-today', equipmentId, inspectionTypeCode] as const,
    enabled: equipmentId !== null,
    queryFn: async () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 오늘 기록을 조회하지 않습니다.');
      }

      const now = new Date();
      const data = await runRequest(() =>
        client.GET('/maintenance/inspections', {
          params: {
            query: {
              equipmentId,
              inspectionTypeCode,
              inspectedFrom: startOfDay(now),
              inspectedTo: now.toISOString(),
              size: 1,
            },
          },
        }),
      );

      return data.items[0] ?? null;
    },
  });
};

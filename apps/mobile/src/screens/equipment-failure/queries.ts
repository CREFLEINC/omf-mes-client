import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

export type Equipment = components['schemas']['Equipment'];

/** 운용 중인 설비만. 폐기된 것이 목록에 나오면 안 되는 것이 정상이다. */
const IN_SERVICE = 'IN_SERVICE';

const PAGE_SIZE = 200;

export const equipmentFailureKeys = {
  equipments: () => ['equipment-failure-equipments'] as const,
  openBreakdowns: (equipmentId: number | null) =>
    ['equipment-failure-open-breakdowns', equipmentId] as const,
};

const fetchEquipments = async (client: Client): Promise<Equipment[]> => {
  const items: Equipment[] = [];

  for (let page = 0; ; page += 1) {
    const data = await runRequest(() =>
      client.GET('/mdm/equipments', {
        params: {
          query: { statusCode: IN_SERVICE, includeInactive: false, page, size: PAGE_SIZE },
        },
      }),
    );

    items.push(...data.items);

    if (data.items.length === 0 || items.length >= data.page.total) {
      return items;
    }
  }
};

/**
 * 고를 수 있는 설비.
 *
 * 스캔이 실패해도 고를 수 있어야 해서 목록을 함께 받는다. 폐기된 설비를 거르는 것은 서버에
 * 맡긴다 — 화면이 다시 거르면 서버가 축을 바꿨을 때 두 곳을 고쳐야 한다.
 */
export const useEquipments = (): UseQueryResult<Equipment[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: equipmentFailureKeys.equipments(),
    queryFn: () => fetchEquipments(client),
  });
};

/**
 * 이 설비에 아직 끝나지 않은 고장이 몇 건인가.
 *
 * 막는 데 쓰지 않는다. 다른 증상일 수 있으므로 사람이 보고 정한다.
 */
export const useOpenBreakdownCount = (equipmentId: number | null): UseQueryResult<number> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: equipmentFailureKeys.openBreakdowns(equipmentId),
    enabled: equipmentId !== null,
    queryFn: async () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/maintenance/breakdowns', {
          params: { query: { equipmentId, openOnly: true, page: 0, size: 1 } },
        }),
      );

      // 건수만 필요하다. page 가 없으면 셀 수 없으므로 목록 길이로 물러난다.
      return data.page?.total ?? data.items.length;
    },
  });
};

import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

type Client = ReturnType<typeof useApiClient>['client'];

export type Equipment = components['schemas']['Equipment'];

export const equipmentKeys = {
  list: () => ['equipments'] as const,
};

/** 운용 중인 설비만. 폐기된 것이 목록에 나오면 안 되는 것이 정상이다. */
const IN_SERVICE = 'IN_SERVICE';

const PAGE_SIZE = 200;

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
    queryKey: equipmentKeys.list(),
    queryFn: () => fetchEquipments(client),
  });
};

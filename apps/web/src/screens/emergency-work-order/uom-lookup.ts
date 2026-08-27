import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단위 이름. 수량 라벨에 붙일 한 낱말만 필요해 이름표만 만든다.
 *
 * ⛔ **못 받았을 때 숫자 식별자를 보이지 않는다.** `11` 은 사용자가 쓰는 말이 아니다 —
 * 이름을 모르면 **모른다고 적는다**. 잘못된 단위를 보이는 것보다 낫다.
 */
export interface UomLookup {
  labelOf: (uomId: number | undefined) => string;
  isPending: boolean;
}

export const UOM_UNKNOWN = '단위 확인 중';

export const useUomLookup = (): UomLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['emergency-work-order', 'uoms'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
    },
  });

  return {
    labelOf: (uomId) => {
      if (uomId === undefined) return UOM_UNKNOWN;

      return query.data?.get(uomId) ?? UOM_UNKNOWN;
    },
    isPending: query.isPending,
  };
};

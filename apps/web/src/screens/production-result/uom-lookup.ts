import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단위 이름 — 수량 뒤에 붙일 한 낱말.
 *
 * 스펙 §3-2 가 양품수량 칸을 「`[ 120 ] EA`」로 그렸고 §4 가 단위를 「품목 기본 단위 자동 ·
 * 표시만」으로 정했다. 계약이 본문에 싣는 것은 `uomId`(숫자)뿐이라 이름은 따로 받는다.
 *
 * ⛔ **못 받았을 때 숫자 식별자를 보이지 않는다.** `10` 은 사용자가 쓰는 말이 아니다 —
 * 이름을 모르면 **아무것도 붙이지 않는다.** 잘못된 단위를 보이는 것보다 낫다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 모듈을 참조하지 않는다.
 */
export interface UomLookup {
  /** 이름을 모르면 `null`. 붙일 것이 없다는 뜻이다. */
  labelOf: (uomId: number | undefined) => string | null;
}

export const useUomLookup = (): UomLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['production-result', 'uoms'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
    },
  });

  return {
    labelOf: (uomId) => (uomId === undefined ? null : (query.data?.get(uomId) ?? null)),
  };
};

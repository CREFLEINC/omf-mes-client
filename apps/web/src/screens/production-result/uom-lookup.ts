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
  /**
   * 이 단위가 허용하는 소수 자릿수. **모르면 0** — 소수점 키를 세우지 않는다.
   *
   * ⛔ 모르는 동안 열어 두지 않는다. 「개(EA)」에 소수를 넣으면 되돌릴 수 없는 실적에 넣을 수
   * 없는 값이 실린다(자매 화면 `P-04-03` 이 같은 근거로 같은 규칙을 쓴다).
   */
  decimalScaleOf: (uomId: number | undefined) => number;
}

export const useUomLookup = (): UomLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['production-result', 'uoms'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return new Map(
        data.items.map((uom) => [uom.uomId, { code: uom.uomCode, decimalScale: uom.decimalScale }]),
      );
    },
  });

  return {
    labelOf: (uomId) => (uomId === undefined ? null : (query.data?.get(uomId)?.code ?? null)),
    decimalScaleOf: (uomId) =>
      uomId === undefined ? 0 : (query.data?.get(uomId)?.decimalScale ?? 0),
  };
};

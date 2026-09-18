import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단위 코드 조회 — 수량 옆에 「10 EA」처럼 단위 코드를 붙이는 데만 쓴다(표시 전용).
 *
 * 의뢰·회차 응답은 단위 식별자(`uomId`)만 준다. 목록을 한 번 불러 식별자 → 코드로 바꾼다.
 *
 * ⚠ **실패하면 조용히 생략한다.** 서버가 이 목록을 여는 권한은 M-01-01 뿐이라 IQC 권한만 가진
 * 사용자에게는 403 이 난다 — 그때 화면을 멈추거나 오류를 띄우지 않고 단위만 붙이지 않는다.
 * 저장·확정 요청과 수량 계산은 이 조회와 무관하다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export interface UomLookup {
  /** 코드를 모르면 `null` — 붙일 것이 없다는 뜻이다. */
  codeOf: (uomId: number | undefined) => string | null;
}

export const useUomLookup = (): UomLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['iqc-inspection', 'uoms'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
    },
    /* 권한이 없으면 몇 번을 다시 불러도 같다 — 되풀이하지 않는다. */
    retry: false,
    staleTime: Infinity,
  });

  return {
    codeOf: (uomId) => (uomId === undefined ? null : (query.data?.get(uomId) ?? null)),
  };
};

/** 「10」 → 「10 EA」. 단위를 모르면 숫자만 둔다. */
export const withUom = (value: string, code: string | null): string =>
  code === null ? value : `${value} ${code}`;

import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 수량 뒤에 붙일 단위 코드(예: 10 EA) — 사용자 지시 2026-09-19.
 *
 * 응답은 `uomId`(숫자)만 싣는다. 이름은 단위 목록에서 푼다. 한 쪽만 받으면 뒤쪽 단위가 풀리지
 * 않으므로 서버 상한(200)으로 받는다. ⛔ 못 풀면 숫자 식별자를 붙이지 않고 수량만 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 모듈을 참조하지 않는다(저장소 관례).
 */
export const useUomCodeOf = (): ((uomId: number | null) => string | null) => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['lot-status-history', 'uoms'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true, size: 200 } } }),
      );
      return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
    },
  });

  return (uomId) => (uomId === null ? null : (query.data?.get(uomId) ?? null));
};

/** 「10 EA」. 단위를 모르면 수량만. */
export const withUom = (quantity: string, uomCode: string | null): string =>
  uomCode === null ? quantity : `${quantity} ${uomCode}`;

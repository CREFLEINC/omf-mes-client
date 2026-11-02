import { useQuery } from '@tanstack/react-query';

import type { InspectionInsightFilters } from './filters';
import { useInspectionResults } from './queries';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 검사 실적 요약 수량의 단위(예: EA) — 사용자 지시 2026-10-30 · #217.
 *
 * ⚠ 요약 응답에는 단위가 없다. 여러 품목을 합친 수량은 단위가 섞일 수 있어 짐작해 붙이지 않는다 — 품목 조건으로 한 품목만
 * 볼 때 그 품목의 기본 단위를 붙인다. 못 풀면 null(수량만 보인다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 모듈을 참조하지 않는다(저장소 관례).
 */
export const useItemUomCode = (itemId: string): string | null => {
  const { client } = useApiClient();
  const id = Number(itemId);
  const hasItem = itemId !== '' && Number.isSafeInteger(id) && id > 0;
  const item = useQuery({
    queryKey: ['inspection-result-insights', 'item', id],
    enabled: hasItem,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId: id } } })),
  });
  const uomCodeOf = useUomCodeOf(hasItem);

  if (!hasItem || item.data === undefined) return null;
  return uomCodeOf(item.data.item.baseUomId);
};

/**
 * 단위 번호 → 코드(예: 1 → EA). 검사 결과 줄은 `uomId` 를 싣는다 — 목록의 수량 칸 뒤에 붙인다(사용자 2026-10-30).
 * 못 풀면 null(수량만 보인다). 서버 상한(200)으로 한 번에 받는다.
 */
export const useUomCodeOf = (isEnabled = true): ((uomId: number | undefined) => string | null) => {
  const { client } = useApiClient();
  const uoms = useQuery({
    queryKey: ['inspection-result-insights', 'uoms'],
    enabled: isEnabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true, size: 200 } } }),
      );
      return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
    },
  });

  return (uomId) => (uomId === undefined ? null : (uoms.data?.get(uomId) ?? null));
};

/** 한 유형 모집단의 결과를 한 번에 볼 수 있는 상한 — 이보다 많으면 단위가 하나인지 알 수 없어 붙이지 않는다. */
const UNIFORM_SAMPLE_SIZE = 100;

/**
 * 요약 · 추이 수량의 단위(사용자 2026-11-02). 요약 응답에는 단위가 없다 —
 *  ① 품목 조건으로 한 품목만 보면 그 품목의 기본 단위,
 *  ② 아니면 그 조건의 검사 결과가 모두 한 단위일 때 그 단위(결과가 100건 이하라 다 볼 수 있을 때만),
 *  ③ 단위가 섞였거나 확인할 수 없으면 null(수량만).
 */
export const usePopulationUomCode = (
  filters: InspectionInsightFilters,
  isEnabled: boolean,
): string | null => {
  const itemUnit = useItemUomCode(filters.itemId);
  const sample = useInspectionResults(
    filters,
    'inspectedAt,desc',
    1,
    isEnabled && filters.itemId === '' && filters.lotNo.trim() === '',
    undefined,
    UNIFORM_SAMPLE_SIZE,
  );
  /* 단위 목록은 단위를 고를 결과가 있을 때만 부른다 — 조회할 수 없는 조건이면 요청을 내지 않는다. */
  const uomCodeOf = useUomCodeOf((sample.data?.items.length ?? 0) > 0);
  if (itemUnit !== null) return itemUnit;
  const data = sample.data;
  if (data === undefined || data.items.length === 0 || data.page.total > data.items.length)
    return null;
  const units = new Set(data.items.map((item) => item.uomId));
  return units.size === 1 ? uomCodeOf([...units][0]) : null;
};

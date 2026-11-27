import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';

/** 재고 현황 표 · 상세가 이름으로 보이는 코드 묶음(서버 코드 목록 `GET /mdm/code-values`). */
const GROUPS = {
  quality: 'LOT_STATUS',
  inventory: 'INVENTORY_STATUS',
  ownership: 'OWNERSHIP_TYPE',
} as const;

export type StockCodeKind = keyof typeof GROUPS;

/** 코드 → 이름. 이름을 못 찾거나 못 받으면 코드를 그대로 보인다. */
export type StockCodeNames = Record<StockCodeKind, (code: string) => string>;

/**
 * 품질 상태 · 재고 상태 · 소유 구분을 영어 코드 대신 한국어 이름으로(사용자 지시 2026-11-27 · omf-all-around#360).
 * 이름은 서버 코드 목록 그대로 — 사용 중지된 코드로 남은 재고도 있어 중지까지 받는다(창고 배치도 재고 표와 같다).
 */
export const useStockCodeNames = (): StockCodeNames => {
  const { client } = useApiClient();
  const kinds = Object.keys(GROUPS) as StockCodeKind[];
  const results = useQueries({
    queries: kinds.map((kind) => ({
      queryKey: ['stock-status', 'code-names', GROUPS[kind]] as const,
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: GROUPS[kind], includeInactive: true, size: 100 } },
          }),
        ),
      staleTime: 5 * 60_000,
    })),
  });

  const entries = kinds.map((kind, index) => {
    const names = new Map(
      (results[index]?.data?.items ?? []).map((value) => [
        value.code,
        masterName(value, value.codeName),
      ]),
    );
    return [kind, (code: string) => names.get(code) ?? code] as const;
  });

  return Object.fromEntries(entries) as StockCodeNames;
};

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { Mold, OperationPolicyEffective } from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const toolUsageKeys = {
  all: ['tool-usage'] as const,
  /** 툴 조회 전체 — 저장 뒤 누계를 다시 읽을 때 이 앞자리로 한 번에 무효화한다. */
  tools: ['tool-usage', 'tool-by-code'] as const,
  toolByCode: (code: string) => ['tool-usage', 'tool-by-code', code] as const,
  policy: (policyCode: string) => ['tool-usage', 'policy', policyCode] as const,
};

/**
 * 스캔한 코드로 툴을 찾는다.
 *
 * ⭐ **정확히 일치하는 것만 고른다.** 계약의 `q` 는 부분 일치 검색이라 `MLD-02` 를 찍으면
 * `MLD-020`·`MLD-021` 이 함께 온다 — 첫 줄을 집으면 **찍지 않은 툴에 실적을 단다.** 스캐너가
 * 준 값은 코드 전체이므로, 받은 목록에서 코드가 그대로 같은 것만 고르고 없으면 없다고 말한다.
 *
 * ⚠ **코드는 공장 안에서만 유일하다**(계약 `uq_mold(plant_id, mold_code)`). 이 화면은 아직
 * 공장을 진입 컨텍스트로 받지 못해 좁히지 못한다 — 여러 공장에서 같은 코드가 오면 그 사실을
 * 화면이 알 수 없으므로, **둘 이상이면 고르지 않고 없는 것으로 다룬다**(아래 판정).
 */
const TOOL_SEARCH_SIZE = 20;

export interface ToolLookup {
  /** 코드가 그대로 같은 툴. 없거나 가릴 수 없으면 `null` */
  tool: Mold | null;
}

export const useToolByCode = (code: string): UseQueryResult<ToolLookup> => {
  const { client } = useApiClient();
  const trimmed = code.trim();

  return useQuery({
    queryKey: toolUsageKeys.toolByCode(trimmed),
    enabled: trimmed !== '',
    queryFn: async (): Promise<ToolLookup> => {
      const response = await runRequest(() =>
        client.GET('/mdm/molds', { params: { query: { q: trimmed, size: TOOL_SEARCH_SIZE } } }),
      );

      const exact = response.items.filter((item) => item.moldCode === trimmed);

      return { tool: exact.length === 1 ? (exact[0] ?? null) : null };
    },
  });
};

/**
 * 이 범위에 적용되는 운영 정책 한 건.
 *
 * ⭐ **범위 해석을 서버가 한다** — 화면이 우선순위(품목 → 공정 → 공장 → 사업부 → 전체)를 다시
 * 구현하지 않는다. 계약이 그렇게 못박았고, 화면마다 다시 구현하면 설정 화면의 미리보기와
 * 계산하는 쪽이 서로 다른 답을 낸다.
 *
 * ⚠ **범위 축을 비워 부른다.** 이 화면이 아는 범위 축이 아직 없다 — 진입 컨텍스트가 공장·품목을
 * 싣게 되면 그 값을 여기 더한다. 비운 축은 계약이 「지정 없음」으로 친다.
 */
export const useOperationPolicy = (
  policyCode: 'SHOT_CONVERSION_ENABLED' | 'SHOT_CONVERSION_RATIO',
): UseQueryResult<OperationPolicyEffective> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: toolUsageKeys.policy(policyCode),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/operation-policies/effective', { params: { query: { policyCode } } }),
      ),
  });
};

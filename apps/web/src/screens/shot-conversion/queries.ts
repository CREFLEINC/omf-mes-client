import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  POLICY_CODES,
  type Mold,
  type OperationPolicy,
  type OperationPolicyEffective,
  type PageMeta,
  type PolicyCode,
  type PolicyFilters,
} from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface PolicyListResponse {
  items: OperationPolicy[];
  page: PageMeta;
}

/** 한 정책 코드의 행 수 상한. 넘으면 잘리고, 잘렸다는 사실을 화면이 말한다. */
export const POLICY_PAGE_SIZE = 200;

export const policyKeys = {
  all: ['operation-policies'] as const,
  list: (policyCode: PolicyCode, effectiveOn: string) =>
    ['operation-policies', 'list', policyCode, effectiveOn] as const,
  detail: (operationPolicyId: number) =>
    ['operation-policies', 'detail', operationPolicyId] as const,
  effective: (policyCode: PolicyCode, scope: Record<string, number>, on: string) =>
    ['operation-policies', 'effective', policyCode, scope, on] as const,
};

/**
 * 한 정책 코드의 목록.
 *
 * ⭐ **코드로 좁혀 부른다** — 같은 표를 다른 화면도 쓰므로, 좁히지 않으면 남의 정책이
 * 이 화면의 표에 섞인다.
 *
 * ⚠ **기준일을 비우면 끝난 것까지 함께 온다**(계약). 그것이 기본이다 — 끝낸 정책을 감추면
 * **왜 지금 값이 이것인지**를 되짚을 수 없고, 이 화면에는 지우는 길이 없어 끝난 것이 곧
 * 이력이다.
 */
export const usePolicyList = (
  policyCode: PolicyCode,
  filters: PolicyFilters,
): UseQueryResult<PolicyListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: policyKeys.list(policyCode, filters.effectiveOn),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/operation-policies', {
          params: {
            query: {
              policyCode,
              ...(filters.effectiveOn === '' ? {} : { effectiveOn: filters.effectiveOn }),
              size: POLICY_PAGE_SIZE,
            },
          },
        }),
      ),
  });
};

/** 비율 정책 목록. 이 화면의 표가 그리는 것이다. */
export const useRatioPolicies = (filters: PolicyFilters): UseQueryResult<PolicyListResponse> =>
  usePolicyList(POLICY_CODES.ratio, filters);

/**
 * 환산 사용 여부 정책.
 *
 * ⚠ **기준일을 비워 부른다** — 끝난 것까지 함께 받아야 「정한 적이 있는가」를 알 수 있다.
 * 지금 유효한 것만 받으면 **끝난 정책과 정한 적 없는 것이 같아 보인다.**
 */
export const useEnabledPolicies = (): UseQueryResult<PolicyListResponse> =>
  usePolicyList(POLICY_CODES.enabled, { effectiveOn: '' });

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export interface LookupEntry {
  value: string;
  label: string;
}

export interface LookupResult {
  entries: LookupEntry[];
  truncated: boolean;
  isError: boolean;
}

const NO_ENTRIES: LookupEntry[] = [];

/**
 * 범위 축의 이름 풀이.
 *
 * ⭐ **네 축을 한 훅으로 받지 않는다** — 각자 다른 경로이고 실패도 따로 난다. 한 덩어리로
 * 묶으면 하나가 실패했을 때 넷이 함께 빈다.
 *
 * `includeInactive` 를 켜 둔다 — 미사용 값을 가리키는 정책을 열면 이름이 비어 보인다.
 */
const useLookup = (
  key: string,
  path: '/mdm/items' | '/mdm/processes' | '/mdm/plants' | '/mdm/business-units',
  toEntry: (row: never) => LookupEntry,
): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['lookups', key] as const,
    queryFn: () =>
      runRequest(() => client.GET(path, { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries: data?.items.map((row) => toEntry(row as never)) ?? NO_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
  };
};

export const useItemLookup = (): LookupResult =>
  useLookup(
    'items',
    '/mdm/items',
    (row: { itemId: number; itemCode: string; itemName: string }) => ({
      value: String(row.itemId),
      label: `${row.itemCode} · ${row.itemName}`,
    }),
  );

export const useProcessLookup = (): LookupResult =>
  useLookup(
    'processes',
    '/mdm/processes',
    (row: { processId: number; processCode: string; processName: string }) => ({
      value: String(row.processId),
      label: `${row.processCode} · ${row.processName}`,
    }),
  );

export const usePlantLookup = (): LookupResult =>
  useLookup('plants', '/mdm/plants', (row: { plantId: number; plantName: string }) => ({
    value: String(row.plantId),
    label: row.plantName,
  }));

export const useBusinessUnitLookup = (): LookupResult =>
  useLookup(
    'business-units',
    '/mdm/business-units',
    (row: { businessUnitId: number; businessUnitName: string }) => ({
      value: String(row.businessUnitId),
      label: row.businessUnitName,
    }),
  );

/**
 * 이 범위에 **결국 무엇이 적용되는가.**
 *
 * ⛔ **범위 해석을 화면이 다시 구현하지 않는다**(스펙 §5-2 · 공유계약 B-17) — 네 축이 전부
 * 비어 있을 수 있어 여러 정책이 동시에 맞는데, 그 판정을 화면이 다시 짜면 **같은 표가
 * 화면마다 다르게 읽힌다.** 서버가 답과 «그 근거»(`matchedScopeCode`)를 함께 준다.
 *
 * ⚠ **비운 축은 「지정 없음」으로 친다**(계약) — 안 보내는 것과 비워 보내는 것이 같다.
 */
export const useEffectivePolicy = (
  scope: { itemId: number | null; processId: number | null },
  enabled: boolean,
): UseQueryResult<OperationPolicyEffective> => {
  const { client } = useApiClient();
  const query = {
    ...(scope.itemId === null ? {} : { itemId: scope.itemId }),
    ...(scope.processId === null ? {} : { processId: scope.processId }),
  };

  return useQuery({
    queryKey: policyKeys.effective(POLICY_CODES.ratio, query, ''),
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/operation-policies/effective', {
          params: { query: { policyCode: POLICY_CODES.ratio, ...query } },
        }),
      ),
  });
};

/** 미리보기가 캐비티 수를 읽을 툴 목록. */
export const useToolLookup = (): UseQueryResult<{ items: Mold[]; page: PageMeta }> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['lookups', 'molds'] as const,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/molds', { params: { query: { includeInactive: true } } })),
  });
};

/**
 * 정책 상세 — **잠금 토큰을 얻는 자리다.**
 *
 * ⭐ 이 조회의 응답 `ETag` 가 수정 요청의 `If-Match` 가 된다. 계약이 처음에는 그것을 빠뜨려
 * 「마지막 저장이 이긴다」로 만들었다가, 설계 회신으로 형제 자원과 같은 형태가 됐다
 * (`omf-mes#210` · 변경 통지 client#387).
 *
 * ⛔ **토큰은 «상세» 경로에 보관된다** — 쓰기 경로로 꺼내면 늘 비어 있다.
 */
export const useOperationPolicy = (
  operationPolicyId: number | null,
): UseQueryResult<OperationPolicy> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: policyKeys.detail(operationPolicyId ?? 0),
    enabled: operationPolicyId !== null,
    queryFn: () => {
      if (operationPolicyId === null) {
        throw new Error('정책을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/operation-policies/{operationPolicyId}', {
          params: { path: { operationPolicyId } },
        }),
      );
    },
  });
};

/** 잠금 토큰이 보관된 경로. **쓰기 경로로 꺼내면 늘 비어 있다.** */
export const policyDetailPath = (operationPolicyId: number): string =>
  `/app/operation-policies/${String(operationPolicyId)}`;

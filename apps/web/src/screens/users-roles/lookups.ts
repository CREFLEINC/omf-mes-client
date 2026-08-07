import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * FK로 이어진 값을 채우는 선택 목록. **지어내는 것이 아니라 실제로 조회한다** —
 * 자리표시로 두는 것은 값 목록이 확정되지 않은 코드뿐이다(`code-options.ts`).
 *
 * 전부 `includeInactive=true`로 한 번 받아 두고 표시 규칙은 화면이 정한다.
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 값을 참조하는 행을 열면 이름이 비어 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다 */
  truncated: boolean;
  /** 조회가 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다 */
  isError: boolean;
  /**
   * 실패의 원인. **선택 목록이 곧 그 구획의 내용인 자리**(역할 부여)에서는 이 실패가
   * 보조 안내가 아니라 조회 실패 그 자체라 배너에 사유를 실어야 한다.
   */
  error: unknown;
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
  isLoading: boolean;
}

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택 목록의 캐시 키.
 *
 * **밖으로 낸다** — 이 목록의 내용을 바꾸는 쓰기가 다른 탭에 있기 때문이다.
 * 역할을 만들거나 고치거나 중지하는 것은 역할·권한 탭에서 일어나는데, 그 결과가 보이는 자리는
 * 사용자 탭의 역할 부여 확인칸이다. 무효화하는 쪽이 키를 알지 못하면 그 목록이 낡은 채로 남는다.
 */
export const lookupKeys = {
  departments: ['users-roles-lookups', 'departments'] as const,
  roles: ['users-roles-lookups', 'roles'] as const,
  businessUnits: ['users-roles-lookups', 'business-units'] as const,
  plants: ['users-roles-lookups', 'plants'] as const,
};

/**
 * 부서 — 목록 필터의 부서 조건과 사용자 정보 폼의 부서 선택지가 함께 쓴다.
 *
 * **좌 목록의 조회 조건과 무관한 전체 목록이다.** 쪽 나눔 때문에 찾는 부서가 다른 쪽에
 * 있을 수 있어 보이는 목록만으로는 고를 수 없다.
 */
export const useDepartmentOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.departments,
    // 쓰지 않는 상태에서 부르면 어느 요청이 무엇인지 가릴 수 없다.
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/departments', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.departmentId),
        label: `${item.departmentCode} · ${item.departmentName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    isLoading: query.isPending,
  };
};

/**
 * 역할 — 역할 부여 확인칸 목록이 쓴다.
 *
 * **`includeInactive=true`로 받는다.** 기본 조회는 사용 중인 것만 내려주는데, 미사용 역할이
 * 이미 부여돼 있으면 그 부여가 이름 없이 보이고 저장할 때 조용히 회수된다.
 * 「무엇을 남기고 무엇을 잠글 것인가」는 `role-assign-draft.ts`가 정한다.
 */
export const useRoleOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.roles,
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/app/roles', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.roleId),
        label: `${item.roleCode} · ${item.roleName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    isLoading: query.isPending,
  };
};

/** 사업부 — 접근범위의 한 축. */
export const useBusinessUnitOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.businessUnits,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/business-units', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.businessUnitId),
        label: `${item.businessUnitCode} · ${item.businessUnitName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    isLoading: query.isPending,
  };
};

/**
 * 공장 — 접근범위의 다른 축.
 *
 * **사업부로 좁혀 받지 않는다.** 계약이 두 축을 각각 독립으로 두었고(둘 중 하나만 골라도 된다),
 * 좁혀 받으면 사업부를 비운 상태에서 고를 수 있는 공장이 하나도 없게 된다.
 */
export const usePlantOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.plants,
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.plantId),
        label: `${item.plantCode} · ${item.plantName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    isLoading: query.isPending,
  };
};

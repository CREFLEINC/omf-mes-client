import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toRoleListQuery } from './filters';
import type { PageMeta, Role, RoleFilters } from './types';

type RoleDetailResponse = components['schemas']['RoleDetailResponse'];
type RolePermissionListResponse = components['schemas']['RolePermissionListResponse'];

/**
 * 역할의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 *
 * **사용자 탭의 역할 선택 목록(`lookups.ts`)과 키가 다르다.** 그쪽은 부여할 역할을 고르는
 * 목록이라 언제나 `includeInactive=true`로 통째로 받고, 이쪽은 조건으로 좁혀 보는 목록이다 —
 * 같은 경로를 부르지만 조회 목적이 달라 캐시를 나눈다.
 */

export interface RoleListResponse {
  items: Role[];
  page: PageMeta;
}

export const roleKeys = {
  all: ['users-roles-roles'] as const,
  list: (filters: RoleFilters, page: number) => ['users-roles-roles', 'list', filters, page] as const,
  detail: (roleId: number) => ['users-roles-roles', 'detail', roleId] as const,
  /**
   * 기능 권한 부여분. **이번에 치환을 부르지 않으므로 무효화할 일이 없다** —
   * 키를 두는 것은 조회를 다른 것과 섞지 않기 위해서다.
   */
  permissions: (roleId: number) => ['users-roles-roles', 'permissions', roleId] as const,
};

/**
 * 역할 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 쿼리 구성 규칙(빈 값·꺼진 확인칸·첫 쪽을 싣지 않고 **부서를 싣지 않는다**)은 `filters.ts`가 갖는다.
 */
export const useRoleList = (
  filters: RoleFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<RoleListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: roleKeys.list(filters, page),
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/app/roles', { params: { query: toRoleListQuery(filters, page) } })),
  });
};

/**
 * `ETag`가 보관된 경로. 쓰기의 `If-Match`는 **언제나 이 경로**에서 꺼낸다.
 *
 * 보관 키가 요청 경로라 `…:deactivate` 같은 액션 경로로 꺼내면 **항상 비어 있고**
 * 사용 중지가 통째로 실패한다.
 */
export const roleDetailPath = (roleId: number): string => `/app/roles/${String(roleId)}`;

/**
 * 역할 상세. 낙관적 잠금 토큰(`ETag`)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useRoleDetail = (roleId: number | null): UseQueryResult<RoleDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: roleKeys.detail(roleId ?? 0),
    enabled: roleId !== null,
    queryFn: () => {
      if (roleId === null) {
        throw new Error('역할을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/app/roles/{roleId}', { params: { path: { roleId } } }));
    },
  });
};

/**
 * 이 역할에 부여된 기능 권한.
 *
 * **조회만 한다.** 치환(`PUT`)은 권한 목록이 확정되기 전까지 부르지 않는다(계획 결정 5) —
 * 고를 수 있는 값이 하나도 없는 상태에서 최종 상태를 보내면 가진 권한을 지우게 된다.
 *
 * **쪽 나눔이 없다** — 계약이 `items`만 준다.
 */
export const useRolePermissions = (
  roleId: number | null,
): UseQueryResult<RolePermissionListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: roleKeys.permissions(roleId ?? 0),
    enabled: roleId !== null,
    queryFn: () => {
      if (roleId === null) {
        throw new Error('역할을 고르기 전에는 기능 권한을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/roles/{roleId}/permissions', { params: { path: { roleId } } }),
      );
    },
  });
};

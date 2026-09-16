import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toRoleListQuery } from './filters';
import type { PageMeta, Role, RoleFilters } from './types';

type RoleDetailResponse = components['schemas']['RoleDetailResponse'];
type RolePermissionListResponse = components['schemas']['RolePermissionListResponse'];
type PermissionListResponse = components['schemas']['PermissionListResponse'];

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
  /** 이 역할에 부여된 기능 권한. 치환이 성공하면 이 키만 무효화한다. */
  permissions: (roleId: number) => ['users-roles-roles', 'permissions', roleId] as const,
  /**
   * 부여할 수 있는 **후보** 전부. 역할과 무관한 앱 기능 목록이라 역할 키 아래 두지 않는다 —
   * 역할을 바꿔 고를 때마다 다시 받게 된다.
   */
  permissionCatalog: ['users-roles-permission-catalog'] as const,
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
 * **이것만으로는 권한을 «줄» 수 없다** — 응답이 「이미 부여된 것」뿐이라 부여가 0건인 역할은
 * 열이 하나도 서지 않는다. 고를 수 있는 후보는 `usePermissionCatalog` 가 받는다.
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

/**
 * 부여할 수 있는 기능 권한 **후보 전부** — 격자의 열을 만드는 목록이다.
 *
 * ⭐ **역할을 고르기 전에도 받는다.** 앱 기능 목록이라 역할과 무관하고, 역할을 바꿀 때마다
 * 다시 받으면 큰 목록이 매번 오간다. 캐시 키에 역할이 들어가지 않는 것도 그래서다.
 *
 * ⛔ **쪽을 나누지 않는다** — 계약이 `items` 만 준다. 목록이 화면 수만큼으로 닫혀 있고,
 * 쪽이 나뉘면 둘째 쪽을 못 받았을 때 격자에서 열이 조용히 사라진다.
 *
 * ⛔ **`GET /mdm/code-values` 로 부르지 않는다** — 공통코드가 아니다. 고객이 늘리거나 지울 수
 * 없는 앱 기능 목록이고, 화면이 늘면 배포로 는다.
 */
export const usePermissionCatalog = (): UseQueryResult<PermissionListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: roleKeys.permissionCatalog,
    queryFn: () => runRequest(() => client.GET('/app/permissions')),
  });
};

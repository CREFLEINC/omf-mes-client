import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toUserListQuery } from './filters';
import type { AppUser, PageMeta, UserFilters } from './types';

type AppUserDetailResponse = components['schemas']['AppUserDetailResponse'];
type UserRoleListResponse = components['schemas']['UserRoleListResponse'];
type UserDataScopeListResponse = components['schemas']['UserDataScopeListResponse'];

/**
 * 사용자의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface UserListResponse {
  items: AppUser[];
  page: PageMeta;
}

/**
 * 사용자의 캐시 키.
 *
 * `all`을 무효화하면 목록·상세가 함께 다시 조회된다 — 사용 중지 응답에는 `ETag`가 없어서
 * 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const userKeys = {
  all: ['users-roles-users'] as const,
  list: (filters: UserFilters, page: number) =>
    ['users-roles-users', 'list', filters, page] as const,
  detail: (appUserId: number) => ['users-roles-users', 'detail', appUserId] as const,
  /**
   * 부여분은 **자기 키만** 무효화한다.
   *
   * `all`을 무효화하면 상세까지 다시 조회되고, 그 응답 객체가 갈리면 **바로 위 칸에서
   * 편집 중이던 사용자 정보 폼이 서버 값으로 되돌아간다.** 역할·접근범위 치환은
   * 사용자 행을 바꾸지 않으므로(잠금 토큰도 그대로다) 상세를 다시 부를 이유가 없다.
   */
  roles: (appUserId: number) => ['users-roles-users', 'roles', appUserId] as const,
  dataScopes: (appUserId: number) => ['users-roles-users', 'data-scopes', appUserId] as const,
};

/**
 * 사용자 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 계약에 필수 쿼리가 없어 화면에 들어오는 즉시 조회한다(선택을 기다리지 않는다).
 * 쿼리 구성 규칙(빈 값·꺼진 확인칸·첫 쪽·상태 코드를 싣지 않는다)은 `filters.ts`가 갖는다.
 */
export const useUserList = (
  filters: UserFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<UserListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: userKeys.list(filters, page),
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/app/users', { params: { query: toUserListQuery(filters, page) } })),
  });
};

/**
 * `ETag`가 보관된 경로. 쓰기의 `If-Match`는 **언제나 이 경로**에서 꺼낸다.
 *
 * 보관 키가 요청 경로라 `…:deactivate` 같은 액션 경로로 꺼내면 **항상 비어 있고**
 * 사용 중지가 통째로 실패한다.
 */
export const userDetailPath = (appUserId: number): string => `/app/users/${String(appUserId)}`;

/**
 * 사용자 상세. 낙관적 잠금 토큰(`ETag`)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useUserDetail = (appUserId: number | null): UseQueryResult<AppUserDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: userKeys.detail(appUserId ?? 0),
    enabled: appUserId !== null,
    queryFn: () => {
      if (appUserId === null) {
        throw new Error('사용자를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/users/{appUserId}', { params: { path: { appUserId } } }),
      );
    },
  });
};

/**
 * 이 사용자에게 부여된 역할.
 *
 * **쪽 나눔이 없다** — 계약이 `items`만 준다. 부여분은 사용자 하나에 매인 목록이라
 * 전부 받아야 「최종 상태 전체」를 되돌려 보낼 수 있다.
 */
export const useUserRoles = (appUserId: number | null): UseQueryResult<UserRoleListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: userKeys.roles(appUserId ?? 0),
    enabled: appUserId !== null,
    queryFn: () => {
      if (appUserId === null) {
        throw new Error('사용자를 고르기 전에는 부여분을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/users/{appUserId}/roles', { params: { path: { appUserId } } }),
      );
    },
  });
};

/** 이 사용자에게 지정된 데이터 접근범위. 부여분과 같이 **쪽 나눔이 없다.** */
export const useUserDataScopes = (
  appUserId: number | null,
): UseQueryResult<UserDataScopeListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: userKeys.dataScopes(appUserId ?? 0),
    enabled: appUserId !== null,
    queryFn: () => {
      if (appUserId === null) {
        throw new Error('사용자를 고르기 전에는 접근범위를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/users/{appUserId}/data-scopes', { params: { path: { appUserId } } }),
      );
    },
  });
};

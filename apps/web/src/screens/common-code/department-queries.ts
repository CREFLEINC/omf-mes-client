import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toDepartmentListQuery } from './filters';
import type { Department, PageMeta, ScopedFilters } from './types';

type DepartmentDetailResponse = components['schemas']['DepartmentDetailResponse'];

/**
 * 부서의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface DepartmentListResponse {
  items: Department[];
  page: PageMeta;
}

/**
 * 부서의 캐시 키.
 *
 * `all`을 무효화하면 목록·상세·상위 선택지가 함께 다시 조회된다 — 사용 중지 응답에는
 * `ETag`가 없어서 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const departmentKeys = {
  all: ['common-code-departments'] as const,
  list: (filters: ScopedFilters, page: number) =>
    ['common-code-departments', 'list', filters, page] as const,
  detail: (departmentId: number) => ['common-code-departments', 'detail', departmentId] as const,
  /** 상위 선택지·작업자 필터가 쓰는 전체 목록. 조회 조건과 무관하다 */
  options: ['common-code-departments', 'options'] as const,
};

/**
 * 부서 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 계약에 필수 쿼리가 없어 탭에 들어오는 즉시 조회한다(선택을 기다리지 않는다).
 * 쿼리 구성 규칙(빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다)은 `filters.ts`가 갖는다.
 */
export const useDepartmentList = (
  filters: ScopedFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<DepartmentListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: departmentKeys.list(filters, page),
    // 다른 탭에 있는 동안에는 조회하지 않는다 — 보이지 않는 목록을 받아 둘 이유가 없다.
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/departments', {
          params: { query: toDepartmentListQuery(filters, page) },
        }),
      ),
  });
};

/**
 * ETag가 보관된 경로. 쓰기의 If-Match는 **언제나 이 경로**에서 꺼낸다.
 * 보관 키가 요청 경로라 `...:deactivate` 같은 액션 경로로 꺼내면 항상 비어 있다.
 */
export const departmentDetailPath = (departmentId: number): string =>
  `/mdm/departments/${String(departmentId)}`;

/**
 * 부서 상세. 낙관적 잠금 토큰(ETag)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useDepartmentDetail = (
  departmentId: number | null,
): UseQueryResult<DepartmentDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: departmentKeys.detail(departmentId ?? 0),
    enabled: departmentId !== null,
    queryFn: () => {
      if (departmentId === null) {
        throw new Error('부서를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/departments/{departmentId}', { params: { path: { departmentId } } }),
      );
    },
  });
};

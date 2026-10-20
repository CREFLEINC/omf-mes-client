import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 거래처 조회 (ERP)의 읽기. 경로 리터럴은 이 파일에만 둔다 —
 * `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 쓰기 경로는 없다. 거래처 본체와 역할은 ERP 수신본이다(역할 치환은 기준정보 화면의 몫).
 */

export type Partner = components['schemas']['Partner'];
export type PartnerRole = components['schemas']['PartnerRole'];
export type PartnerRoleCode = PartnerRole['roleTypeCode'];
export type PageMeta = components['schemas']['PageMeta'];

export interface PartnerListResult {
  items: Partner[];
  page: PageMeta;
}

/** 값이 있을 때만 키가 실린다 — 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽힌다. */
export interface PartnerListQuery {
  q?: string;
  roleTypeCode?: PartnerRoleCode;
  includeInactive?: boolean;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
}

export const partnerKeys = {
  all: ['erp-partner'] as const,
  list: (query: PartnerListQuery) => ['erp-partner', 'list', query] as const,
  detail: (id: number | null) => ['erp-partner', 'detail', id] as const,
  roles: (id: number) => ['erp-partner', 'roles', id] as const,
};

export const usePartnerList = (query: PartnerListQuery): UseQueryResult<PartnerListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: partnerKeys.list(query),
    queryFn: () => runRequest(() => client.GET('/mdm/partners', { params: { query } })),
  });
};

/** 거래처 한 건. 고르기 전에는 조회하지 않는다 — 들어오기만 해도 부르면 쓰지 않는 요청이 나간다. */
export const usePartnerDetail = (id: number | null): UseQueryResult<Partner> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: partnerKeys.detail(id),
    enabled: id !== null,
    queryFn: () => {
      if (id === null) {
        throw new Error('거래처를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/partners/{partnerId}', { params: { path: { partnerId: id } } }),
      );
    },
  });
};

/** 한 거래처의 역할 상태. 표 칸과 상세가 같은 모양을 읽는다. */
export type RolesState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; roles: PartnerRole[] };

/**
 * 보이는 행들의 역할. 목록 응답(`Partner`)에 역할이 없어 행마다 역할 경로를 부른다.
 *
 * ⚠ 쪽마다 행 수만큼 요청이 나간다(N+1). 목록 응답이 역할을 함께 실어 주면 이 조회는 사라진다 —
 * 서버가 줄 때까지의 우회다. 역할은 ERP 연동 때만 바뀌므로 캐시를 오래 둔다.
 */
export const usePartnerRoles = (ids: readonly number[]): ReadonlyMap<number, RolesState> => {
  const { client } = useApiClient();

  return useQueries({
    queries: ids.map((id) => ({
      queryKey: partnerKeys.roles(id),
      staleTime: 5 * 60 * 1000,
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/partners/{partnerId}/roles', { params: { path: { partnerId: id } } }),
        ),
    })),
    combine: (results) =>
      new Map(
        results.map((result, index): [number, RolesState] => [
          ids[index] ?? -1,
          result.isError
            ? { kind: 'failed' }
            : result.data === undefined
              ? { kind: 'loading' }
              : { kind: 'ready', roles: result.data },
        ]),
      ),
  });
};

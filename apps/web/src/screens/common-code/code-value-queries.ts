import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { CodeValue, CodeValuePageMeta } from './code-value-types';

type CodeValueDetailResponse = components['schemas']['CodeValueDetailResponse'];

/**
 * **코드값 편집 한 벌**의 조회와 캐시 키.
 *
 * 이 파일은 다른 자원의 조회 모듈을 참조하지 않는다 — 한 벌을 통째로 옮길 수 있어야 한다.
 */

export interface CodeValueListResponse {
  items: CodeValue[];
  page: CodeValuePageMeta;
}

/** 서버로 보낼 조회 쿼리. 값이 없는 조건은 키 자체를 넣지 않는다. */
export interface CodeValueListQuery {
  codeGroupId: number;
  includeInactive?: boolean;
  page?: number;
}

/**
 * **`includeInactive=false`를 명시적으로 보내지 않는다.** 계약의 기본값이 false이고,
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 * 첫 쪽도 같은 이유로 싣지 않는다.
 *
 * **검색어를 두지 않는다.** 한 화면에 「그룹 찾기」와 「그룹 안에서 찾기」 두 검색칸이 생기면
 * 어느 쪽에 입력하는지 읽히지 않는다. 필요해지면 이 한 벌이 props로 받도록 넓힌다.
 */
export const toCodeValueListQuery = (
  codeGroupId: number,
  includeInactive: boolean,
  page: number,
): CodeValueListQuery => ({
  codeGroupId,
  ...(includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

/**
 * 코드값의 캐시 키.
 *
 * `all`을 무효화하면 목록·상세가 함께 다시 조회된다 — 사용 중지 응답에는 `ETag`가 없어서
 * 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const codeValueKeys = {
  all: ['common-code-values'] as const,
  list: (codeGroupId: number, includeInactive: boolean, page: number) =>
    ['common-code-values', 'list', codeGroupId, includeInactive, page] as const,
  detail: (codeValueId: number) => ['common-code-values', 'detail', codeValueId] as const,
};

/**
 * 코드값 목록. **코드그룹을 고르기 전에는 조회하지 않는다** —
 * 계약이 `codeGroupId`를 필수 쿼리로 두어 빼고 부르면 422다(계약 실측).
 */
export const useCodeValueList = (
  codeGroupId: number | null,
  includeInactive: boolean,
  page: number,
): UseQueryResult<CodeValueListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: codeValueKeys.list(codeGroupId ?? 0, includeInactive, page),
    enabled: codeGroupId !== null,
    queryFn: () => {
      if (codeGroupId === null) {
        throw new Error('코드그룹을 고르기 전에는 코드값 목록을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: toCodeValueListQuery(codeGroupId, includeInactive, page) },
        }),
      );
    },
  });
};

/**
 * ETag가 보관된 경로. 쓰기의 If-Match는 **언제나 이 경로**에서 꺼낸다.
 * 보관 키가 요청 경로라 `...:deactivate` 같은 액션 경로로 꺼내면 항상 비어 있다.
 */
export const codeValueDetailPath = (codeValueId: number): string =>
  `/mdm/code-values/${String(codeValueId)}`;

/**
 * 코드값 상세. 낙관적 잠금 토큰(ETag)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useCodeValueDetail = (
  codeValueId: number | null,
): UseQueryResult<CodeValueDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: codeValueKeys.detail(codeValueId ?? 0),
    enabled: codeValueId !== null,
    queryFn: () => {
      if (codeValueId === null) {
        throw new Error('코드값을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/code-values/{codeValueId}', { params: { path: { codeValueId } } }),
      );
    },
  });
};

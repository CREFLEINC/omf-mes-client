import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { isErpCodeGroup } from './erp-groups';

/**
 * 공통코드 조회 (ERP)의 읽기. 경로 리터럴은 이 파일에만 둔다 —
 * `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 쓰기 경로는 없다. ERP 그룹은 서버가 시스템 소유로 세워 화면에서 고칠 수도 없다.
 */

export type CodeGroup = components['schemas']['CodeGroup'];
export type CodeValue = components['schemas']['CodeValue'];
export type PageMeta = components['schemas']['PageMeta'];

export interface CodeValueListResult {
  items: CodeValue[];
  page: PageMeta;
}

/** 값이 있을 때만 키가 실린다 — 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽힌다. */
export interface CodeValueListQuery {
  codeGroupCode: string;
  q?: string;
  includeInactive?: boolean;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
}

export const erpCodeKeys = {
  all: ['erp-common-code'] as const,
  groups: ['erp-common-code', 'groups'] as const,
  values: (query: CodeValueListQuery) => ['erp-common-code', 'values', query] as const,
};

/** 서버가 한 쪽에 내주는 최대치. 더 크게 불러도 이 값으로 깎인다. */
const GROUP_PAGE_SIZE = 200;
/** 쪽을 넘기는 상한 — 서버가 total 을 잘못 주어도 끝없이 돌지 않게 한다. */
const MAX_GROUP_PAGES = 20;

/**
 * ERP 코드 그룹. 그룹 목록에는 출처 조건이 없어 전부 받아 화면이 ERP 여덟으로 거른다
 * (`erp-groups.ts` 참고). 그룹은 백여 개라 보통 한 번에 끝난다.
 *
 * 미사용 그룹도 받는다 — ERP 가 보낸 그룹이 꺼져 있으면 사라지는 대신 「미사용」으로 보여야 한다.
 */
export const useErpCodeGroups = (): UseQueryResult<CodeGroup[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpCodeKeys.groups,
    queryFn: async () => {
      const collected: CodeGroup[] = [];

      for (let page = 1; page <= MAX_GROUP_PAGES; page += 1) {
        const data = await runRequest(() =>
          client.GET('/mdm/code-groups', {
            params: {
              query: {
                includeInactive: true,
                size: GROUP_PAGE_SIZE,
                ...(page > 1 ? { page } : {}),
              },
            },
          }),
        );
        collected.push(...data.items);
        if (data.items.length === 0 || collected.length >= data.page.total) break;
      }

      return collected
        .filter((group) => isErpCodeGroup(group.groupCode))
        .sort((a, b) => a.groupCode.localeCompare(b.groupCode));
    },
  });
};

/** 고른 그룹의 코드값. 그룹을 고르기 전에는 조회하지 않는다 — 서버가 그룹 없는 조회를 400 으로 거절한다. */
export const useCodeValues = (
  query: CodeValueListQuery | null,
): UseQueryResult<CodeValueListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpCodeKeys.values(query ?? { codeGroupCode: '' }),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('그룹을 고르기 전에는 코드값을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/mdm/code-values', { params: { query } }));
    },
  });
};

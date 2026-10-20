import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { CodeValueOption } from './options';

/**
 * 코드 그룹의 값 목록 — 코드를 표시명으로 옮기는 데 쓴다.
 *
 * **값 목록을 화면이 적지 않는다.** 그룹은 이름(`codeGroupCode`)으로 가리킨다 —
 * 채번 식별자(`codeGroupId`)는 환경마다 달라 하드코딩할 수 없다(계약 omf-mes#179).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const CODE_GROUPS = {
  /** 품목 유형. 고객이 늘릴 수 있는 열린 목록이다 */
  itemType: 'ITEM_TYPE',
  /** 마스터 버전 상태(작성중·확정·폐기). 자재 명세서 헤더의 `statusCode`가 이 그룹이다 */
  masterVersionStatus: 'MASTER_VERSION_STATUS',
  /** MES 구분(신재·재생재). 품목의 `mesCategoryCode`가 이 그룹이다 */
  mesCategory: 'MES_CATEGORY',
} as const;

type CodeGroup = (typeof CODE_GROUPS)[keyof typeof CODE_GROUPS];

export const codeValueKeys = {
  all: ['item-extended-attrs-code-values'] as const,
  group: (codeGroupCode: CodeGroup, includeInactive: boolean) =>
    ['item-extended-attrs-code-values', codeGroupCode, includeInactive] as const,
};

/** 한 그룹의 값은 소수다 — 쪽을 넘기지 않고 한 번에 받는다. */
const CODE_VALUE_SIZE = 100;

export interface CodeValueQueryOptions {
  /** 이 목록을 쓸 자리가 보일 때만 받는다. 기본은 켜짐 */
  enabled?: boolean;
  /**
   * 미사용 코드값도 받는가. **표시명을 옮기는 자리는 켠다** — 사용을 멈춘 코드를 이미 들고 있는
   * 자료가 이름을 잃으면 안 된다. 고르는 자리(선택지)는 끈다 — 미사용 값을 새로 고르게 두지 않는다.
   */
  includeInactive?: boolean;
}

/**
 * 코드 그룹의 값 목록. 서버가 준 이름을 그대로 쓴다 — 화면이 표시명을 갖지 않는다.
 *
 * 실패해도 화면을 막지 않는다 — 부르는 쪽이 `codeValueName`으로 코드 그대로 물러난다.
 */
export const useCodeValueOptions = (
  codeGroupCode: CodeGroup,
  { enabled = true, includeInactive = false }: CodeValueQueryOptions = {},
): UseQueryResult<CodeValueOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: codeValueKeys.group(codeGroupCode, includeInactive),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode,
              size: CODE_VALUE_SIZE,
              // 계약의 기본값이 false라 끈 상태는 싣지 않는다 — 캐시 키가 갈리지 않게.
              ...(includeInactive ? { includeInactive: true } : {}),
            },
          },
        }),
      );

      return data.items.map((item) => ({ code: item.code, codeName: item.codeName }));
    },
  });
};

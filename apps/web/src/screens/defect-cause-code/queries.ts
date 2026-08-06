import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { CodeAdapter } from './adapters';
import type {
  CodeDetailResult,
  CodeFilters,
  CodeListResult,
  HierarchyCode,
  PageMeta,
} from './types';

/**
 * 이 화면이 쓰는 조회. 어댑터가 경로와 캐시 키를 들고 있으므로 훅은 리소스 이름을 알지 않는다.
 * 캐시 키 구성은 `adapters.ts`에 있고 `all`이 나머지의 접두라 한 번에 무효화된다.
 */

/**
 * 코드 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 계약에 필수 쿼리가 없어 화면에 들어오는 즉시 조회한다(선택을 기다리지 않는다).
 * `size`는 보내지 않고 서버 기본값을 따르며, 잘림은 `page.total`로 드러내 안내한다.
 */
export const useCodeList = (
  adapter: CodeAdapter,
  filters: CodeFilters,
): UseQueryResult<CodeListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: adapter.keys.list(filters),
    queryFn: () => adapter.fetchList(client, filters),
  });
};

/**
 * 코드 상세. 낙관적 잠금 토큰(ETag)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useCodeDetail = (
  adapter: CodeAdapter,
  id: number | null,
): UseQueryResult<CodeDetailResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: adapter.keys.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () => {
      if (id === null) {
        throw new Error('코드를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return adapter.fetchDetail(client, id);
    },
  });
};

/**
 * 받은 건수가 전체보다 적으면 목록이 잘린 것이다.
 * 이 화면이 갖는다 — 짧아도 다른 화면 슬라이스에서 가져오지 않는다.
 */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export interface CodeOptionsResult {
  items: HierarchyCode[];
  /** 목록이 잘렸으면 참. 고를 수 없는 상위가 생겼다는 뜻이다. */
  truncated: boolean;
  /** 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ITEMS: HierarchyCode[] = [];

/**
 * 상위 선택지와 계층 판정에 쓰는 전체 목록. `includeInactive=true`로 **따로** 조회한다.
 *
 * 화면의 조회 조건을 그대로 쓰면 「미사용 포함」이 꺼져 있을 때 미사용 대분류 밑의 상세 코드를
 * 고칠 수 없게 된다 — 계층 판정이 조회 조건에 끌려다니면 안 된다.
 *
 * 폼이 열려 있을 때만 조회한다. 목록과 같은 경로라, 화면에 들어오기만 해도 부르면
 * 쓰지 않는 요청이 한 번 더 나간다.
 */
export const useCodeOptions = (adapter: CodeAdapter, enabled: boolean): CodeOptionsResult => {
  const { client } = useApiClient();

  const options = useQuery({
    queryKey: adapter.keys.options,
    enabled,
    queryFn: () => adapter.fetchAllForOptions(client),
  });

  const data = options.data;

  return {
    items: data?.items ?? EMPTY_ITEMS,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: options.isError,
    // 꺼져 있는 동안에는 pending이지만 아무것도 기다리지 않는다.
    isLoading: enabled && options.isPending,
  };
};

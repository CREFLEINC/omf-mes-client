import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { CodeAdapter } from './adapters';
import type { CodeFilters, CodeListResult, PageMeta } from './types';

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
 * 받은 건수가 전체보다 적으면 목록이 잘린 것이다.
 * 이 화면이 갖는다 — 짧아도 다른 화면 슬라이스에서 가져오지 않는다.
 */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

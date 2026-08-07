import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * FK로 이어진 값을 채우는 선택 목록. **지어내는 것이 아니라 실제로 조회한다** —
 * 자리표시로 두는 것은 값 목록이 확정되지 않은 코드뿐이다(`code-catalog.ts`).
 *
 * 전부 `includeInactive=true`로 한 번 받아 두고 표시 규칙은 화면이 정한다.
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 값을 참조하는 행을 열면 이름이 비어 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다 */
  truncated: boolean;
  /** 조회가 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다 */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

const lookupKeys = {
  uoms: ['item-extended-attrs-lookups', 'uoms'] as const,
};

/**
 * 단위 — 원본 구획의 **기준 단위 이름**.
 *
 * `baseUomId`는 내부 식별자라 화면에 그대로 낼 수 없다. 이름으로 옮기고,
 * 옮길 수 없으면 「알 수 없음」을 낸다(`options.ts`의 `lookupLabel`).
 */
export const useUomOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.uoms,
    // 품목을 고르기 전에는 이 목록을 쓸 자리가 없다.
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.uomId),
        label: `${item.uomCode} · ${item.uomName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

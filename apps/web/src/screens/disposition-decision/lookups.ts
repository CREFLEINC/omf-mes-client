import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';
import { NONCONFORMANCE_STATUS_CODE_GROUP, SEVERITY_CODE_GROUP } from './disposition-codes';
import type { PageMeta } from './types';

export interface DispositionLookup extends LookupSource {
  entries: LookupEntry[];
  /** 목록이 잘렸다 — 이름을 못 찾은 것이 「없는 값」인지 「잘린 값」인지 가르는 데 쓴다. */
  truncated: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const toLookup = (
  data: { entries: LookupEntry[]; page: PageMeta } | undefined,
  isError: boolean,
  isLoading: boolean,
): DispositionLookup => ({
  entries: data?.entries ?? EMPTY_ENTRIES,
  truncated: data !== undefined && data.page.total > data.entries.length,
  isError,
  isLoading,
});

const nameOr = (value: string): string =>
  value.trim() === '' ? messages.common.reference.unknown : value;

/** 코드값 표시명 — 고른 언어의 다국어 컬럼이 먼저, 기본 이름이 fallback, 둘 다 비면 코드(G-33). */
const codeLabelOf = (value: {
  code: string;
  codeName: string;
  nameKo?: string | null;
  nameVi?: string | null;
}): string => masterName(value, value.codeName.trim() || value.code);

/**
 * 심각도·상태의 공통코드 조회(G-32). 비활성 값도 받는다 — 목록 셀은 지난 값의 이름도 보여야 하고,
 * 필터 선택지는 `codeOptionsOf` 가 활성 값만 고른다.
 */
const useCodeValueLookup = (group: string): DispositionLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['disposition-lookups', 'code-values', group],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: group, includeInactive: true } },
        }),
      );

      return {
        entries: [...data.items]
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((value) => ({
            value: value.code,
            label: codeLabelOf(value),
            isActive: value.isActive,
          })),
        page: data.page,
      };
    },
  });

  return toLookup(query.data, query.isError, query.isPending);
};

export const useSeverityLookup = (): DispositionLookup => useCodeValueLookup(SEVERITY_CODE_GROUP);

export const useNonconformanceStatusLookup = (): DispositionLookup =>
  useCodeValueLookup(NONCONFORMANCE_STATUS_CODE_GROUP);

/** 품목 이름은 코드와 함께 보인다 — 코드만으로는 현장에서 같은 품목인지 가리기 어렵다. */
export const useItemLookup = (): DispositionLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    /* ⚠ 뿌리 키를 화면 캐시와 «가른다» — 같은 뿌리를 쓰면 판정 저장의 무효화가 접두로 걸려
     * 저장 한 번마다 품목·단위 전량이 다시 나간다. 참조 이름은 판정으로 바뀌지 않는다. */
    queryKey: ['disposition-lookups', 'items'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items', { params: { query: { includeInactive: true } } }),
      );

      return {
        entries: data.items.map((item) => ({
          value: String(item.itemId),
          label: `${item.itemCode} · ${nameOr(item.itemName)}`,
          isActive: item.isActive,
        })),
        page: data.page,
      };
    },
  });

  return toLookup(query.data, query.isError, query.isPending);
};

/**
 * 품목 이름 — 목록 첫 쪽(`/mdm/items` 50건)에 없는 품목은 번호마다 단건으로 받아 채운다(G2 L-c). 새 흐름 부적합의 품목이 첫 쪽
 * 밖이면 「알 수 없음」으로 떴다. 조건 줄의 품목 고르기는 지금처럼 첫 쪽 목록을 쓴다.
 */
export const useItemLookupFor = (
  itemIds: readonly (number | null | undefined)[],
): DispositionLookup => {
  const { client } = useApiClient();
  const base = useItemLookup();
  const known = new Set(base.entries.map((entry) => entry.value));
  /* 첫 쪽을 받은 뒤에만 빠진 것을 센다 — 받기 전에는 모두 빠진 것으로 보여 전부 단건으로 부르게 된다. */
  const missing = base.isLoading
    ? []
    : [...new Set(itemIds.filter((id): id is number => typeof id === 'number' && id > 0))].filter(
        (id) => !known.has(String(id)),
      );
  const singles = useQueries({
    queries: missing.map((itemId) => ({
      queryKey: ['disposition-lookups', 'item', itemId] as const,
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
      staleTime: 5 * 60_000,
    })),
  });
  const extra: LookupEntry[] = singles.flatMap((result) => {
    const item = result.data?.item;
    return item === undefined
      ? []
      : [
          {
            value: String(item.itemId),
            label: `${item.itemCode} · ${nameOr(item.itemName)}`,
            isActive: item.isActive,
          },
        ];
  });

  return extra.length === 0 ? base : { ...base, entries: [...base.entries, ...extra] };
};

/** 판정 수량의 단위를 이름으로 보이기 위한 것이다 — 단위 자체는 대상 LOT이 정한다. */
export const useUomLookup = (): DispositionLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['disposition-lookups', 'uoms'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return {
        entries: data.items.map((uom) => ({
          value: String(uom.uomId),
          label: nameOr(uom.uomCode),
          isActive: uom.isActive,
        })),
        page: data.page,
      };
    },
  });

  return toLookup(query.data, query.isError, query.isPending);
};

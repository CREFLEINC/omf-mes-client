import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
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

/** 코드값 표시명 — 다국어 컬럼이 먼저, 기본 이름이 fallback, 둘 다 비면 코드(G-33). 로케일 스위치 전이라 한국어만 본다. */
const codeLabelOf = (value: { code: string; codeName: string; nameKo?: string | null }): string => {
  const localized = (value.nameKo ?? '').trim();
  if (localized !== '') return localized;
  const base = value.codeName.trim();
  return base === '' ? value.code : base;
};

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

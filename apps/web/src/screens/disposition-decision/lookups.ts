import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';
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

import type { ApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta, SelectOption } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 선택 목록 넷 — 고객·납품처·품목·단위.
 * 여기에 더해 **가용 수량**(`useAvailableQty`)을 라인 품목마다 조회한다.
 *
 * 고객·납품처는 계약이 역할 필드를 주지 않아(`Partner` 스키마 실측 · `shipment-schedule`과
 * 같은 사정) 같은 자원(`/mdm/partners`)을 각각 독립 키로 받는다 — 한쪽 재시도가 다른 쪽에
 * 번지지 않게 하기 위해서다.
 *
 * 전부 `includeInactive=true`로 받는다. 미사용 값을 참조하는 과거 지시서가 오면 이름이
 * 비어 보이지 않게 하기 위해서다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.shipmentRequestCreate;

export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  truncated: boolean;
  refetch: () => void;
}

export type ReferenceState =
  { kind: 'named'; label: string } | { kind: 'unknown' } | { kind: 'loading' } | { kind: 'failed' };

export const toReference = (
  source: ReferenceSource,
  id: number | null | undefined,
): ReferenceState => {
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };
  if (id === null || id === undefined) return { kind: 'unknown' };

  const label = source.entries.find((entry) => entry.value === String(id))?.label;

  return label === undefined ? { kind: 'unknown' } : { kind: 'named', label };
};

export const describeReference = (state: ReferenceState): string => {
  switch (state.kind) {
    case 'named':
      return state.label;
    case 'unknown':
      return t.values.unknown;
    case 'loading':
      return t.values.referenceLoading;
    case 'failed':
      return t.values.referenceFailed;
  }
};

const EMPTY_ENTRIES: LookupEntry[] = [];

const toSelectOptions = (entries: readonly LookupEntry[]): SelectOption[] =>
  entries.map((entry) => ({ value: entry.value, label: entry.label }));

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  customers: ['shipment-request-create-lookups', 'customers'] as const,
  shipToPartners: ['shipment-request-create-lookups', 'ship-to-partners'] as const,
  fulfillmentPlants: ['shipment-request-create-lookups', 'fulfillment-plants'] as const,
  items: ['shipment-request-create-lookups', 'items'] as const,
  itemSearch: (term: string) => ['shipment-request-create-lookups', 'item-search', term] as const,
  uoms: ['shipment-request-create-lookups', 'uoms'] as const,
};

type Client = ApiClient['client'];

const toPartnerLookupResult = (
  data:
    | {
        items: { partnerId: number; partnerCode: string; partnerName: string; isActive: boolean }[];
        page: PageMeta;
      }
    | undefined,
  isError: boolean,
  isLoading: boolean,
  refetch: () => void,
): LookupResult => ({
  entries:
    data?.items.map((item) => ({
      value: String(item.partnerId),
      label: `${item.partnerCode} · ${item.partnerName}`,
      isActive: item.isActive,
    })) ?? EMPTY_ENTRIES,
  truncated: data !== undefined && isTruncated(data.page, data.items.length),
  isError,
  isLoading,
  refetch,
});

/** 고객 — 좌측 조건의 선택칸과 편성 폼의 고객 이름이 함께 쓴다. */
export const useCustomerOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.customers,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  return toPartnerLookupResult(query.data, query.isError, query.isPending, () => {
    void query.refetch();
  });
};

/** 납품처 — 편성 폼의 납품처 선택칸(단독 생성)과 이름 표시(지시서 경유)가 함께 쓴다. */
export const useShipToPartnerOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.shipToPartners,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  return toPartnerLookupResult(query.data, query.isError, query.isPending, () => {
    void query.refetch();
  });
};

/** 이행 공장 — 새 편성은 활성 공장을 지정해야 하므로 기본 활성 목록만 쓴다. */
export const useFulfillmentPlantOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.fulfillmentPlants,
    queryFn: () => runRequest(() => client.GET('/mdm/plants', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((plant) => ({
        value: String(plant.plantId),
        label: `${plant.plantCode} · ${plant.plantName}`,
        isActive: plant.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 품목 — 라인 표의 품목 선택칸(단독 생성)과 이름 표시(지시서 경유) 둘 다 쓴다. */
export const useItemOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.items,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/items', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.itemId),
        label: `${item.itemCode} · ${item.itemName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 품목 검색이 도는 최소 글자 수.
 *
 * ⚠ 한 글자로 부르면 첫 쪽과 거의 같은 목록이 돌아오는데 요청만 라인 수만큼 나간다 — 걸러 줄
 *   것이 없는 검색은 하지 않는다. 그 사실은 화면이 안내로 밝힌다(감추지 않는다).
 */
export const ITEM_SEARCH_MIN_LENGTH = 2;

/**
 * 타건이 멎고 이만큼 지나야 조회한다(사용자 지시 2026-09-17).
 *
 * ⚠ 값 하나가 두 자리에 서면 시험과 제품이 다른 수를 믿는다 — 여기 한 곳에만 둔다.
 */
export const ITEM_SEARCH_DEBOUNCE_MS = 300;

const isSearchable = (term: string): boolean => term.trim().length >= ITEM_SEARCH_MIN_LENGTH;

const toItemEntries = (
  data: { items: { itemId: number; itemCode: string; itemName: string; isActive: boolean }[] } | undefined,
): LookupEntry[] =>
  data?.items.map((item) => ({
    value: String(item.itemId),
    label: `${item.itemCode} · ${item.itemName}`,
    isActive: item.isActive,
  })) ?? EMPTY_ENTRIES;

/** 한 라인의 품목 칸이 지금 무엇을 보이는가. */
export interface ItemChoice {
  options: SelectOption[];
  /** 선택지의 한계·상태를 밝히는 보조 문구. 없으면 `undefined`. */
  note: string | undefined;
}

export interface ItemChoices {
  /** 첫 쪽 목록 — 이름 풀이(`toReference`)가 쓰는 자리는 그대로다. */
  lookup: LookupResult;
  /** 그 검색어에서 이 라인이 보일 선택지. 고른 값은 어떤 경우에도 목록에서 사라지지 않는다. */
  choiceOf: (term: string, selectedValue: string) => ItemChoice;
}

/**
 * 품목 선택지 — **첫 쪽 + 라인별 검색**(SHIP-FINAL-01 P6).
 *
 * ⛔ **첫 쪽만으로는 편성이 통째로 막힌다.** 계약이 쪽을 나눠 주는데(코드 오름차순 50건) 화면이
 *    첫 쪽만 옵션으로 실어, 그 너머의 품목은 **고를 방법이 아예 없었다** — 잘림 안내는 그
 *    사실을 말할 뿐 길을 주지 않는다. 계약의 `q`(코드·명 부분 일치)로 다시 물어 길을 낸다.
 *
 * ⭐ **검색어가 같으면 한 번만 부른다.** 라인마다 칸이 서므로 같은 코드를 여러 줄에 치는 일이
 *    흔하다 — 유일하게 만들지 않으면 같은 요청이 줄 수만큼 나간다(`useAvailableQty` 와 같은 짜임).
 *
 * ⛔ **한 번 본 품목을 잊지 않는다.** 검색으로 고른 뒤 검색어를 지우면 옵션은 첫 쪽으로 돌아가는데,
 *    고른 품목이 첫 쪽에 없으면 «값은 남았는데 화면에는 안 고른 것처럼» 보인다 — 그대로 저장하면
 *    담당이 보지 못한 품목이 요청에 실린다. 그래서 본 것을 기억해 두었다가 그 한 건을 목록에 끼운다.
 */
export const useItemChoices = (terms: readonly string[]): ItemChoices => {
  const { client } = useApiClient();
  const lookup = useItemOptions();

  const uniqueTerms = [...new Set(terms.map((term) => term.trim()).filter(isSearchable))];

  const results = useQueries({
    queries: uniqueTerms.map((term) => ({
      queryKey: lookupKeys.itemSearch(term),
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/items', { params: { query: { q: term, includeInactive: true } } }),
        ),
    })),
  });

  /*
   * ⚠ **렌더 중에 쓰지 않는다.** 캐시라 결과가 같아도, 렌더 중 쓰기는 같은 렌더에서 두 번
   *   불릴 때 순서를 가정하게 만든다 — 고름은 목록이 그려진 «뒤»에 일어나므로 효과로 충분하다.
   */
  const remembered = useRef(new Map<string, LookupEntry>());

  useEffect(() => {
    for (const entry of [...lookup.entries, ...results.flatMap((result) => toItemEntries(result.data))]) {
      remembered.current.set(entry.value, entry);
    }
  });

  const choiceOf = (term: string, selectedValue: string): ItemChoice => {
    const trimmed = term.trim();
    const index = uniqueTerms.indexOf(trimmed);
    const result = isSearchable(trimmed) && index !== -1 ? results[index] : undefined;

    const found: ItemChoice = ((): ItemChoice => {
      if (result === undefined) {
        /*
         * 아직 이 검색어로 묻지 않았다. 까닭이 둘이고 **둘을 가른다** —
         * ① 너무 짧아 영영 안 묻는다 ② 길이는 됐는데 타건이 멎기를 기다리는 중이다.
         *
         * ⛔ **둘을 합쳐 「2자 이상 입력하세요」로 두지 않는다.** 일곱 자를 친 담당에게 그 말은
         *    거짓이고, 거짓을 본 사람은 더 칠 곳이 없어 화면이 고장 났다고 읽는다.
         *    (이 결함은 최소 글자 수를 1 로 바꾸는 되돌림에서 드러났다.)
         */
        return {
          options: toSelectOptions(lookup.entries),
          note:
            trimmed === ''
              ? lookupNote(lookup)
              : isSearchable(trimmed)
                ? t.lineTable.itemSearchLoading
                : t.lineTable.itemSearchTooShort(ITEM_SEARCH_MIN_LENGTH),
        };
      }

      if (result.isError) return { options: [], note: t.filters.lookupFailed };
      if (result.data === undefined) return { options: [], note: t.lineTable.itemSearchLoading };

      const entries = toItemEntries(result.data);

      return {
        options: toSelectOptions(entries),
        note:
          entries.length === 0
            ? t.lineTable.itemSearchEmpty
            : isTruncated(result.data.page, entries.length)
              ? t.filters.lookupTruncated
              : undefined,
      };
    })();

    if (selectedValue === '' || found.options.some((option) => option.value === selectedValue)) {
      return found;
    }

    const kept = remembered.current.get(selectedValue);

    return kept === undefined
      ? found
      : { ...found, options: [{ value: kept.value, label: kept.label }, ...found.options] };
  };

  return { lookup, choiceOf };
};

/** 단위 — 라인 표의 단위 이름과(둘 다 모드) 지시서 라인 승계 값의 이름 풀이가 쓴다. */
export const useUomOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.uoms,
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
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 가용 수량 한 품목의 조회 상태. 네 갈래 — 아직 안 물음 · 조회 중 · 실패 · 값. */
export type AvailableQtyState =
  { kind: 'unasked' } | { kind: 'loading' } | { kind: 'failed' } | { kind: 'qty'; value: number };

export const describeAvailableQty = (state: AvailableQtyState): string => {
  switch (state.kind) {
    case 'unasked':
      return t.values.empty;
    case 'loading':
      return t.values.availableQtyLoading;
    case 'failed':
      return t.values.availableQtyFailed;
    case 'qty':
      return String(state.value);
  }
};

const fetchAvailableQty = async (client: Client, itemId: number): Promise<number> => {
  const data = await runRequest(() =>
    client.GET('/inventory/balances', { params: { query: { itemId, groupBy: 'ITEM' } } }),
  );

  /*
   * **합산이지 재계산이 아니다**(미결 항목 표 · L-2). `availableQty`는 서버가 계산해 내려주는
   * `readonly` 값이고, 여기서는 그 값을 다시 유도하지 않고 그대로 더한다. 소유 구분(`ownershipTypeCode`)이
   * 갈리면 한 품목이 여러 줄로 올 수 있어(계약 설명 「소유 구분은 어떤 축에서도 합치지 않는다」)
   * 합산이 필요하다.
   */
  return data.items.reduce((sum, item) => sum + item.availableQty, 0);
};

export interface AvailableQtyLookup {
  of: (itemId: number | null) => AvailableQtyState;
  refetchAll: () => void;
}

/**
 * 라인 품목마다 가용 수량을 조회한다 — 계획서 미결 항목의 구현 판단. 스펙·계약에 전용
 * 조회가 없어 `GET /inventory/balances?itemId=&groupBy=ITEM`을 품목마다 호출한다
 * (경고 표시용이라 창고를 좁히지 않는다 — 편성 라인에는 아직 창고 축이 없다).
 *
 * **중복 품목은 한 번만 묻는다** — 두 라인이 같은 품목이면 요청도 하나로 묶는다.
 */
export const useAvailableQty = (itemIds: readonly (number | null)[]): AvailableQtyLookup => {
  const { client } = useApiClient();

  const uniqueIds = [...new Set(itemIds.filter((id): id is number => id !== null))];

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: ['shipment-request-create-lookups', 'available-qty', itemId] as const,
      queryFn: () => fetchAvailableQty(client, itemId),
    })),
  });

  const of = (itemId: number | null): AvailableQtyState => {
    if (itemId === null) return { kind: 'unasked' };

    const index = uniqueIds.indexOf(itemId);
    const result = index === -1 ? undefined : results[index];

    if (result === undefined) return { kind: 'unasked' };
    if (result.isError) return { kind: 'failed' };
    if (result.data === undefined) return { kind: 'loading' };

    return { kind: 'qty', value: result.data };
  };

  return {
    of,
    refetchAll: () => {
      for (const result of results) void result.refetch();
    },
  };
};

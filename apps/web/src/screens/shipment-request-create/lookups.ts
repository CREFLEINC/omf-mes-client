import type { ApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

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

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  customers: ['shipment-request-create-lookups', 'customers'] as const,
  shipToPartners: ['shipment-request-create-lookups', 'ship-to-partners'] as const,
  items: ['shipment-request-create-lookups', 'items'] as const,
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

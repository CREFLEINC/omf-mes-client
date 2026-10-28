import { messages, named } from '@omf-mes/i18n';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { masterName } from '../../patterns/master-name';
import { REFERENCE_PAGE_SIZE, type ReferenceSource } from '../../patterns/reference-picker';
import { runRequest } from '../../patterns/request';
import {
  EVENT_KINDS,
  inputQuery,
  packingQuery,
  receiptQuery,
  shipmentQuery,
  sourceQuery,
  type KindFilter,
  type LotTraceFilters,
  type MovementKind,
} from './filters';
import {
  fromInputLine,
  fromPackingLine,
  fromReceiptLine,
  fromShipmentLine,
  type MovementRow,
} from './rows';
import type { QtyByUom } from './types';

const t = messages.lotTrace.filters;

export const lotTraceKeys = {
  list: (filters: LotTraceFilters) => ['lot-trace', 'list', filters] as const,
  counts: (filters: LotTraceFilters) =>
    ['lot-trace', 'counts', { ...filters, kind: 'ALL', page: 1 }] as const,
  codes: (group: string) => ['lot-trace', 'codes', group] as const,
  item: (id: string) => ['lot-trace', 'item', id] as const,
  warehouse: (id: string) => ['lot-trace', 'warehouse', id] as const,
  partners: (role: PartnerRole) => ['lot-trace', 'partners', role] as const,
};

export interface MovementPage {
  rows: MovementRow[];
  page: { page: number; size: number; total: number };
  totals: { lineCount: number; qtyByUom: QtyByUom[] };
  /** 전체(`ALL`)를 모을 때 구분마다 받는 줄 수 상한에 걸렸다 */
  capped: boolean;
}

type Client = ReturnType<typeof useApiClient>['client'];

const EMPTY_PAGE = (page: number, size: number): MovementPage => ({
  rows: [],
  page: { page, size, total: 0 },
  totals: { lineCount: 0, qtyByUom: [] },
  capped: false,
});

/** 한 구분의 한 쪽. 그 구분이 조건을 다 걸 수 없으면 빈 쪽이다(`sourceQuery`). 번호 조건이 있으면 기간 없이 부른다. */
const fetchKindPage = async (
  client: Client,
  kind: MovementKind,
  filters: LotTraceFilters,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<MovementPage> => {
  const part = sourceQuery(kind, filters);
  if (part === null) return EMPTY_PAGE(page, size);
  const init = signal === undefined ? {} : { signal };
  if (kind === 'SHIPMENT') {
    const data = await runRequest(() =>
      client.GET('/logistics/shipment-lines', {
        params: { query: shipmentQuery(filters, part, page, size) },
        ...init,
      }),
    );
    return {
      rows: data.items.map(fromShipmentLine),
      page: data.page,
      totals: data.totals,
      capped: false,
    };
  }
  if (kind === 'MATERIAL' || kind === 'PRODUCT') {
    const data = await runRequest(() =>
      client.GET('/logistics/goods-receipt-lines', {
        params: { query: receiptQuery(kind, filters, part, page, size) },
        ...init,
      }),
    );
    return {
      rows: data.items.map(fromReceiptLine),
      page: data.page,
      totals: { lineCount: data.totals.lineCount, qtyByUom: data.totals.qtyByUom },
      capped: false,
    };
  }
  if (kind === 'CONSUMED') {
    const data = await runRequest(() =>
      client.GET('/trace/material-input-lines', {
        params: { query: inputQuery(filters, part, page, size) },
        ...init,
      }),
    );
    return {
      rows: data.items.map(fromInputLine),
      page: data.page,
      totals: data.totals,
      capped: false,
    };
  }
  const data = await runRequest(() =>
    client.GET('/trace/packing-lines', {
      params: { query: packingQuery(filters, part, page, size) },
      ...init,
    }),
  );
  return {
    rows: data.items.map(fromPackingLine),
    page: data.page,
    totals: data.totals,
    capped: false,
  };
};

/** 전체를 모을 때 구분마다 받는 줄 수 상한. 넘으면 최근 줄부터 이만큼만 모으고 알린다. */
export const ALL_CAP = 1000;
const ALL_PAGE = 200;

const mergeQty = (lists: readonly QtyByUom[][]): QtyByUom[] => {
  const byUom = new Map<string, QtyByUom>();
  for (const entry of lists.flat()) {
    const current = byUom.get(entry.uomCode);
    byUom.set(
      entry.uomCode,
      current === undefined ? { ...entry } : { ...current, qty: current.qty + entry.qty },
    );
  }
  return [...byUom.values()];
};

/** 줄 시각(공장 날짜와 시각) 내림차순 — 서버 목록과 같은 순서. */
const newestFirst = (a: MovementRow, b: MovementRow): number =>
  `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);

/**
 * 전체 — 서버 목록이 있는 구분을 모두 받아 시각순으로 합친다. 서버에 합친 목록이 없어 화면이 모은다.
 * 구분마다 `ALL_CAP`줄까지 받고, 넘으면 `capped`로 알린다. 쪽은 화면이 나눈다.
 */
const fetchAll = async (
  client: Client,
  filters: LotTraceFilters,
  signal?: AbortSignal,
): Promise<{ rows: MovementRow[]; totals: MovementPage['totals']; capped: boolean }> => {
  const kinds = EVENT_KINDS.filter((kind) => sourceQuery(kind, filters) !== null);
  const results = await Promise.all(
    kinds.map(async (kind) => {
      const rows: MovementRow[] = [];
      let first: MovementPage | null = null;
      for (let page = 1; rows.length < ALL_CAP; page += 1) {
        const data = await fetchKindPage(client, kind, filters, page, ALL_PAGE, signal);
        first ??= data;
        rows.push(...data.rows);
        if (data.rows.length === 0 || rows.length >= data.page.total) break;
      }
      return { rows, first };
    }),
  );
  return {
    rows: results.flatMap((result) => result.rows).sort(newestFirst),
    totals: {
      lineCount: results.reduce((sum, result) => sum + (result.first?.totals.lineCount ?? 0), 0),
      qtyByUom: mergeQty(results.map((result) => result.first?.totals.qtyByUom ?? [])),
    },
    capped: results.some((result) => (result.first?.page.total ?? 0) > ALL_CAP),
  };
};

/** 한 쪽을 받는다. 목록과 내려받기가 같은 함수를 쓴다(같은 조건, 같은 모양). */
export const fetchMovementPage = async (
  client: Client,
  filters: LotTraceFilters,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<MovementPage> => {
  if (filters.kind !== 'ALL') {
    return fetchKindPage(client, filters.kind, filters, page, size, signal);
  }
  const all = await fetchAll(client, filters, signal);
  return {
    rows: all.rows.slice((page - 1) * size, page * size),
    page: { page, size, total: all.rows.length },
    totals: all.totals,
    capped: all.capped,
  };
};

/** 고른 구분의 한 쪽. 기간이 맞지 않으면(`enabled` 거짓) 부르지 않는다 — 서버가 400을 낸다. */
export const useMovementList = (
  filters: LotTraceFilters,
  enabled: boolean,
): UseQueryResult<MovementPage> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: lotTraceKeys.list(filters),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchMovementPage(client, filters, filters.page, filters.size, signal),
  });
};

export type KindCounts = Record<KindFilter, number>;

/** 구분 칩의 건수 — 구분마다 같은 조건으로 한 줄짜리를 부른다. 걸 수 없는 조건이 있는 구분은 0이다. 전체는 합이다. */
export const useKindCounts = (
  filters: LotTraceFilters,
  enabled: boolean,
): UseQueryResult<KindCounts> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: lotTraceKeys.counts(filters),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        EVENT_KINDS.map(
          async (kind) =>
            [
              kind,
              (await fetchKindPage(client, kind, filters, 1, 1, signal)).totals.lineCount,
            ] as const,
        ),
      );
      const counts = Object.fromEntries(entries) as Record<MovementKind, number>;
      return { ...counts, ALL: entries.reduce((sum, [, count]) => sum + count, 0) };
    },
  });
};

/** 상태 코드 그룹 — 입고는 물류 전표 상태, 출하는 출하 상태(계약). */
export const statusGroupOf = (kind: MovementKind): string =>
  kind === 'SHIPMENT' ? 'SHIPMENT_STATUS' : 'LOGISTICS_DOCUMENT_STATUS';

export interface CodeOption {
  value: string;
  label: string;
}

/** 코드 이름과 선택지. 사용 중지된 코드로 만든 기록도 있어 사용 중지까지 받는다. 이름을 못 찾으면 코드를 그대로 보인다. */
export const useCodeNames = (
  group: string,
): { options: CodeOption[]; nameOf: (code: string) => string } => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lotTraceKeys.codes(group),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: group, includeInactive: true, size: 100 } },
        }),
      );
      return data.items.map((value) => ({
        value: value.code,
        label: masterName(value, value.codeName),
      }));
    },
  });
  return useMemo(() => {
    const options = query.data ?? [];
    const names = new Map(options.map((option) => [option.value, option.label]));
    return { options, nameOf: (code) => names.get(code) ?? code };
  }, [query.data]);
};

export const useStatusCodes = (kind: MovementKind) => useCodeNames(statusGroupOf(kind));

/* ── 참조 선택(C-12) ───────────────────────────────────────────────────── */

export type PartnerRole = 'SUPPLIER' | 'CUSTOMER';

export const partnerRoleOf = (kind: MovementKind): PartnerRole | null =>
  kind === 'MATERIAL' ? 'SUPPLIER' : kind === 'SHIPMENT' ? 'CUSTOMER' : null;

/** 지난 자료를 찾는 조회 조건이라 사용 중지된 품목도 찾는다. */
export const useItemSource = (): ReferenceSource => {
  const { client } = useApiClient();
  return useMemo(
    () => ({
      title: t.itemPicker,
      key: ['lot-trace', 'reference', 'item'],
      columns: { code: t.itemCode, name: t.itemName },
      search: async (term, page) => {
        const data = await runRequest(() =>
          client.GET('/mdm/items', {
            params: {
              query: {
                ...(term === '' ? {} : { q: term }),
                includeInactive: true,
                page,
                size: REFERENCE_PAGE_SIZE,
              },
            },
          }),
        );
        return {
          items: data.items.map((item) => ({
            id: item.itemId,
            code: item.itemCode,
            name: masterName(item, item.itemName),
          })),
          total: data.page.total,
        };
      },
    }),
    [client],
  );
};

export const useWarehouseSource = (): ReferenceSource => {
  const { client } = useApiClient();
  return useMemo(
    () => ({
      title: t.warehousePicker,
      key: ['lot-trace', 'reference', 'warehouse'],
      columns: { code: t.warehouseCode, name: t.warehouseName },
      search: async (term, page) => {
        const data = await runRequest(() =>
          client.GET('/mdm/warehouses', {
            params: {
              query: {
                ...(term === '' ? {} : { q: term }),
                includeInactive: true,
                page,
                size: REFERENCE_PAGE_SIZE,
              },
            },
          }),
        );
        return {
          items: data.items.map((warehouse) => ({
            id: warehouse.warehouseId,
            code: warehouse.warehouseCode,
            name: warehouse.warehouseName,
          })),
          total: data.page.total,
        };
      },
    }),
    [client],
  );
};

export const usePartnerSource = (role: PartnerRole | null): ReferenceSource | null => {
  const { client } = useApiClient();
  return useMemo(
    () =>
      role === null
        ? null
        : {
            title: role === 'SUPPLIER' ? t.supplierPicker : t.customerPicker,
            key: ['lot-trace', 'reference', 'partner', role],
            columns:
              role === 'SUPPLIER'
                ? { code: t.supplierCode, name: t.supplierName }
                : { code: t.customerCode, name: t.customerName },
            search: async (term, page) => {
              const data = await runRequest(() =>
                client.GET('/mdm/partners', {
                  params: {
                    query: {
                      ...(term === '' ? {} : { q: term }),
                      roleTypeCode: role,
                      includeInactive: true,
                      page,
                      size: REFERENCE_PAGE_SIZE,
                    },
                  },
                }),
              );
              return {
                items: data.items.map((partner) => ({
                  id: partner.partnerId,
                  code: partner.partnerCode,
                  name: partner.partnerName,
                })),
                total: data.page.total,
              };
            },
          },
    [client, role],
  );
};

/* ── 주소로 들어온 번호를 「이름 (코드)」로 푼다(C-12) ─────────────────── */

export const useItemLabel = (id: string): string => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lotTraceKeys.item(id),
    enabled: id !== '',
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId: Number(id) } } }),
      );
      return named(masterName(data.item, data.item.itemName), data.item.itemCode);
    },
  });
  return id === '' ? '' : (query.data ?? '');
};

export const useWarehouseLabel = (id: string): string => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lotTraceKeys.warehouse(id),
    enabled: id !== '',
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses/{warehouseId}', {
          params: { path: { warehouseId: Number(id) } },
        }),
      );
      return named(data.warehouse.warehouseName, data.warehouse.warehouseCode);
    },
  });
  return id === '' ? '' : (query.data ?? '');
};

/** 거래처는 번호 하나로 받는 계약이 없어 그 역할의 목록을 받아 찾는다(주소로 들어왔을 때만). */
export const usePartnerLabel = (id: string, role: PartnerRole | null): string => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lotTraceKeys.partners(role ?? 'SUPPLIER'),
    enabled: id !== '' && role !== null,
    queryFn: async () => {
      const all = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/partners', {
            params: {
              query: { roleTypeCode: role ?? 'SUPPLIER', includeInactive: true, page, size },
            },
          }),
        ),
      );
      return new Map(
        all.items.map((partner) => [
          String(partner.partnerId),
          named(partner.partnerName, partner.partnerCode),
        ]),
      );
    },
  });
  return id === '' ? '' : (query.data?.get(id) ?? '');
};

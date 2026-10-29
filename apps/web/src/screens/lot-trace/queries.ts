import { messages, named } from '@omf-mes/i18n';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { masterName } from '../../patterns/master-name';
import { REFERENCE_PAGE_SIZE, type ReferenceSource } from '../../patterns/reference-picker';
import { runRequest } from '../../patterns/request';
import {
  receiptCountQuery,
  receiptQuery,
  shipmentCountQuery,
  shipmentQuery,
  type LotTraceFilters,
  type MovementKind,
} from './filters';
import { fromReceiptLine, fromShipmentLine, type MovementRow } from './rows';
import type { QtyByUom } from './types';

const t = messages.lotTrace.filters;

export const lotTraceKeys = {
  list: (filters: LotTraceFilters) => ['lot-trace', 'list', filters] as const,
  counts: (from: string, to: string, item: string, warehouse: string) =>
    ['lot-trace', 'counts', from, to, item, warehouse] as const,
  codes: (group: string) => ['lot-trace', 'codes', group] as const,
  item: (id: string) => ['lot-trace', 'item', id] as const,
  warehouse: (id: string) => ['lot-trace', 'warehouse', id] as const,
  partners: (role: PartnerRole) => ['lot-trace', 'partners', role] as const,
};

export interface MovementPage {
  rows: MovementRow[];
  page: { page: number; size: number; total: number };
  totals: { lineCount: number; qtyByUom: QtyByUom[] };
}

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
    queryFn: () => fetchMovementPage(client, filters, filters.page, filters.size),
  });
};

type Client = ReturnType<typeof useApiClient>['client'];

/** 한 쪽을 받는다. 목록과 내려받기가 같은 함수를 쓴다(같은 조건, 같은 모양). */
export const fetchMovementPage = async (
  client: Client,
  filters: LotTraceFilters,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<MovementPage> => {
  if (filters.kind === 'SHIPMENT') {
    const data = await runRequest(() =>
      client.GET('/logistics/shipment-lines', {
        params: { query: shipmentQuery(filters, page, size) },
        ...(signal === undefined ? {} : { signal }),
      }),
    );
    return { rows: data.items.map(fromShipmentLine), page: data.page, totals: data.totals };
  }
  const data = await runRequest(() =>
    client.GET('/logistics/goods-receipt-lines', {
      params: { query: receiptQuery(filters, page, size) },
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return { rows: data.items.map(fromReceiptLine), page: data.page, totals: data.totals };
};

export type KindCounts = Record<MovementKind, number>;

/**
 * 구분 칩의 건수 — 공통 조건(기간, 품목, 창고)만 건 한 줄짜리 두 호출.
 * 입고 줄 목록의 `lineCountByType`은 그 기간에 줄이 있는 유형만 싣는다 — 없는 유형은 0이다.
 */
export const useKindCounts = (
  filters: LotTraceFilters,
  enabled: boolean,
): UseQueryResult<KindCounts> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: lotTraceKeys.counts(filters.from, filters.to, filters.item, filters.warehouse),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [receipts, shipments] = await Promise.all([
        runRequest(() =>
          client.GET('/logistics/goods-receipt-lines', {
            params: { query: receiptCountQuery(filters) },
          }),
        ),
        runRequest(() =>
          client.GET('/logistics/shipment-lines', {
            params: { query: shipmentCountQuery(filters) },
          }),
        ),
      ]);
      const byType = (code: string): number =>
        receipts.totals.lineCountByType.find((entry) => entry.receiptTypeCode === code)
          ?.lineCount ?? 0;
      return {
        MATERIAL: byType('MATERIAL'),
        PRODUCT: byType('PRODUCT'),
        SHIPMENT: shipments.totals.lineCount,
      };
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

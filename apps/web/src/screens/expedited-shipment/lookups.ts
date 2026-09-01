import { messages } from '@omf-mes/i18n';
import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';

type Warehouse = components['schemas']['Warehouse'];

/**
 * 참조 이름과 출하 창고.
 *
 * ⚠ **뿌리 키를 화면 캐시와 «가른다»** — 같은 뿌리를 쓰면 직행 출하 한 번마다 무효화가 접두로
 * 걸려 품목·단위 전량이 다시 나간다. 참조 이름은 출하로 바뀌지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ExpeditedLookup extends LookupSource {
  entries: LookupEntry[];
  /** 목록이 잘렸다 — 이름을 못 찾은 것이 「없는 값」인지 「잘린 값」인지 가르는 데 쓴다. */
  truncated: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const nameOr = (value: string): string =>
  value.trim() === '' ? messages.common.reference.unknown : value;

/** 품목 이름은 코드와 함께 보인다 — 코드만으로는 현장에서 같은 품목인지 가리기 어렵다. */
export const useItemLookup = (): ExpeditedLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['expedited-shipment-lookups', 'items'],
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
        total: data.page.total,
      };
    },
  });

  return {
    entries: query.data?.entries ?? EMPTY_ENTRIES,
    truncated: query.data !== undefined && query.data.total > query.data.entries.length,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 수량 옆에 붙는 단위. 단위 자체는 LOT과 출하 라인이 정한다. */
export const useUomLookup = (): ExpeditedLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['expedited-shipment-lookups', 'uoms'],
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
        total: data.page.total,
      };
    },
  });

  return {
    entries: query.data?.entries ?? EMPTY_ENTRIES,
    truncated: query.data !== undefined && query.data.total > query.data.entries.length,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

export interface WarehouseOption {
  warehouseId: number;
  label: string;
}

export const toWarehouseOptions = (items: readonly Warehouse[]): WarehouseOption[] =>
  items.map((item) => ({
    warehouseId: item.warehouseId,
    label: `${item.warehouseCode} · ${item.warehouseName}`,
  }));

export const useActiveWarehouses = () => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['expedited-shipment-lookups', 'warehouses'],
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { includeInactive: false } } }),
      ),
  });
};

/**
 * ⚠ **계약이 `warehouseId`를 필수로 두는데 그 값의 출처가 스펙에 없다.**
 *
 * 활성 창고가 정확히 하나면 자동으로 채우고, 여럿이면 고르게 한다 — 화면이 몰래 첫 번째를
 * 집으면 **장부상 입고가 엉뚱한 창고에 남는다.** `W-04-04`가 같은 처리를 했다.
 */
export type WarehouseResolution =
  | { kind: 'PENDING' }
  | { kind: 'ERROR' }
  | { kind: 'NONE' }
  | { kind: 'AUTO'; warehouseId: number; label: string }
  | { kind: 'AMBIGUOUS'; options: WarehouseOption[] };

export const resolveWarehouse = (
  options: WarehouseOption[] | undefined,
  isPending: boolean,
  isError: boolean,
): WarehouseResolution => {
  if (isPending) return { kind: 'PENDING' };
  if (isError || options === undefined) return { kind: 'ERROR' };
  if (options.length === 0) return { kind: 'NONE' };
  const [only] = options;
  if (options.length === 1 && only !== undefined) {
    return { kind: 'AUTO', warehouseId: only.warehouseId, label: only.label };
  }

  return { kind: 'AMBIGUOUS', options };
};

/** 실제로 보낼 창고. 정해지지 않았으면 `null`이고 확정이 잠긴다. */
export const resolvedWarehouseId = (
  resolution: WarehouseResolution,
  chosen: string,
): number | null => {
  if (resolution.kind === 'AUTO') return resolution.warehouseId;
  if (resolution.kind !== 'AMBIGUOUS') return null;

  const parsed = Number(chosen);
  return chosen !== '' && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

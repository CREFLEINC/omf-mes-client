import { messages } from '@omf-mes/i18n';
import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';

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

/** 그 번호의 품목이 없다(404). **못 받은 것과 다르다** — 다시 부를 이유가 없다. */
const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/** 아직 묻지 않은 번호의 자리. 「없다」가 아니라 「아직 오지 않았다」로 읽혀야 한다. */
const PENDING_SOURCE: LookupSource = { entries: EMPTY_ENTRIES, isError: false, isLoading: true };

/**
 * 품목 이름 — 코드와 함께 보인다(코드만으로는 현장에서 같은 품목인지 가리기 어렵다).
 * **번호로 하나씩 푼다**(`GET /mdm/items/{itemId}`).
 *
 * ⛔ **목록 첫 쪽으로 풀지 않는다.** 종전에는 `GET /mdm/items`를 `size` 없이 한 번 받아
 *    그 안에서 이름을 찾았다 — 계약의 기본 쪽 크기가 50이라, 품목 마스터가 그보다 크면
 *    첫 쪽 밖의 품목을 가리키는 LOT이 **전부 「알 수 없음」**으로 섰다(omf-all-around#37).
 *    그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 정반대로 읽힌다.
 * ⛔ **쪽을 돌며 다 받는 것으로 바꾸지 않는다.** 마스터가 9,000건인 곳이 있어 첫 진입에
 *    46번을 부르게 된다 — 얻는 것은 선택지에 실제로 선 LOT의 이름뿐이다.
 * ⭐ 부르는 횟수는 **선택지에 선 LOT이 가리키는 품목 수**다. 같은 품목의 LOT이 여럿이면
 *    요청도 하나다.
 *
 * **「잘림」 축이 사라진다** — 목록을 부르지 않으므로 쪽 자체가 없다.
 * 없는 품목(404)은 실패가 아니라 「알 수 없음」이다(빈 원천으로 낸다).
 */
export interface ItemNameLookup {
  of: (itemId: number) => LookupSource;
  /** 하나라도 **못 받았는가**(404는 아니다). */
  isError: boolean;
  refetch: () => void;
}

export const useItemNames = (itemIds: readonly number[]): ItemNameLookup => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)].sort((left, right) => left - right);

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: ['expedited-shipment-lookups', 'item-name', itemId] as const,
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  return {
    of: (itemId) => {
      const index = uniqueIds.indexOf(itemId);
      const result = index === -1 ? undefined : results[index];

      if (result === undefined) return PENDING_SOURCE;

      const item = result.data?.item;

      return {
        entries:
          item === undefined
            ? EMPTY_ENTRIES
            : [
                {
                  value: String(itemId),
                  label: `${item.itemCode} · ${nameOr(masterName(item, item.itemName))}`,
                  isActive: item.isActive,
                },
              ],
        /* 없는 품목은 실패가 아니다 — 빈 원천이 되어 「알 수 없음」으로 읽힌다. */
        isError: result.isError && !isNotFound(result.error),
        isLoading: result.isPending,
      };
    },
    isError: results.some((result) => result.isError && !isNotFound(result.error)),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
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

/**
 * ⭐ **위치를 고르지 않아도 되는 창고만 후보로 남긴다.** 이 화면은 입고 위치 칸이 없다 — 대응표
 * 「보류」가 `ShipmentCreate`에 위치 필드를 임의로 만들지 말라고 못박았다. 서버는 본문에 위치가
 * 없으면 재고를 둘 수 있는 위치(활성 · 적치 대기 아님 · 켜진 하위 없음)가 정확히 하나일 때만 그
 * 위치로 넣고, 둘 이상이면 400(REQUIRED)으로 돌려보낸다(장부 P-153). 그런 창고를 고르게 두면
 * 확정을 눌러야 비로소 400을 만난다 — 그래서 「창고 안을 나눈 창고」(`dividedOnly=true`, 적치 대기가
 * 아닌 활성 위치가 둘 이상)를 활성 창고에서 뺀다. 위치 입력 칸이 생기기 전까지는 이렇게 좁힌다
 * (대응표 「긴급 직행 위치」).
 *
 * ⚠ 나눈 창고 판정은 서버가 한다 — 화면이 위치를 세지 않는다. 모든 창고에 「창고 전체」 위치가
 * 있으므로, 나누지 않은 창고는 적치 대기 말고 활성 위치가 그 하나뿐이고 서버가 그리로 넣는다.
 * 서버의 「나눔」은 맨 아래 여부를 보지 않아 위치를 하나만 고를 수 있는 창고도 빠질 수 있다 —
 * 400을 만나는 것보다 후보가 좁은 쪽을 택한다.
 */
export const toWarehouseOptions = (
  items: readonly Warehouse[],
  dividedItems: readonly Warehouse[],
): WarehouseOption[] => {
  const divided = new Set(dividedItems.map((item) => item.warehouseId));
  return items
    .filter((item) => !divided.has(item.warehouseId))
    .map((item) => ({
      warehouseId: item.warehouseId,
      label: `${item.warehouseCode} · ${item.warehouseName}`,
    }));
};

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

/** 「창고 안을 나눈 창고」 — 위치를 골라야 할 수 있어 이 화면의 후보에서 뺀다(`toWarehouseOptions`). */
export const useDividedWarehouses = () => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['expedited-shipment-lookups', 'warehouses', 'divided'],
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', {
          params: { query: { includeInactive: false, dividedOnly: true } },
        }),
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

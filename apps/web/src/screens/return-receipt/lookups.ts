import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';
import {
  CUSTOMER_ROLE,
  LOOKUP_PAGE_SIZE,
  REASON_CODE_GROUP,
  SHIPMENT_STATUS_CODE_GROUP,
  type CodeOption,
} from './codes';
import {
  toLocationView,
  toWarehouseView,
  type LocationView,
  type PageMeta,
  type WarehouseView,
} from './types';

/**
 * 참조 이름과 선택지 — 등록으로 바뀌지 않는 값들이다.
 *
 * ⚠ 뿌리 키를 화면 캐시(`returnReceiptKeys`)와 «가른다» — 같은 뿌리를 쓰면 쓰기의 무효화가 접두로
 * 걸려 저장 한 번마다 고객·창고·위치·코드값 전량이 다시 나간다.
 */
const ROOT = 'return-receipt-lookups';

export interface ReceiptLookup extends LookupSource {
  entries: LookupEntry[];
  /** 목록이 잘렸다 — 이름을 못 찾은 것이 「없는 값」인지 「잘린 값」인지 가르는 데 쓴다. */
  truncated: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const toLookup = (
  data: { entries: LookupEntry[]; page: PageMeta } | undefined,
  isError: boolean,
  isLoading: boolean,
): ReceiptLookup => ({
  entries: data?.entries ?? EMPTY_ENTRIES,
  truncated: data !== undefined && data.page.total > data.entries.length,
  isError,
  isLoading,
});

const nameOr = (value: string): string =>
  value.trim() === '' ? messages.common.reference.unknown : value;

export const useUomLookup = (): ReceiptLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'uoms'],
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

/** 그 번호의 품목이 없다(404). **못 받은 것과 다르다** — 다시 부를 이유가 없다. */
const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/** 아직 묻지 않은 번호의 자리. 「없다」가 아니라 「아직 오지 않았다」로 읽혀야 한다. */
const PENDING_SOURCE: LookupSource = { entries: EMPTY_ENTRIES, isError: false, isLoading: true };

/**
 * 품목 이름 — 직접 찾은 LOT 은 품목 번호만 든다(배분은 코드를 실어 오지만 이름은 여기서 붙인다).
 * **번호로 하나씩 푼다**(`GET /mdm/items/{itemId}`).
 *
 * ⛔ **목록 한 쪽으로 풀지 않는다.** 종전에는 `GET /mdm/items?size=200`을 한 번 받아 그 안에서
 *    이름을 찾았다 — `size` 상한이 200이라 품목 마스터가 그보다 크면 그 밖의 품목이 **전부**
 *    「알 수 없음」으로 섰다(omf-all-around#37). 마스터가 9,269건인 환경이 실재한다.
 *    **직접 찾은 LOT 에서 그 자리가 드러난다** — 배분과 달리 행에 품목 코드가 없어
 *    이름이 그 줄의 **유일한 표시**다.
 * ⛔ **쪽을 돌며 다 받는 것으로 바꾸지 않는다.** 첫 진입에 46번을 부르게 되고, 얻는 것은
 *    줄에 실제로 선 몇 품목의 이름뿐이다.
 * ⭐ 부르는 횟수는 **줄에 선 품목 수**다. 같은 품목의 줄이 여럿이면 요청도 하나다.
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
      queryKey: [ROOT, 'item-name', itemId] as const,
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

/** 출하 상태 표시명 — 계약은 코드만 내린다(G-32). 없으면 코드를 그대로 보인다. */
export const useShipmentStatusLookup = (): ReceiptLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'code-values', SHIPMENT_STATUS_CODE_GROUP],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: SHIPMENT_STATUS_CODE_GROUP, includeInactive: true } },
        }),
      );

      return {
        entries: data.items.map((item) => ({
          value: item.code,
          label: nameOr(masterName(item, item.codeName)),
          isActive: item.isActive,
        })),
        page: data.page,
      };
    },
  });

  return toLookup(query.data, query.isError, query.isPending);
};

/** 코드값 선택지 — 비어 오면 비어 있는 대로 낸다. 값을 지어내지 않는다(G-2). */
export interface CodeOptionSource {
  options: CodeOption[];
  isLoading: boolean;
  isError: boolean;
}

const toOptions = (
  data: CodeOption[] | undefined,
  isError: boolean,
  isLoading: boolean,
): CodeOptionSource => ({ options: data ?? [], isError, isLoading });

/** 고객 — 거래처 역할 «고객»만. 원 출하 검색의 축이다. */
export const useCustomerOptions = (): CodeOptionSource => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'customers'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/partners', {
          params: { query: { roleTypeCode: CUSTOMER_ROLE, size: LOOKUP_PAGE_SIZE } },
        }),
      );

      return data.items
        .filter((partner) => partner.isActive)
        .map((partner) => ({
          value: String(partner.partnerId),
          label: `${partner.partnerCode} · ${nameOr(partner.partnerName)}`,
        }));
    },
  });

  return toOptions(query.data, query.isError, query.isPending);
};

/** 반품 사유 — 고객이 늘리는 값이라 화면이 외우지 않는다. 원천을 접어 넣지 않은 순수한 사유다. */
export const useReasonOptions = (): CodeOptionSource => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'code-values', REASON_CODE_GROUP],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', { params: { query: { codeGroupCode: REASON_CODE_GROUP } } }),
      );

      return data.items
        .filter((item) => item.isActive)
        .map((item) => ({ value: item.code, label: nameOr(masterName(item, item.codeName)) }));
    },
  });

  return toOptions(query.data, query.isError, query.isPending);
};

export interface OptionListResult<T> {
  items: T[];
  isLoading: boolean;
  isError: boolean;
  truncated: boolean;
  refetch: () => void;
}

const EMPTY: never[] = [];

/**
 * 입고 창고 — **전체 창고**를 낸다. 반품은 불량창고로 우선 입고하지만 스펙은 강제가 아니라 경고다
 * (§6). 불량창고를 앞에 세우고, 아닌 창고를 고르면 화면이 경고한다.
 */
export const useWarehouses = (): OptionListResult<WarehouseView> => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'warehouses'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { size: LOOKUP_PAGE_SIZE } } }),
      );
      const items = data.items
        .map(toWarehouseView)
        .filter((warehouse) => warehouse.isActive)
        .sort((a, b) => Number(b.isDefect) - Number(a.isDefect));

      return { items, truncated: data.page.total > data.items.length };
    },
  });

  return {
    items: query.data?.items ?? EMPTY,
    isLoading: query.isPending,
    isError: query.isError,
    truncated: query.data?.truncated ?? false,
    refetch: () => void query.refetch(),
  };
};

/** 고른 창고의 위치 — 계약이 `warehouseId` 를 필수로 요구해 창고 전에는 부를 수 없다. */
export const useLocations = (warehouseId: number | null): OptionListResult<LocationView> => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'locations', warehouseId],
    enabled: warehouseId !== null,
    queryFn: async () => {
      if (warehouseId === null) throw new Error('창고를 고르기 전에는 위치를 조회하지 않습니다.');
      const data = await runRequest(() =>
        client.GET('/mdm/locations', {
          params: { query: { warehouseId, size: LOOKUP_PAGE_SIZE } },
        }),
      );

      return {
        items: data.items.map(toLocationView).filter((location) => location.isActive),
        truncated: data.page.total > data.items.length,
      };
    },
  });

  return {
    items: query.data?.items ?? EMPTY,
    isLoading: warehouseId !== null && query.isPending,
    isError: query.isError,
    truncated: query.data?.truncated ?? false,
    refetch: () => void query.refetch(),
  };
};

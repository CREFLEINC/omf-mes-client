import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';
import type { PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 선택 목록 넷 — 창고·위치·품목·단위.
 * 여기에 더해 **위치 하나의 상세**(`useLocationDetail`)로 창고를 유도한다.
 *
 * ⭐ **창고 축이 화면에 필요한 이유.** `GET /mdm/locations` 는 `warehouseId` 를 **필수**로
 * 요구한다(계약 실측 — 타입에도 필수라 비우고 부를 수단이 없다). 스펙 §3 의 도착 칸은 선택칸
 * 하나뿐이라 창고를 담을 자리가 없어, 화면이 칸을 하나 더 세운다. 대부분의 W/O 에서는
 * `defaultWipLocationId` 로 자동으로 채워져 사용자가 만지지 않는다.
 *
 * 전부 `includeInactive=true` 로 받는다 — 미사용 값을 참조하는 과거 W/O 가 오면 이름이
 * 비어 보이지 않게 하기 위해서다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.materialIssueRequest;

export type { LookupEntry };

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다 */
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

/** 품목은 기준단위를 함께 들고 온다 — 손으로 더한 줄의 단위를 자동으로 채우는 데 쓴다. */
export interface ItemLookupEntry extends LookupEntry {
  baseUomId: number;
}

export interface ItemLookupResult extends LookupResult {
  entries: ItemLookupEntry[];
}

export const EMPTY_ENTRIES: LookupEntry[] = [];

const EMPTY_ITEM_ENTRIES: ItemLookupEntry[] = [];

export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸 아래에 붙일 안내.
 *
 * **실패가 잘림보다 앞선다** — 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 낡은 자료와
 * 실패가 함께 참이 된다. 그때 「일부만 보인다」고만 말하면 목록이 낡았다는 사실이 가려진다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  warehouses: ['material-issue-request-lookups', 'warehouses'] as const,
  locations: (warehouseId: number) =>
    ['material-issue-request-lookups', 'locations', warehouseId] as const,
  locationDetail: (locationId: number) =>
    ['material-issue-request-lookups', 'location-detail', locationId] as const,
  items: ['material-issue-request-lookups', 'items'] as const,
  uoms: ['material-issue-request-lookups', 'uoms'] as const,
};

export const useWarehouseOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.warehouses,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.warehouseId),
        label: `${item.warehouseCode} · ${item.warehouseName}`,
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
 * 도착 위치 — **창고를 고른 뒤에만 조회한다**(계약이 `warehouseId` 를 필수로 요구한다).
 *
 * 창고를 고르기 전에는 요청을 보내지 않고 빈 목록을 낸다. 그 사이 발행은 도착 위치가 비어
 * 막히고, 버튼이 그 사유를 낸다.
 */
export const useLocationOptions = (warehouseId: number | null): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.locations(warehouseId ?? 0),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 위치를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/locations', {
          params: { query: { warehouseId, includeInactive: true } },
        }),
      );
    },
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.locationId),
        label: `${item.locationCode} · ${item.locationName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    /* 아직 묻지 않은 상태를 「불러오는 중」으로 말하지 않는다 — 창고를 고르면 그때 시작한다. */
    isLoading: warehouseId !== null && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

export interface LocationDetailResult {
  /** 그 위치가 속한 창고. 못 풀었으면 `null` */
  warehouseId: number | null;
  isError: boolean;
  isLoading: boolean;
}

/**
 * W/O 의 기본 재공 위치가 어느 창고에 속하는지 푼다 — 창고칸을 **자동으로 채우는** 유일한 단서다.
 *
 * ⛔ **실패하면 조용히 첫 창고를 고르지 않는다.** 못 풀면 사용자가 직접 고른다. 지어낸 창고로
 * 채우면 잘못된 위치가 되돌릴 수 없는 전표에 실린다.
 */
export const useLocationDetail = (locationId: number | null): LocationDetailResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.locationDetail(locationId ?? 0),
    enabled: locationId !== null,
    queryFn: () => {
      if (locationId === null) {
        throw new Error('기본 재공 위치가 없는 W/O 에서는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/locations/{locationId}', { params: { path: { locationId } } }),
      );
    },
  });

  /* 상세는 위치와 편집 가능 여부를 함께 준다(계약 실측) — 우리가 쓰는 것은 창고 하나다. */
  return {
    warehouseId: query.data?.location.warehouseId ?? null,
    isError: query.isError,
    isLoading: locationId !== null && query.isPending,
  };
};

/** 품목 — 손으로 더한 줄의 품목 선택칸과, BOM 유래 줄의 이름 표시가 함께 쓴다. */
export const useItemOptions = (): ItemLookupResult => {
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
        baseUomId: item.baseUomId,
      })) ?? EMPTY_ITEM_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 단위 — 이름 풀이와 손으로 더한 줄의 단위 선택칸이 쓴다.
 *
 * **조회가 실패해도 막지 않는다** — `uomId` 는 값으로 이미 들고 있고, 사라지는 것은 이름뿐이다.
 */
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

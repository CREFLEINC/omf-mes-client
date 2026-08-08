import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 선택 목록 **여섯** —
 * 창고·위치·품목·LOT·단위·소유처.
 *
 * 여섯인 이유는 계약에 있다: `InventoryBalance`에는 **이름 필드가 하나도 없다.**
 * 잔액 응답에 `lotNo`·`itemCode`·`locationCode`를 포함해 달라는 계약 개선을 이슈에
 * 올려 두었으며, 반영되면 참조 셋이 통째로 사라진다.
 *
 * **둘은 조건에 매달린다** — 위치는 창고에(계약이 `warehouseId`를 필수로 요구한다),
 * LOT은 품목과 보기에(LOT을 번호 여러 개로 조회할 수단이 없어 품목이 범위를 정한다).
 * 매달림은 `enabled`로만 표현한다 — 화면이 조건을 다시 계산하면 두 곳이 어긋난다.
 *
 * 전부 `includeInactive=true`로 받는다. 기본 조회는 사용 중인 것만 내려주므로 미사용
 * 창고·위치·품목을 참조하는 과거 재고가 오면 이름이 비어 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stockStatus;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. **셋을 함께 들고 있어야 세 갈래를 가를 수 있다** —
 * 아직 오지 않음 · 목록에 없음 · 불러오기 실패.
 */
export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다 */
  truncated: boolean;
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

/**
 * 참조 값 하나의 표기 상태.
 *
 * **네 갈래를 타입으로 가른다.** 하나로 뭉개면 #47이 그대로 되살아난다 —
 * 본 자료가 참조 목록보다 먼저 오는 순간 정상 값이 「알 수 없음」으로 보이고,
 * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다.
 *
 * **어느 갈래에도 번호를 담지 않는다**(#44). 담을 자리가 없으면 화면으로 샐 경로도 없다.
 *
 * **`null`이 확정된 뜻을 갖는 자리는 여기로 오지 않는다**(계획 결정 10) —
 * `lotId`(「(LOT 무관)」)·`ownerPartnerId`(「(자사 소유)」)는 표가 넘기기 전에 갈라낸다.
 */
export type ReferenceState =
  { kind: 'named'; label: string } | { kind: 'unknown' } | { kind: 'loading' } | { kind: 'failed' };

/**
 * 참조 하나를 표기 상태로 옮긴다.
 *
 * 순서가 뜻을 정한다 — **실패 · 미도착이 「목록에 없음」보다 앞선다.** 목록이 없거나 못 받은 것을
 * 「그 값이 목록에 없다」로 판정하면 정상 값에 잘못된 값이라는 표를 붙이는 셈이다.
 *
 * `String(id)`는 **맞춰 보기 위한 것이지 표시를 위한 것이 아니다** — 결과 어디에도 담기지 않는다.
 */
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

/** 표기 상태를 화면 문구로 옮긴다. 네 갈래의 문구가 서로 달라야 뜻이 구분된다. */
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

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 창고가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
 * 그때 「일부만 보인다」고만 말하면 지금 목록이 **낡았다는 사실**이 가려진다.
 *
 * 화면이 아니라 여기에 둔다 — 판정이 `LookupResult`의 두 필드로만 정해져
 * 화면을 띄우지 않고 단위로 고정할 수 있다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  warehouses: ['stock-status-lookups', 'warehouses'] as const,
  locations: (warehouseId: number | null) =>
    ['stock-status-lookups', 'locations', warehouseId] as const,
  items: ['stock-status-lookups', 'items'] as const,
  lots: (itemId: number | null) => ['stock-status-lookups', 'lots', itemId] as const,
  uoms: ['stock-status-lookups', 'uoms'] as const,
  partners: ['stock-status-lookups', 'partners'] as const,
};

/**
 * 창고 — 조건 줄의 창고 선택칸이 쓴다.
 *
 * **이 화면의 필수 조건이라 늘 부른다.** 고르기 전에는 조회 자체가 나가지 않으므로
 * 이 목록이 오지 않으면 사용자가 화면에서 할 수 있는 일이 아무것도 없다.
 */
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
 * 위치 — 조건 줄의 위치 선택칸과 위치별 보기의 그룹 헤더가 함께 쓴다.
 *
 * **창고를 고른 뒤에만 부른다.** 계약이 `warehouseId`를 **필수**로 요구해(실측)
 * 창고 없이는 부를 수조차 없다. 이것이 창고를 화면 필수로 둔 근거 셋 중 하나다.
 */
export const useLocationOptions = (warehouseId: number | null): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.locations(warehouseId),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 위치 목록을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/locations', { params: { query: { warehouseId, includeInactive: true } } }),
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
    /*
     * 부르지 않는 동안을 「아직 오지 않았다」로 두지 않는다 — 창고를 고르기 전의 표는
     * 애초에 그려지지 않고, 로딩으로 두면 영영 오지 않는 것을 기다리는 표기가 된다.
     */
    isLoading: warehouseId !== null && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 품목 — 조건 줄의 품목 선택칸과 세 보기의 품목 칸·그룹 헤더가 함께 쓴다. */
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
 * LOT — 조건 줄의 LOT 선택칸과 LOT별 보기의 LOT 칸이 함께 쓴다.
 *
 * **품목을 고르고 LOT별 보기일 때만 부른다**(계획 결정 11). 잔액 응답에 `lotNo`가 없고
 * `/trace/lots`에는 **번호 여러 개로 한 번에 조회하는 수단이 없다**(실측) — 품목이
 * 범위를 정하지 않으면 표의 LOT 칸이 거의 전부 「알 수 없음」이 되어, 정상 값이
 * 잘못된 값으로 보인다(#47이 금지한 표기).
 *
 * 위치가 창고에 매달리는 것과 **같은 갈래의 규칙**이다.
 */
export const useLotOptions = (itemId: number | null, enabled: boolean): LookupResult => {
  const { client } = useApiClient();
  const active = enabled && itemId !== null;

  const query = useQuery({
    queryKey: lookupKeys.lots(itemId),
    enabled: active,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 LOT 목록을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/trace/lots', { params: { query: { itemId } } }));
    },
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.lotId),
        label: item.lotNo,
        /* LOT에는 사용 여부 필드가 없다 — 폐기·소진은 `statusCode`가 나르며 그것은 표식이 아니다. */
        isActive: true,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: active && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 단위 — 세 보기의 단위 칸이 쓴다. 조건에는 없다. */
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
        label: item.uomCode,
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
 * 소유처(거래처) — 세 보기의 소유 칸이 쓴다.
 *
 * 계약이 소유처를 「소유가 자사가 아닐 때의 거래처」로 두어 **비어 있는 것이 정상**이다.
 * 그 자리는 표가 「(자사 소유)」로 갈라 내며 이 목록에 묻지 않는다(계획 결정 10).
 */
export const usePartnerOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.partners,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.partnerId),
        label: `${item.partnerCode} · ${item.partnerName}`,
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

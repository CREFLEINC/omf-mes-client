import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, LotLookupEntry, PageMeta, SelectOption } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조 다섯.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고(`code-options.ts`), 나머지는 전부 계약이 이름을 준다.
 *
 * | 참조 | 경로 | 보이는 자리 | 언제 부르나 |
 * | --- | --- | --- | --- |
 * | 창고 | `/mdm/warehouses` | 원천 구획의 창고 선택칸·이름 | **첫 진입** |
 * | 위치 | `/mdm/locations?warehouseId=` | 라인 표의 위치 칸 | **대상 창고를 안 뒤** |
 * | 품목 | `/mdm/items` | 라인 표의 품목 칸 | 대상 창고를 안 뒤 |
 * | 단위 | `/mdm/uoms` | 수량 표기 | 대상 창고를 안 뒤 |
 * | 자재 LOT | `/trace/lots?itemId=` | 라인 표의 LOT 칸 | **줄이 품목을 가리킨 뒤** |
 *
 * 창고만 첫 진입에 부른다 — 직접 등록 갈래는 창고를 고르는 것으로 시작하고, 실사 갈래도 고른
 * 실사의 창고 이름을 곧바로 보인다. 나머지 넷은 창고가 정해져야 부를 수 있거나(위치 — 계약이
 * `warehouseId`를 필수로 요구한다) 라인이 서야 쓰인다.
 *
 * **참조 조회를 좁히지 않는다**(사본 체크리스트 10번). 선택지를 좁힌 조회를 이름 풀이에도 쓰면
 * 좁힘 밖의 정상 자료가 「알 수 없음」으로 보인다. 자재 LOT만 품목으로 갈라 받는데, 그것은
 * 좁힘이 아니라 **계약이 번호 목록으로 받는 조건을 주지 않아서**다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stockAdjust;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. **넷을 함께 들고 있어야 네 갈래를 가를 수 있다** —
 * 아직 오지 않음 · 목록에 없음 · 불러오기 실패 · 정상.
 */
export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
  /**
   * 목록이 잘렸으면 참.
   *
   * **읽는 쪽이 이 값을 볼 수 있어야 한다.** 잘린 목록으로 이름을 풀면 그 뒤의 정상 값이
   * 「알 수 없음」으로 찍히는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  truncated: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

/** 자재 LOT — 항목마다 어느 품목의 것인지 함께 든다(선택지를 그 줄의 품목으로 좁히는 근거). */
export interface LotLookupResult extends LookupResult {
  entries: LotLookupEntry[];
}

/**
 * 참조 값 하나의 표기 상태. **네 갈래를 타입으로 가른다.**
 *
 * 하나로 뭉개면 본 자료가 참조 목록보다 먼저 오는 순간 정상 값이 「알 수 없음」으로 보이고,
 * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다.
 *
 * **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`). 담을 자리가 없으면 화면으로 샐 경로도 없다.
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

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다** — 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 자료의 이름을 풀기 위해서인데, 빼면 그 값을 고를 수도 없다.
 * 지금은 쓰지 않는 위치에 남은 재고를 조정하는 것이 이 화면의 정상 업무다.
 */
export const toSelectOptions = (lookup: ReferenceSource): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * 그 줄의 품목이 가진 LOT만 고르게 한다 — **좁힘은 선택지 한 자리에만 건다**
 * (사본 체크리스트 10번). 이름 풀이는 위 `toReference`가 받은 전체로 한다.
 *
 * 품목을 아직 고르지 않았으면 고를 LOT도 없다 — 다른 품목의 LOT을 보이면 사용자가 그것을
 * 고를 수 있고, 그 줄은 서버가 거절한다.
 */
export const lotOptionsFor = (lookup: LotLookupResult, itemId: string): SelectOption[] =>
  itemId === ''
    ? []
    : toSelectOptions({
        ...lookup,
        entries: lookup.entries.filter((entry) => entry.itemId === itemId),
      });

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];
const EMPTY_LOT_ENTRIES: LotLookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸·표 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 위치가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료와 실패가 함께 참이 된다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.lookups.failed;
  if (lookup.truncated) return t.lookups.truncated;

  return undefined;
};

/**
 * 자재 LOT 조회의 쪽 크기.
 *
 * **다섯 참조 중 여기에만 쪽 크기를 싣는다.** 나머지 넷은 기준정보라 서버 기본값으로 충분하다.
 * **이 값에는 계약 근거가 없다** — `size`에 `maximum`이 없어 화면이 정한 완화값이며 보장이
 * 아니다. 자재 LOT은 다섯 중 유일한 **거래 기록**이라 한 품목의 LOT이 시간이 갈수록 쌓인다 —
 * 그래도 잘리면 `truncated`가 그 사실을 밝힌다.
 */
export const LOT_PAGE_SIZE = 200;

export const lookupKeys = {
  warehouses: ['stock-adjust-lookups', 'warehouses'] as const,
  /** 위치는 **창고마다** 캐시가 갈린다 — 계약이 창고를 필수 조건으로 요구한다. */
  locations: (warehouseId: number) => ['stock-adjust-lookups', 'locations', warehouseId] as const,
  items: ['stock-adjust-lookups', 'items'] as const,
  uoms: ['stock-adjust-lookups', 'uoms'] as const,
  /** LOT은 **품목마다** 캐시가 갈린다 — 한 요청이 한 품목의 LOT만 담기 때문이다. */
  lots: (itemId: number) => ['stock-adjust-lookups', 'lots', itemId] as const,
};

/**
 * 창고 — 직접 등록 갈래의 선택칸과 실사 갈래의 창고 이름이 같은 목록을 쓴다.
 *
 * **`includeInactive=true`로 한 번 받아 둔다.** 기본 조회는 사용 중인 것만 내려주므로,
 * 지금은 쓰지 않는 창고를 대상으로 한 과거 실사가 오면 이름이 비어 보인다.
 */
export const useWarehouseLookup = (): LookupResult => {
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
 * 위치 — **대상 창고를 안 뒤에만 부를 수 있다.**
 *
 * 계약이 `warehouseId`를 **필수 쿼리**로 요구한다 — 창고를 모르면 요청 자체가 성립하지
 * 않으므로 부르지 않는다. 「조회가 성립하지 않는데 하위 요청만 나가 스켈레톤에 갇힌다」를
 * 구조로 막는 자리다.
 */
export const useLocationLookup = (warehouseId: number | null): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.locations(warehouseId ?? 0),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('대상 창고를 알기 전에는 위치를 조회하지 않습니다.');
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
    isLoading: warehouseId !== null && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 품목 — 라인 표의 품목 칸이 쓴다. **대상 창고가 정해진 뒤 부른다** — 그전에는 줄이 없다. */
export const useItemLookup = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.items,
    enabled,
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
    isLoading: enabled && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 단위 — 장부·실물·차이 세 칸의 수량 표기가 함께 쓴다. */
export const useUomLookup = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.uoms,
    enabled,
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
    isLoading: enabled && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 자재 LOT — 라인 표의 LOT 칸이 쓴다.
 *
 * **번호 여러 개로 한 번에 조회하는 수단이 계약에 없다.** 그래서 **줄이 가리키는 품목마다
 * 한 번씩 받아** 번호로 맞춘다. 품목으로 갈라 받지 않고 전체를 받으면 첫 쪽에 없는 LOT이
 * 전부 「목록에 없음」이 되어 **정상 값이 잘못된 값으로 보인다**.
 */
export const useLotLookup = (itemIds: readonly number[], enabled: boolean): LotLookupResult => {
  const { client } = useApiClient();

  /*
   * 같은 품목의 줄이 여럿이면 요청도 여러 번 나간다 — 중복을 먼저 없앤다.
   * 정렬은 캐시 키를 안정시키려는 것이 아니라(키는 품목마다 따로다) 요청 순서를 읽기 쉽게 둔다.
   */
  const uniqueItemIds = [...new Set(itemIds)].sort((left, right) => left - right);

  const results = useQueries({
    queries: uniqueItemIds.map((itemId) => ({
      queryKey: lookupKeys.lots(itemId),
      enabled,
      queryFn: () =>
        runRequest(() =>
          client.GET('/trace/lots', { params: { query: { itemId, size: LOT_PAGE_SIZE } } }),
        ),
    })),
  });

  const loaded = results.flatMap((result) => (result.data === undefined ? [] : [result.data]));

  return {
    entries:
      loaded.length === 0
        ? EMPTY_LOT_ENTRIES
        : loaded.flatMap((data) =>
            data.items.map((item) => ({
              value: String(item.lotId),
              label: item.lotNo,
              /* LOT에는 사용 여부 필드가 없다 — 폐기·소진은 상태 코드가 나르며 표식이 아니다. */
              isActive: true,
              itemId: String(item.itemId),
            })),
          ),
    truncated: loaded.some((data) => isTruncated(data.page, data.items.length)),
    /* 하나라도 실패하면 실패다 — 일부만 받은 목록으로 「목록에 없음」을 판정할 수 없다. */
    isError: results.some((result) => result.isError),
    isLoading: enabled && results.some((result) => result.isPending),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

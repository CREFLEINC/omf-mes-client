import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고(`code-options.ts`), 나머지는 전부 계약이 이름을 준다.
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 17). 실패 안내와 「다시 시도」는 그 이름이
 * 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있다.
 *
 * | 참조 | 경로 | 보이는 자리 | 복구 | 언제 부르나 | 어느 PR |
 * | --- | --- | --- | --- | --- | :-: |
 * | 창고 | `/mdm/warehouses` | 목록 표 · 제목줄 · 조건 줄 선택지 · 개시 폼 | **위 구획** | 첫 진입 | ① |
 * | 위치 | `/mdm/locations?warehouseId=` | 위치 선택칸 · 라인 표 제목줄 | **아래 구획** | **실사를 고른 뒤** | ③ |
 * | 품목 | `/mdm/items` | 라인 표의 칸 | **아래 구획** | **위치를 고른 뒤** | ③ |
 * | 단위 | `/mdm/uoms` | 라인 표의 수량 표기 | **아래 구획** | **위치를 고른 뒤** | ③ |
 * | 자재 LOT | `/trace/lots?itemId=` | 라인 표의 칸 | **아래 구획** | **위치를 고른 뒤** | ③ |
 *
 * **다섯이 다 섰다.** 「언제 부르나」가 셋으로 갈리는 것이 이 표의 요점이다 —
 * 이름이 나타나는 **시점**이 다르기 때문이다. 창고는 목록 응답만으로 곧바로 그려지고,
 * 위치 선택칸은 실사를 골라 **창고를 알아야** 부를 수 있으며(계약이 `warehouseId`를 필수로
 * 요구한다), 라인 표의 칸 셋은 **라인 응답이 와야** 그려진다 — 라인을 기다리는 동안 도착할
 * 여유가 있어 미리 받을 이득이 없고 첫 진입의 요청 수만 이유 없이 는다.
 *
 * **복구 버튼의 자리도 갈린다.** 위치는 못 받으면 라인 표 자체가 열리지 않으므로 복구가
 * **위치 선택칸**에 붙고, 나머지 셋은 표 아래에 붙는다 — 표 아래에 몰면 위치 실패는
 * **보이지도 않는 실패의 복구 버튼**이 된다(W-01-10이 공장에서 겪은 자리).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stocktaking;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. **셋을 함께 들고 있어야 네 갈래를 가를 수 있다** —
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
   * 그래서 `isError`·`isLoading`과 같은 층에 둔다 — 이름을 내는 구획이 사실을 밝힐 수 있게.
   */
  truncated: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
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
 */
export type ReferenceState =
  | { kind: 'named'; label: string }
  | { kind: 'unknown' }
  | { kind: 'loading' }
  | { kind: 'failed' };

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
 * 선택칸·표 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 창고가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

/**
 * 자재 LOT 조회의 쪽 크기.
 *
 * **다섯 참조 중 여기에만 쪽 크기를 싣는다.** 나머지 넷은 기준정보라 서버 기본값으로 충분하다.
 * **이 값에는 계약 근거가 없다** — `size`에 `maximum`이 없어(실측) 화면이 정한 완화값이며
 * 보장이 아니다. 자재 LOT은 다섯 중 유일한 **거래 기록**이라 한 품목의 LOT이 시간이 갈수록
 * 쌓인다 — 그래도 잘리면 `truncated`가 그 사실을 밝힌다(라인 표의 안내).
 */
export const LOT_PAGE_SIZE = 200;

export const lookupKeys = {
  warehouses: ['stocktaking-lookups', 'warehouses'] as const,
  /** 위치는 **창고마다** 캐시가 갈린다 — 계약이 창고를 필수 조건으로 요구한다. */
  locations: (warehouseId: number) => ['stocktaking-lookups', 'locations', warehouseId] as const,
  items: ['stocktaking-lookups', 'items'] as const,
  uoms: ['stocktaking-lookups', 'uoms'] as const,
  /** LOT은 **품목마다** 캐시가 갈린다 — 한 요청이 한 품목의 LOT만 담기 때문이다. */
  lots: (itemId: number) => ['stocktaking-lookups', 'lots', itemId] as const,
};

/**
 * 창고 — **목록 표의 칸·고른 실사의 제목줄·조건 줄의 선택지가 같은 목록을 쓴다.**
 *
 * **`includeInactive=true`로 한 번 받아 둔다.** 기본 조회는 사용 중인 것만 내려주므로,
 * 지금은 쓰지 않는 창고를 대상으로 한 과거 실사가 오면 이름이 비어 보인다. 미사용 값을
 * 선택지에서 빼지도 않는다 — 빼면 그 실사를 조건으로 찾을 방법이 사라진다. 표식만 붙인다.
 *
 * **첫 진입에 부른다.** 목록 표의 창고 칸이 목록 응답과 함께 곧바로 그려지므로 고른 뒤에
 * 부르기 시작하면 첫 화면의 이름이 한 박자 늦게 채워진다.
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
 * 위치 — **결과 등록의 축이고, 실사를 고른 뒤에만 부를 수 있다.**
 *
 * 계약이 `warehouseId`를 **필수 쿼리**로 요구한다(실측) — 창고를 모르면 요청 자체가
 * 성립하지 않으므로 실사 상세가 도착해 창고를 알기 전에는 부르지 않는다. 「조회가 성립하지
 * 않는데 하위 요청만 나가 스켈레톤에 갇힌다」(W-01-07 Minor)를 구조로 막는 자리다.
 *
 * **미사용 위치를 빼지 않고 표식만 붙인다.** 지금은 쓰지 않는 위치에 남은 재고를 세는 것이
 * 실사의 목적 중 하나라, 빼면 그 위치의 라인을 볼 방법이 사라진다.
 */
export const useLocationLookup = (warehouseId: number | null): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.locations(warehouseId ?? 0),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('창고를 알기 전에는 위치를 조회하지 않습니다.');
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

/**
 * 품목 — 라인 표의 품목 칸이 쓴다.
 *
 * **위치를 고르기 전에는 부르지 않는다**(`enabled`) — 단위·LOT과 **같은 부품·같은 시점**이다.
 * 이름이 필요한 라인 표 자체가 라인 응답을 기다리므로 미리 받아 둘 이득이 없다.
 */
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

/** 단위 — 라인 표의 **수량 표기**에서만 보인다(단위 열을 따로 두지 않는다). */
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
 * **번호 여러 개로 한 번에 조회하는 수단이 계약에 없다**(실측: `/trace/lots`의 조건은
 * `itemId`·`plantId`·`statusCode`·`q` 등이고 번호 목록을 받는 조건이 없다). 그래서
 * **라인이 가리키는 품목마다 한 번씩 받아 번호로 맞춘다**(W-01-07·W-01-10이 세운 형태).
 *
 * 품목으로 좁히지 않고 전체를 받으면 첫 쪽에 없는 LOT이 전부 「목록에 없음」이 되어
 * **정상 값이 잘못된 값으로 보인다**(#47이 금지한 표기).
 */
export const useLotLookup = (itemIds: readonly number[], enabled: boolean): LookupResult => {
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
    entries: loaded.flatMap((data) =>
      data.items.map((item) => ({
        value: String(item.lotId),
        label: item.lotNo,
        /* LOT에는 사용 여부 필드가 없다 — 폐기·소진은 `statusCode`가 나르며 그것은 표식이 아니다. */
        isActive: true,
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

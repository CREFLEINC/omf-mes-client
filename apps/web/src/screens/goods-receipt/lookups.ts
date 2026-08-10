import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조 **다섯** — 공급사·공장·품목·단위·**자재 LOT**.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고(`status-options.ts`), 나머지는 전부 계약이 이름을 준다.
 *
 * 전부 `includeInactive=true`로 한 번 받아 둔다. 기본 조회는 사용 중인 것만 내려주므로,
 * 미사용 값을 참조하는 입하가 오면 이름이 비어 보인다 — 지금은 쓰지 않는 거래처·품목을
 * 참조하는 과거 입하가 실제로 있다. (자재 LOT에는 사용 여부 조건 자체가 없다.)
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 17). 실패 안내와 「다시 시도」는 그 이름이
 * 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있다.
 *
 * | 참조 | 보이는 자리 | 복구 | 언제 부르나 |
 * | --- | --- | --- | --- |
 * | 공급사 | 목록 표의 칸 · 조건 칩 | **위 구획** | 첫 진입 |
 * | 공장 | 고른 전표의 제목줄 | **아래 구획** | 첫 진입 |
 * | 품목 | 라인 표의 칸 | **아래 구획** | 첫 진입 |
 * | 단위 | 라인 표의 수량 표기 | **아래 구획** | **전표를 고른 뒤** |
 * | **자재 LOT** | 라인 표의 칸 | **아래 구획** | **전표를 고른 뒤** |
 *
 * 공장이 아래에 있는 이유가 이 표의 요점이다 — 목록 표에는 공장 열이 없어(폭 예산상
 * 제목줄로 보냈다) 위 구획에 두면 **보이지도 않는 실패의 복구 버튼**이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.goodsReceipt;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. **셋을 함께 들고 있어야 네 갈래를 가를 수 있다** —
 * 아직 오지 않음 · 목록에 없음 · 불러오기 실패 · 정상.
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
 * 찾는 값이 없으면 「그런 공급사가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  suppliers: ['goods-receipt-lookups', 'suppliers'] as const,
  plants: ['goods-receipt-lookups', 'plants'] as const,
  items: ['goods-receipt-lookups', 'items'] as const,
  uoms: ['goods-receipt-lookups', 'uoms'] as const,
  /** LOT은 **품목마다** 캐시가 갈린다 — 한 요청이 한 품목의 LOT만 담기 때문이다. */
  lots: (itemId: number) => ['goods-receipt-lookups', 'lots', itemId] as const,
};

/**
 * 공급사 — 목록 표의 공급사 칸과 조건 줄의 공급사 선택지가 함께 쓴다.
 *
 * 계약이 거래처를 공급사·고객으로 가르는 조건을 주지 않으므로 전체 거래처를 받는다.
 * 좁혀 받을 근거가 생기면 그때 쿼리를 더한다 — 지금 지어내면 고를 수 있는 값이 사라진다.
 */
export const useSupplierOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.suppliers,
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

/**
 * 공장 — 고른 전표의 제목줄이 쓴다. 조건에는 없다(계약에 있으나 화면 조건으로 두지 않았다).
 *
 * **고르기 전에도 부른다.** 단위·LOT과 달리 잠그지 않는 이유는 이름이 **제목줄에 곧바로**
 * 필요해서다 — 전표를 고른 순간 라인 조회와 참조 조회가 함께 시작되면 제목줄이
 * 「이름 불러오는 중」에서 한 박자 늦게 채워진다. 요청 수는 화면당 한 번이다.
 */
export const usePlantOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.plants,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.plantId),
        label: `${item.plantCode} · ${item.plantName}`,
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

/** 품목 — 라인 표의 품목 칸이 쓴다. 공장과 같은 이유로 미리 받아 둔다. */
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
 * 단위 — 라인 표의 수량 표기에서만 보인다(단위 열을 따로 두지 않는다).
 *
 * **전표를 고르기 전에는 부르지 않는다**(`enabled`). 쓰지 않는 상태에서 부르면
 * 어느 요청이 무엇을 위한 것인지 가릴 수 없고, 첫 진입의 요청 수가 이유 없이 는다.
 */
export const useUomOptions = (enabled: boolean): LookupResult => {
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
 * **고른 전표의 라인이 가리키는 품목마다 한 번씩 받아 번호로 맞춘다**(W-01-07이 세운 형태).
 *
 * 품목으로 좁히지 않고 전체를 받으면 첫 쪽에 없는 LOT이 전부 「목록에 없음」이 되어
 * **정상 값이 잘못된 값으로 보인다**(#47이 금지한 표기). 좁혀 받으면 그 위험이 작아지고,
 * 그래도 잘리면 잘림 표식이 그 사실을 밝힌다.
 *
 * **전표를 고르기 전에는 부르지 않는다** — 고르기 전에는 풀 LOT 번호 자체가 없다.
 */
export const useLotOptions = (itemIds: readonly number[], enabled: boolean): LookupResult => {
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
        runRequest(() => client.GET('/trace/lots', { params: { query: { itemId } } })),
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

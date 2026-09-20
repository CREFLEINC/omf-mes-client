import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조 **다섯** — 공급사·공장·품목·단위·**자재 LOT**.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고(`status-options.ts`), 나머지는 전부 계약이 이름을 준다.
 *
 * 목록으로 받는 것들은 `includeInactive=true`로 받는다. 기본 조회는 사용 중인 것만 내려주므로,
 * 미사용 값을 참조하는 입하가 오면 이름이 비어 보인다 — 지금은 쓰지 않는 거래처를 참조하는
 * 과거 입하가 실제로 있다. (자재 LOT에는 사용 여부 조건 자체가 없다.)
 *
 * **목록으로 받을 수 있는 것과 없는 것이 갈린다.** 한 쪽에 담기는 만큼만 이름을 얻는 방식은
 * 마스터가 그보다 크면 나머지를 조용히 비운다 — 품목이 그래서 **번호로 하나씩** 푼다
 * (`useItemNames`), 자재 LOT이 **품목마다** 좁혀 받는 것과 같은 이유다.
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 17). 실패 안내와 「다시 시도」는 그 이름이
 * 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있다.
 *
 * | 참조 | 보이는 자리 | 복구 | 언제 부르나 |
 * | --- | --- | --- | --- |
 * | 공급사 | 목록 표의 칸 · 조건 칩 | **위 구획** | 첫 진입 |
 * | 공장 | 고른 전표의 **제목줄** | **아래 구획** | 첫 진입 |
 * | 품목 | 라인 표의 칸 | **아래 구획** | **전표를 고른 뒤** |
 * | 단위 | 라인 표의 수량 표기 | **아래 구획** | **전표를 고른 뒤** |
 * | **자재 LOT** | 라인 표의 칸 | **아래 구획** | **전표를 고른 뒤** |
 *
 * 공장이 아래에 있는 이유가 이 표의 요점이다 — 목록 표에는 공장 열이 없어(폭 예산상
 * 제목줄로 보냈다) 위 구획에 두면 **보이지도 않는 실패의 복구 버튼**이 된다.
 *
 * **「언제 부르나」가 공장만 다른 이유**는 그 이름이 나타나는 **시점**이 다르기 때문이다.
 * 제목줄은 목록 응답만으로 곧바로 그려지지만(고른 행의 값이 거기 있다) 라인 표의 칸은
 * **라인 응답이 와야** 그려진다 — 라인을 기다리는 동안 나머지 셋이 도착할 여유가 있다.
 * 그래서 제목줄이 쓰는 공장만 미리 받고, 라인 표가 쓰는 셋은 전표를 고른 뒤에 부른다.
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

/**
 * 자재 LOT 조회의 쪽 크기.
 *
 * **다섯 참조 중 여기에만 쪽 크기를 싣는다.** 나머지 넷은 기준정보라 서버 기본값으로 충분하고,
 * 그 사실이 `filters.ts`에도 적혀 있다(「쪽 크기는 서버 기본값을 쓴다」).
 *
 * **이 값에는 계약 근거가 없다.** 계약 정본(비공개)에는 `size`에 상한이 적혀 있지 않으나,
 * **이 저장소에서는 그 사실을 확인할 수 없다** — 생성물(`api.d.ts`)이 수치 제약과 쿼리
 * 파라미터 기본값을 싣지 않아 `maximum`도 `default`도 나타나지 않는다. 그러므로 이 숫자는
 * **화면이 정한 완화값이며 보장이 아니다.**
 *
 * 한 품목의 LOT이 몇 건인지 화면이 알 수 없으므로 어떤 값을 넣어도 잘릴 수 있다 —
 * 잘렸다는 사실을 밝히는 것은 `truncated`이고, 이 값은 그 일이 **덜 일어나게** 할 뿐이다.
 * 무한정 키우지 않는 이유는 응답이 그만큼 무거워지고 얻는 것이 확률뿐이기 때문이다.
 * 서버가 상한을 두고 400을 돌려주면 이 값부터 의심한다 — 고칠 자리는 이 상수 하나다.
 */
export const LOT_PAGE_SIZE = 200;

export const lookupKeys = {
  suppliers: ['goods-receipt-lookups', 'suppliers'] as const,
  plants: ['goods-receipt-lookups', 'plants'] as const,
  /** 품목은 번호마다 하나씩 부른다 — 열쇠도 번호를 담는다. */
  itemName: (itemId: number) => ['goods-receipt-lookups', 'item-name', itemId] as const,
  uoms: ['goods-receipt-lookups', 'uoms'] as const,
  /** LOT은 **품목마다** 캐시가 갈린다 — 한 요청이 한 품목의 LOT만 담기 때문이다. */
  lots: (itemId: number) => ['goods-receipt-lookups', 'lots', itemId] as const,
};

/** 공급사를 한 번에 받는 건수 — 서버 상한(200)과 같다. */
const SUPPLIER_PAGE_SIZE = 200;
/** 끝까지 받되 이 쪽 수에서 멈춘다(5,000건) — 서버가 잘못된 총계를 줄 때 끝없이 부르지 않게 한다. */
const SUPPLIER_MAX_PAGES = 25;

/**
 * 공급사 — 목록 표의 공급사 칸과 조건 줄의 공급사 검색이 함께 쓴다.
 *
 * **끝까지 받는다**(200건씩 · 사용자 지시 2026-09-19). 첫 쪽만 받으면 그 뒤 공급사가 목록 표에서
 * 「알 수 없음」으로 찍히고 검색에서도 찾을 수 없다. 받은 수가 총계에 못 미치면(쪽 수 상한) 잘림으로 알린다.
 *
 * 계약이 거래처를 공급사·고객으로 가르는 조건을 주지 않으므로 전체 거래처를 받는다.
 */
export const useSupplierOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.suppliers,
    queryFn: async () => {
      const first = await runRequest(() =>
        client.GET('/mdm/partners', {
          params: { query: { includeInactive: true, page: 1, size: SUPPLIER_PAGE_SIZE } },
        }),
      );
      const items = [...first.items];
      let last = first.items.length;

      for (
        let page = 2;
        page <= SUPPLIER_MAX_PAGES &&
        last === SUPPLIER_PAGE_SIZE &&
        items.length < first.page.total;
        page += 1
      ) {
        const next = await runRequest(() =>
          client.GET('/mdm/partners', {
            params: { query: { includeInactive: true, page, size: SUPPLIER_PAGE_SIZE } },
          }),
        );
        items.push(...next.items);
        last = next.items.length;
      }

      return { items, page: first.page };
    },
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
 * **다섯 중 유일하게 고르기 전에도 부른다.** 제목줄은 **목록 응답만으로** 곧바로 그려지므로
 * (고른 행의 `plantId`가 거기 있다) 전표를 고른 뒤에 부르기 시작하면 제목줄만 한 박자 늦게
 * 채워진다. 라인 표가 쓰는 셋은 **라인 응답을 기다리는 동안** 도착할 여유가 있어 사정이 다르다.
 * 요청 수는 화면당 한 번이다.
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

/** 그 번호의 품목이 없다(404). **못 받은 것과 다르다** — 다시 부를 이유가 없다. */
const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 품목 — 라인 표의 품목 칸이 쓴다. **번호로 하나씩 푼다**(`GET /mdm/items/{itemId}`).
 *
 * ⛔ **목록 첫 쪽으로 풀지 않는다.** 종전에는 `GET /mdm/items`를 `size` 없이 한 번 받아
 *    그 안에서 이름을 찾았다 — 계약의 기본 쪽 크기가 50이라, 품목 마스터가 그보다 크면
 *    첫 쪽 밖의 품목을 실은 라인이 **전부 「알 수 없음」**으로 섰다. 그 문구는
 *    *값이 잘못됐다*는 뜻이라 사용자에게 정반대로 읽힌다(#47이 금지한 표기).
 * ⛔ **쪽을 돌며 다 받는 것으로 바꾸지 않는다**(공급사와 다른 선택이다). 품목 마스터는
 *    9,000건인 곳이 있어 첫 진입에 45번을 부르게 된다 — 얻는 것은 라인 표에 실제로 뜬
 *    서너 줄의 이름뿐이다. 공급사는 **조건 줄의 검색 선택지**이기도 해서 목록 자체가
 *    필요하지만, 품목은 이 화면에서 **이름을 푸는 데만** 쓴다.
 * ⭐ 부르는 횟수는 **고른 전표의 라인이 가리키는 품목 수**다 — 자재 LOT과 같은 짜임이라
 *    요청 수가 늘지 않는다. 같은 품목을 실은 줄이 여럿이면 요청도 하나다.
 *
 * 계약에 `itemIds` 같은 복수 번호 필터가 없어 한 번에 묶어 묻는 길이 없다.
 * 생기면 이 자리를 한 번의 요청으로 되돌린다.
 *
 * **전표를 고르기 전에는 부르지 않는다** — 고르기 전에는 물을 번호 자체가 없다.
 */
export interface ItemNameLookup {
  /**
   * 한 라인의 품목 표기 상태.
   *
   * **「목록에 없음」 갈래가 없다.** 번호마다 묻는 방식에서는 화면에 선 번호를 빠짐없이 묻고,
   * 그 답이 오지 않는 길은 실패뿐이다 — 목록 방식에만 「받은 쪽에 그 번호가 없다」가 있었다.
   * 라인의 `itemId`도 계약상 필수라 빈 값 갈래도 서지 않는다.
   */
  of: (itemId: number) => ReferenceState;
  /** 하나라도 실패했는가. 라인 구획의 실패 안내와 「다시 시도」가 이것을 본다. */
  isError: boolean;
  refetch: () => void;
}

type ItemClient = ReturnType<typeof useApiClient>['client'];

const fetchItemName = async (client: ItemClient, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  /* 상세는 봉투로 온다 — 편집 가능 여부(`editability`)는 이 화면이 쓰지 않는다. */
  const item = data.item;

  return `${item.itemCode} · ${masterName(item, item.itemName)}`;
};

export const useItemNames = (itemIds: readonly number[], enabled: boolean): ItemNameLookup => {
  const { client } = useApiClient();

  /** 같은 품목을 실은 줄이 여럿이면 요청은 하나다. 정렬은 요청 순서를 읽기 쉽게 둔다. */
  const uniqueIds = [...new Set(itemIds)].sort((left, right) => left - right);

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: lookupKeys.itemName(itemId),
      enabled,
      queryFn: () => fetchItemName(client, itemId),
    })),
  });

  return {
    of: (itemId) => {
      const index = uniqueIds.indexOf(itemId);
      const result = index === -1 ? undefined : results[index];

      if (result === undefined) return { kind: 'loading' };
      /* 없는 품목은 실패가 아니다 — 다시 불러도 같은 답이 온다. */
      if (result.isError)
        return isNotFound(result.error) ? { kind: 'unknown' } : { kind: 'failed' };

      return result.data === undefined
        ? { kind: 'loading' }
        : { kind: 'named', label: result.data };
    },
    isError: results.some((result) => result.isError && !isNotFound(result.error)),
    refetch: () => {
      for (const result of results) void result.refetch();
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
        code: item.uomCode,
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
 * **정상 값이 잘못된 값으로 보인다**(#47이 금지한 표기). 좁혀 받으면 그 위험이 작아진다.
 *
 * **그래도 잘릴 수 있다.** 자재 LOT은 다섯 참조 중 유일한 **거래 기록**이라(나머지 넷은
 * 기준정보) 한 품목의 LOT이 시간이 갈수록 쌓인다. 그래서 두 겹으로 다룬다 —
 * ① 쪽 크기를 명시해 잘림 **빈도를 낮추고**(`LOT_PAGE_SIZE`) ② 그래도 잘리면
 * **잘림 표식이 그 사실을 밝힌다**(`truncated` → 라인 표의 안내). ①은 완화이고 보장은 ②다.
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

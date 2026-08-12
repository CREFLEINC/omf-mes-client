import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, LotEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조 **다섯** — 창고·품목·단위·자재 LOT·위치.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고(`code-options.ts`), 나머지는 전부 계약이 이름을 준다.
 *
 * 기준정보는 `includeInactive=true`로 한 번 받아 둔다. 기본 조회는 사용 중인 것만 내려주므로,
 * 미사용 값을 참조하는 과거 입고가 오면 이름이 비어 보인다. (자재 LOT에는 사용 여부 조건
 * 자체가 없다.)
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 17). 실패 안내와 「다시 시도」는 그 이름이
 * 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있다.
 *
 * | 참조 | 보이는 자리 | 복구 | 언제 부르나 |
 * | --- | --- | --- | --- |
 * | 창고 | 조건 줄 · 목록 표 · 제목줄 | **위 구획** | 첫 진입 |
 * | 품목 | 라인 표 | **아래 구획** | **전표를 고른 뒤** |
 * | 단위 | 라인 표의 수량 표기 | **아래 구획** | 같은 위 |
 * | 자재 LOT | 라인 표의 LOT 칸 · **보류 표식** | **아래 구획** | 같은 위. **품목마다 한 번** |
 * | 위치 | 라인 표의 위치 칸 | **아래 구획** | 같은 위(**전표의 창고**로 조회) |
 * | **거래처(공급사)** | **반품 정보의 공급사 선택칸 · 확인 창 · 결과 구획** | **아래 구획** | **전표를 고른 뒤** |
 *
 * **거래처만 성질이 다르다.** 앞 다섯은 서버가 준 번호를 **이름으로 푸는** 참조이고, 거래처는
 * 사용자가 **고르는** 값이다 — 그래서 미사용 여부를 다루는 방식도 갈린다(아래 훅의 주석).
 *
 * **창고만 미리 받는 이유**는 그 이름이 나타나는 **시점**이 다르기 때문이다. 조건 줄과 목록
 * 표의 창고 칸은 **목록 응답만으로** 곧바로 그려지지만, 라인 표의 칸은 **상세 응답이 와야**
 * 그려진다 — 상세를 기다리는 동안 나머지 넷이 도착할 여유가 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.supplierReturn;

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
   * 그래서 `isError`·`isLoading`과 같은 층에 둔다.
   */
  truncated: boolean;
}

/** 자재 LOT 참조. **보류 여부를 함께 나른다** — 그것이 다른 넷과 다른 유일한 점이다. */
export interface LotReferenceSource extends Omit<ReferenceSource, 'entries'> {
  entries: readonly LotEntry[];
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

export interface LotLookupResult extends LotReferenceSource {
  entries: LotEntry[];
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

/**
 * 이 자재 LOT이 지금 보류 중인가.
 *
 * **모르는 것을 「보류 아님」으로 말하지 않는다** — 표식을 내지 않을 뿐이다. 같은 칸의 이름
 * 표기가 이미 「아직 못 풀었다」를 네 갈래로 말하고 있으므로, 여기서 셋째 「보류 알 수 없음」
 * 표기를 더하면 같은 사실을 두 번 말하게 된다.
 *
 * **막는 데 쓰지 않는다.** 보류된 LOT을 되돌려 보내는 것이 이 화면의 주 용도다.
 */
export const isLotHeld = (source: LotReferenceSource, lotId: number | null): boolean => {
  if (source.isError || source.isLoading || lotId === null) return false;

  return source.entries.find((entry) => entry.value === String(lotId))?.held ?? false;
};

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];

/**
 * 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다.
 *
 * **재고 잔액 조회도 이 규칙을 쓴다**(`queries.ts`). 잘림 판정이 두 곳에 각각 있으면 한쪽만
 * 고쳐져 「이름은 잘렸다는데 수량은 멀쩡하다고 하는」 어긋난 화면이 된다 — 이름이든 수량이든
 * 「일부만 받았다」는 사실은 하나다.
 */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸·표 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 창고가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
 */
export const lookupNote = (lookup: {
  isError: boolean;
  truncated: boolean;
}): string | undefined => {
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
 * **이 값에는 계약 근거가 없다.** 생성물이 수치 제약과 쿼리 파라미터 기본값을 싣지 않아
 * `maximum`도 `default`도 나타나지 않는다 — 그러므로 이 숫자는 **화면이 정한 완화값이며
 * 보장이 아니다.** 한 품목의 LOT이 몇 건인지 화면이 알 수 없으므로 어떤 값을 넣어도 잘릴 수
 * 있다. 잘렸다는 사실을 밝히는 것은 `truncated`이고, 이 값은 그 일이 **덜 일어나게** 할 뿐이다.
 * 서버가 상한을 두고 400을 돌려주면 이 값부터 의심한다 — 고칠 자리는 이 상수 하나다.
 */
export const LOT_PAGE_SIZE = 200;

export const lookupKeys = {
  warehouses: ['supplier-return-lookups', 'warehouses'] as const,
  items: ['supplier-return-lookups', 'items'] as const,
  uoms: ['supplier-return-lookups', 'uoms'] as const,
  /** LOT은 **품목마다** 캐시가 갈린다 — 한 요청이 한 품목의 LOT만 담기 때문이다. */
  lots: (itemId: number) => ['supplier-return-lookups', 'lots', itemId] as const,
  /** 위치는 **창고마다** 갈린다 — 계약이 창고를 필수 조건으로 둔다. */
  locations: (warehouseId: number) => ['supplier-return-lookups', 'locations', warehouseId] as const,
  partners: ['supplier-return-lookups', 'partners'] as const,
};

/**
 * 창고 — 조건 줄의 선택지와 목록 표·제목줄의 창고 칸이 함께 쓴다.
 *
 * **미사용 창고를 빼지 않는다.** 이 칸은 물건을 넣을 자리를 고르는 곳이 아니라 **과거 입고를
 * 찾는 조건**이다 — 지금은 쓰지 않는 창고로 들어온 입고가 실제로 있고, 빼면 그 입고를
 * 조건으로 찾을 방법이 사라진다. 대신 선택지에 표식을 붙인다.
 *
 * **다섯 중 유일하게 고르기 전에도 부른다** — 조건 줄과 목록 표가 첫 화면부터 이 이름을 쓴다.
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
 * 품목 — 라인 표의 품목 칸이 쓴다.
 *
 * **전표를 고르기 전에는 부르지 않는다**(`enabled`) — 단위·LOT·위치와 **같은 시점**이다.
 * 이름이 필요한 라인 표 자체가 상세 응답을 기다리므로, 미리 받아 둘 이득이 없고
 * 첫 진입의 요청 수만 이유 없이 는다.
 */
export const useItemOptions = (enabled: boolean): LookupResult => {
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

/**
 * 단위 — 라인 표의 수량 표기에서만 보인다(단위 열을 따로 두지 않는다).
 *
 * **전표를 고르기 전에는 부르지 않는다**(`enabled`).
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
 * 자재 LOT — 라인 표의 LOT 칸과 **보류 표식**이 쓴다.
 *
 * **번호 여러 개로 한 번에 조회하는 수단이 계약에 없다**(실측: `/trace/lots`의 조건은
 * `itemId`·`plantId`·`statusCode`·`q` 등이고 번호 목록을 받는 조건이 없다). 그래서
 * **고른 전표의 라인이 가리키는 품목마다 한 번씩 받아 번호로 맞춘다**(W-01-07이 세운 형태).
 *
 * 품목으로 좁히지 않고 전체를 받으면 첫 쪽에 없는 LOT이 전부 「목록에 없음」이 되어
 * **정상 값이 잘못된 값으로 보인다**(#47이 금지한 표기). 좁혀 받으면 그 위험이 작아진다.
 *
 * **그래도 잘릴 수 있다.** 자재 LOT은 다섯 참조 중 유일한 **거래 기록**이라 한 품목의 LOT이
 * 시간이 갈수록 쌓인다. 그래서 두 겹으로 다룬다 — ① 쪽 크기를 명시해 잘림 **빈도를 낮추고**
 * ② 그래도 잘리면 **잘림 표식이 그 사실을 밝힌다**. ①은 완화이고 보장은 ②다.
 *
 * **보류 여부는 이 응답이 함께 준다**(`held`) — 표식을 위해 요청을 더 보내지 않는다.
 */
export const useLotOptions = (
  itemIds: readonly number[],
  enabled: boolean,
): LotLookupResult => {
  const { client } = useApiClient();

  /*
   * **요청 수를 줄이려고 중복을 없애는 것이 아니다.** 캐시 키가 품목마다 하나라 같은 품목의
   * 쿼리는 어차피 한 벌로 합쳐지고, 그래서 중복을 남겨도 나가는 요청 수는 같다 — 이 줄을
   * 지워도 관측되는 차이가 없다는 뜻이며, 그 사실을 여기 적어 둔다.
   *
   * 없애는 이유는 **아래 계산의 분모를 줄 수가 아니라 품목 수로 두기 위해서다.** 중복을 남기면
   * 같은 응답이 `loaded`에 여러 번 들어와 `entries`에 같은 LOT이 겹치고, `isLoading`·`isError`가
   * 줄 수만큼 되풀이된 결과를 보게 된다. 정렬은 요청 순서를 읽기 쉽게 두는 것뿐이다.
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
        /*
         * **키가 없으면 보류가 아니다.** 계약이 선택 필드로 두었으므로(실측) 없는 것을
         * 보류로 읽으면 보류가 아닌 LOT에 표식이 붙는다 — 그쪽이 더 나쁜 거짓말이다.
         */
        held: item.held ?? false,
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

/**
 * 적치 위치 — 라인 표의 위치 칸이 쓴다. **그 라인이 놓인 자리이자 반품의 출발 위치**다.
 *
 * **고른 전표의 창고로 조회한다.** 계약이 `warehouseId`를 **필수 쿼리**로 두어(실측) 없이
 * 부르면 실패한다 — 화면이 스스로 만든 실패를 사용자에게 보이게 된다. 캐시 키가 창고 번호를
 * 담으므로 전표를 되돌려도 요청이 한 번을 넘지 않는다.
 *
 * **미사용 위치를 빼지 않는다** — 과거 입고가 그 자리에 적치돼 있을 수 있고, 여기서 위치는
 * 고르는 값이 아니라 **읽는 값**이다.
 */
export const useLocationOptions = (warehouseId: number | null): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.locations(warehouseId ?? 0),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('입고 전표를 고르기 전에는 적치 위치를 조회하지 않습니다.');
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
 * 거래처 — 반품 정보의 **공급사 선택칸**이 쓴다. 되돌려 보낼 상대를 사용자가 여기서 고른다.
 *
 * **자동으로 끌어오지 않는다**(계획 결정 11). 입고 전표에 공급사 필드가 없고(실측), 원천
 * 문서를 따라 올라가려면 원천 문서 유형의 값 목록이 있어야 하는데 그것이 없다 —
 * **추론 경로를 만들면 값이 정해질 때 조용히 틀린다.**
 *
 * **미사용 거래처를 함께 받지 않는다.** 앞 다섯 참조와 갈리는 자리다: 그쪽은 과거 전표가
 * 가리키는 번호를 **읽어 이름으로 푸는** 곳이라 미사용 값도 있어야 이름이 보이지만, 여기는
 * **새 전표에 실을 값을 고르는** 곳이다. 미사용 거래처를 고르게 두면 되돌릴 수 없는 전표에
 * 유효하지 않은 도착지가 실린다 — 유효성 판정은 서버가 하며 기본 조회가 유효한 것만 내린다
 * (공유계약 G-8). 그래서 표식이 아니라 **목록에서 빼는 것**이 맞는 처리다.
 *
 * **잘리면 표식을 낸다.** 계약에 **번호로 한 건을 받는 경로가 없어**(실측: `q`·`page`·`size`뿐)
 * 잘린 뒤쪽의 거래처는 이 화면에서 고를 길이 아예 없다 — 감추면 사용자가 「그런 거래처가
 * 없다」로 결론짓는다. 그 한계는 착수 이슈에 질문으로 올린다(계획 §5.4-7).
 *
 * **전표를 고르기 전에는 부르지 않는다**(`enabled`) — 반품 정보 구획 자체가 그때 그려진다.
 */
export const usePartnerOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.partners,
    enabled,
    queryFn: () => runRequest(() => client.GET('/mdm/partners')),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.partnerId),
        /*
         * **「코드 · 이름」으로 낸다.** 거래처 코드는 업무 번호라 사람이 상대를 가르는 데 쓰고,
         * 내부 번호(`partnerId`)는 어느 갈래에도 담기지 않는다(#44). 다른 참조 다섯과 같은
         * 모양이라 사용자가 칸마다 다른 읽기 규칙을 익힐 필요가 없다.
         */
        label: `${item.partnerCode} · ${item.partnerName}`,
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

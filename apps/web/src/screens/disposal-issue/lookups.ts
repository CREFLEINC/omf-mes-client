import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { isDisposalPartnerRolePending, type DisposalPartnerRoleCode } from './code-options';
import type { LookupEntry, LotEntry, PageMeta, WarehouseEntry } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조 **다섯** — 창고·품목·단위·자재 LOT·위치.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고(`code-options.ts`), 이름은 계약이 준다.
 *
 * 기준정보는 `includeInactive=true`로 한 번 받아 둔다. 기본 조회는 사용 중인 것만 내려주므로,
 * 미사용 값을 참조하는 과거 입고가 오면 이름이 비어 보인다. (자재 LOT에는 사용 여부 조건
 * 자체가 없다.)
 *
 * **참조 → 보이는 자리 → 복구 표**. 실패 안내와 「다시 시도」는 그 이름이 실제로 실패로 보이는
 * 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있다.
 *
 * | 참조 | 보이는 자리 | 복구 | 언제 부르나 |
 * | --- | --- | --- | --- |
 * | 창고 | 조건 줄 · 목록 표 · 제목줄 | **목록 구획** | 첫 진입 |
 * | 품목 | 라인 표 | **라인 구획** | **전표를 고른 뒤** |
 * | 단위 | 라인 표의 수량 표기 | **라인 구획** | 같은 위 |
 * | 자재 LOT | 라인 표의 LOT 칸 · **보류 표식** | **라인 구획** | 같은 위. **품목마다 한 번** |
 * | 위치 | 라인 표의 위치 칸 | **라인 구획** | 같은 위(**전표의 창고**로 조회) |
 * | **거래처(선택지)** | **발의 폼의 「폐기 거래처」 칸** | **없음(전표 재선택)** | 전표를 고른 뒤 **AND 역할 코드가 있을 때** |
 * | **거래처(이름 풀이)** | **③ 구획의 도착지 표기** | **없음(전표 재선택)** | 고른 폐기 요청에 **도착지가 있을 때** |
 *
 * **거래처 둘만 복구 칸이 「없음」이다**(변경 통지 #128 · 리뷰 Nit N3). 다른 다섯은 그 이름이
 * 실패로 보이는 자리에 「다시 시도」를 두지만, 거래처가 서는 두 자리에는 두지 않는다 —
 * 선택칸은 실패해도 **자체 폐기로 올릴 수 있고**(#128 §3 ⭐), ③ 구획은 되돌릴 수 없는 조작
 * 버튼 옆이라 부차적인 버튼이 무엇을 누르는 자리인지 흐린다. 그래서 두 훅은 `refetch`를
 * **타입째 내지 않는다**(`PartnerLookupResult`) — 복구는 전표를 다시 고르는 것이다.
 *
 * **창고만 미리 받는 이유**는 그 이름이 나타나는 **시점**이 다르기 때문이다. 조건 줄과 목록
 * 표의 창고 칸은 **목록 응답만으로** 곧바로 그려지지만, 라인 표의 칸은 **상세 응답이 와야**
 * 그려진다 — 상세를 기다리는 동안 나머지 넷이 도착할 여유가 있다.
 *
 * **창고만 유형 코드를 함께 읽는다.** 「불량창고」를 가리는 값 목록이 확정되면 선택지를 그
 * 유형으로 좁히기 위해서다(`code-options.ts`) — 지금은 읽어 두기만 하고 좁히지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

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

/** 창고 참조. **유형 코드를 함께 나른다** — 그것이 다른 참조와 다른 점이다. */
export interface WarehouseReferenceSource extends Omit<ReferenceSource, 'entries'> {
  entries: readonly WarehouseEntry[];
}

export interface WarehouseLookupResult extends WarehouseReferenceSource {
  entries: WarehouseEntry[];
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

/** 자재 LOT 참조. **보류 여부를 함께 나른다** — 그것이 다른 넷과 다른 유일한 점이다. */
export interface LotReferenceSource extends Omit<ReferenceSource, 'entries'> {
  entries: readonly LotEntry[];
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  refetch: () => void;
}

/**
 * 거래처 조회의 결과 — **`refetch`가 없다.**
 *
 * 다른 참조는 실패 안내 옆에 「다시 시도」를 두지만(그 이름이 실제로 실패로 보이는 자리에
 * 복구 경로가 있어야 한다), 거래처가 서는 두 자리에는 그 버튼을 두지 않는다:
 * ① 발의 폼의 선택칸 — 잠긴 칸 아래 안내가 실패를 밝히고, 사용자는 그동안에도 **자체 폐기로
 * 올릴 수 있다** ② ③ 구획 — 되돌릴 수 없는 조작 버튼 옆이라 그 자리에 부차적인 버튼을 더하면
 * 무엇을 누르는 자리인지 흐려진다. 두 자리 모두 **전표를 다시 고르면 조회가 다시 나간다.**
 *
 * 쓰지 않을 `refetch`를 내지 않는 것이 요점이다 — 내면 「이 화면에 복구 경로가 있다」가
 * 타입 수준의 사실이 되고, 죽은 통로가 다음 사본으로 전파된다.
 */
export type PartnerLookupResult = Omit<LookupResult, 'refetch'>;

export interface LotLookupResult extends LotReferenceSource {
  entries: LotEntry[];
  refetch: () => void;
}

/**
 * 참조 값 하나의 표기 상태.
 *
 * **네 갈래를 타입으로 가른다.** 하나로 뭉개면 본 자료가 참조 목록보다 먼저 오는 순간
 * 정상 값이 「알 수 없음」으로 보이고, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 반대로
 * 읽힌다(`omf-mes#47`).
 *
 * **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`). 담을 자리가 없으면 화면으로 샐 경로도 없다.
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
 * **막는 데 쓰지 않는다.** 보류·차단된 자재를 장부에서 덜어 내는 것이 이 화면의 주 용도다.
 */
export const isLotHeld = (source: LotReferenceSource, lotId: number | null): boolean => {
  if (source.isError || source.isLoading || lotId === null) return false;

  return source.entries.find((entry) => entry.value === String(lotId))?.held ?? false;
};

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_WAREHOUSE_ENTRIES: WarehouseEntry[] = [];
const EMPTY_ENTRIES: LookupEntry[] = [];

/**
 * 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다.
 *
 * 잘림 판정이 여러 곳에 각각 있으면 한쪽만 고쳐져 어긋난 화면이 된다 —
 * 「일부만 받았다」는 사실은 하나다.
 */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸·표 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 창고가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
 *
 * **창고 유형 미확정 안내는 여기 넣지 않는다.** 그것은 목록을 받아 온 결과가 아니라 값 목록이
 * 확정되지 않았다는 별개의 사실이고, 자리표시가 채워지는 순간 사라져야 한다 — 화면이 둘을
 * 이어 붙인다(못 불러온 목록에 대고 「좁히지 못했다」를 말하면 사용자가 원인을 잘못 읽는다).
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
 * 그 사실이 `filters.ts`에도 적혀 있다.
 *
 * **이 값에는 계약 근거가 없다.** 생성물이 수치 제약과 쿼리 파라미터 기본값을 싣지 않아
 * `maximum`도 `default`도 나타나지 않는다 — 그러므로 이 숫자는 **화면이 정한 완화값이며
 * 보장이 아니다.** 한 품목의 LOT이 몇 건인지 화면이 알 수 없으므로 어떤 값을 넣어도 잘릴 수
 * 있다. 잘렸다는 사실을 밝히는 것은 `truncated`이고, 이 값은 그 일이 **덜 일어나게** 할 뿐이다.
 * 서버가 상한을 두고 400을 돌려주면 이 값부터 의심한다 — 고칠 자리는 이 상수 하나다.
 */
export const LOT_PAGE_SIZE = 200;

export const lookupKeys = {
  warehouses: ['disposal-issue-lookups', 'warehouses'] as const,
  items: ['disposal-issue-lookups', 'items'] as const,
  uoms: ['disposal-issue-lookups', 'uoms'] as const,
  /** LOT은 **품목마다** 캐시가 갈린다 — 한 요청이 한 품목의 LOT만 담기 때문이다. */
  lots: (itemId: number) => ['disposal-issue-lookups', 'lots', itemId] as const,
  /** 위치는 **창고마다** 갈린다 — 계약이 창고를 필수 조건으로 둔다. */
  locations: (warehouseId: number) => ['disposal-issue-lookups', 'locations', warehouseId] as const,
  /**
   * 폐기 거래처 **선택지**는 좁히는 역할 코드마다 갈린다 — 코드가 캐시 키에 들어가지 않으면
   * 값이 바뀌어도 앞 목록이 그대로 선다.
   *
   * ⚠ **이 축은 지금 감지기로 잴 수 없다 — 등가 뮤턴트다.** 키에서 역할 코드를 빼도 슬라이스
   * 시험과 타입 검사가 전부 통과한다(2026-08-16 재측정 — 역할 코드가 확정된 뒤에도 같다).
   * 코드가 **모듈 상수**라 한 세션 안에서 두 값이 함께 살지 않기 때문이다 — 갈릴 일이 없는 것을
   * 「갈린다」고 잴 수는 없다. **잴 수 없는 것을 재는 척하는 감지기를 심지 않는다.** 역할 코드가
   * 조회·설정으로 **오는 값**이 되면 그때 이 축이 도달 가능해지고 감지기를 둘 자리가 생긴다.
   */
  disposalPartners: (roleTypeCode: DisposalPartnerRoleCode) =>
    ['disposal-issue-lookups', 'disposal-partners', roleTypeCode] as const,
  /**
   * 거래처 **이름 풀이**는 선택지와 **다른 키**를 쓴다. 같은 경로를 부르지만 좁힘이 다르므로,
   * 키를 합치면 좁힌 목록이 이름 풀이 자리에 서서 좁힘 밖 거래처가 「알 수 없음」이 된다
   * (`omf-mes#47`).
   */
  partnerNames: ['disposal-issue-lookups', 'partner-names'] as const,
};

/**
 * 창고 — 조건 줄의 선택지와 목록 표의 창고 칸이 함께 쓴다.
 *
 * **미사용 창고를 빼지 않는다.** 이 칸은 물건을 넣을 자리를 고르는 곳이 아니라 **과거 입고를
 * 찾는 조건**이다 — 지금은 쓰지 않는 창고로 들어온 입고가 실제로 있고, 빼면 그 입고를
 * 조건으로 찾을 방법이 사라진다. 대신 선택지에 표식을 붙인다.
 *
 * **유형으로 좁혀 받지 않는다.** 계약이 `warehouseTypeCode` 조건을 주지만 ① 값 목록이 아직
 * 없어 실을 값이 없고 ② 값이 정해져도 **목록 표의 창고 이름은 조건 밖 창고까지 풀어야 한다**
 * — 창고 조건 없이 조회하면 다른 창고의 입고가 함께 오기 때문이다. 좁히는 자리는 **선택지
 * 하나**이고 그 판정은 `code-options.ts`가 갖는다.
 *
 * **다섯 중 유일하게 고르기 전에도 부른다** — 조건 줄과 목록 표가 첫 화면부터 이 이름을 쓴다.
 */
export const useWarehouseOptions = (): WarehouseLookupResult => {
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
        warehouseTypeCode: item.warehouseTypeCode,
      })) ?? EMPTY_WAREHOUSE_ENTRIES,
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

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_LOT_ENTRIES: LotEntry[] = [];

/**
 * 자재 LOT — 라인 표의 LOT 칸과 **보류 표식**이 쓴다.
 *
 * **번호 여러 개로 한 번에 조회하는 수단이 계약에 없다**(실측: `/trace/lots`의 조건은
 * `itemId`·`plantId`·`statusCode`·`q` 등이고 번호 목록을 받는 조건이 없다). 그래서
 * **고른 전표의 라인이 가리키는 품목마다 한 번씩 받아 번호로 맞춘다**(W-01-07이 세운 형태).
 *
 * 품목으로 좁히지 않고 전체를 받으면 첫 쪽에 없는 LOT이 전부 「목록에 없음」이 되어
 * **정상 값이 잘못된 값으로 보인다**(`omf-mes#47`이 금지한 표기). 좁혀 받으면 그 위험이 작아진다.
 *
 * **그래도 잘릴 수 있다.** 자재 LOT은 다섯 참조 중 유일한 **거래 기록**이라 한 품목의 LOT이
 * 시간이 갈수록 쌓인다. 그래서 두 겹으로 다룬다 — ① 쪽 크기를 명시해 잘림 **빈도를 낮추고**
 * ② 그래도 잘리면 **잘림 표식이 그 사실을 밝힌다**. ①은 완화이고 보장은 ②다.
 *
 * **보류 여부는 이 응답이 함께 준다**(`held`) — 표식을 위해 요청을 더 보내지 않는다.
 */
export const useLotOptions = (itemIds: readonly number[], enabled: boolean): LotLookupResult => {
  const { client } = useApiClient();

  /*
   * **요청 수를 줄이려고 중복을 없애는 것이 아니다.** 캐시 키가 품목마다 하나라 같은 품목의
   * 쿼리는 어차피 한 벌로 합쳐진다 — 없애는 이유는 아래 계산의 분모를 **줄 수가 아니라 품목
   * 수로** 두기 위해서다. 중복을 남기면 같은 응답이 여러 번 들어와 `entries`에 같은 LOT이
   * 겹치고, `isLoading`·`isError`가 줄 수만큼 되풀이된 결과를 보게 된다.
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
 * 폐기 거래처 **선택지** — 발의 폼의 「폐기 거래처」 칸이 쓴다(변경 통지 #128 §3).
 *
 * **역할 코드로 좁혀 받는다.** 그 코드가 아직 확정되지 않아 비어 있는 동안은 **조회를 아예
 * 내보내지 않는다**(`enabled`) — 빈 값으로 부르면 좁히지 않은 거래처 전부가 폐기 거래처
 * 선택지로 서고, 사용자는 폐기와 무관한 상대를 되돌릴 수 없는 전표에 실을 수 있다.
 * 판정은 `code-options.ts`가 갖는다 — 값이 확정될 때 고칠 자리가 한 곳이어야 한다.
 *
 * **미사용 거래처를 함께 받지 않는다.** 앞 다섯 참조와 갈리는 자리다: 그쪽은 과거 전표가
 * 가리키는 번호를 **읽어 이름으로 푸는** 곳이라 미사용 값도 있어야 이름이 보이지만, 여기는
 * **새 전표에 실을 값을 고르는** 곳이다. 유효성 판정은 서버가 하며 기본 조회가 유효한 것만
 * 내린다(공유계약 G-8) — 표식이 아니라 목록에서 빼는 것이 맞는 처리다.
 *
 * **잘리면 표식을 낸다.** 계약에 번호로 한 건을 받는 경로가 없어(실측) 잘린 뒤쪽의 거래처는
 * 이 화면에서 고를 길이 아예 없다 — 감추면 사용자가 「그런 거래처가 없다」로 결론짓는다.
 *
 * **전표를 고르기 전에는 부르지 않는다**(`enabled`) — 폐기 요청 정보 구획 자체가 그때 그려진다.
 */
export const useDisposalPartnerOptions = (
  roleTypeCode: DisposalPartnerRoleCode,
  enabled: boolean,
): PartnerLookupResult => {
  const { client } = useApiClient();

  /* 좁힐 수 없으면 부르지 않는다 — 「좁히지 않은 목록」과 「좁힌 목록」은 다른 자료다. */
  const isNarrowable = !isDisposalPartnerRolePending(roleTypeCode);
  const isFetching = enabled && isNarrowable;

  const query = useQuery({
    queryKey: lookupKeys.disposalPartners(roleTypeCode),
    enabled: isFetching,
    queryFn: () => {
      /*
       * **판정을 여기서 다시 부른다.** 계약이 역할 코드를 다섯으로 좁혀(#173) 질의 조건도
       * 그 유니온만 받는데, 위 `isNarrowable`은 참·거짓일 뿐이라 코드를 좁혀 주지 못한다.
       * 술어를 직접 부르면 되돌아간 뒤의 값이 계약 유니온으로 좁혀져 단언 없이 실린다.
       */
      if (isDisposalPartnerRolePending(roleTypeCode)) {
        throw new Error('폐기처리 역할 코드가 확정되기 전에는 거래처 선택지를 조회하지 않습니다.');
      }

      const query = { roleTypeCode };

      return runRequest(() => client.GET('/mdm/partners', { params: { query } }));
    },
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.partnerId),
        /*
         * **「코드 · 이름」으로 낸다.** 거래처 코드는 업무 번호라 사람이 상대를 가르는 데 쓰고,
         * 내부 번호(`partnerId`)는 어느 갈래에도 담기지 않는다(`omf-mes#44`). 다른 참조와 같은
         * 모양이라 사용자가 칸마다 다른 읽기 규칙을 익힐 필요가 없다.
         */
        label: `${item.partnerCode} · ${item.partnerName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: isFetching && query.isPending,
  };
};

/**
 * 거래처 **이름 풀이** — ③ 기타출고 처리 구획의 도착지 표기가 쓴다(변경 통지 #128).
 *
 * ⛔ **좁히지 않는다.** 선택지와 같은 경로를 부르지만 역할 코드를 싣지 않는다 — 좁힌 조회로
 * 이름을 풀면 좁힘 밖의 정상 거래처가 「알 수 없음」으로 찍히고, 그 문구는 *값이 잘못됐다*는
 * 뜻이라 사용자가 반대로 읽는다(`omf-mes#47`). 이미 저장된 전표는 **지금의 역할 좁힘과 무관한**
 * 거래처를 가리킬 수 있다: 역할은 나중에 회수될 수 있고, 그때 과거 전표의 도착지가 사라져서는
 * 안 된다. 좁히는 자리는 **선택지 하나**다.
 *
 * **미사용 거래처까지 받는다**(`includeInactive`) — 다른 네 참조와 같은 이유다. 여기서 거래처는
 * 고르는 값이 아니라 **읽는 값**이라, 빼면 그 전표의 도착지 이름이 비어 보인다.
 *
 * **가리키는 도착지가 없으면 부르지 않는다**(`enabled`) — 자체 폐기 전표는 풀 이름이 없다.
 */
export const usePartnerNames = (enabled: boolean): PartnerLookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.partnerNames,
    enabled,
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
    isLoading: enabled && query.isPending,
  };
};

/**
 * 적치 위치 — 라인 표의 위치 칸이 쓴다. **그 라인이 놓인 자리이자 폐기 출고의 출발 위치**다.
 *
 * **고른 전표의 창고로 조회한다.** 계약이 `warehouseId`를 **필수 쿼리**로 두어(실측) 없이
 * 부르면 실패한다 — 화면이 스스로 만든 실패를 사용자에게 보이게 된다. 캐시 키가 창고 번호를
 * 담으므로 전표를 되돌려도 요청이 한 번을 넘지 않는다.
 *
 * **조건 줄의 창고가 아니라 상세 응답의 창고다.** 조건 줄은 비어 있을 수 있고, 값 목록이
 * 확정되면 그 선택지가 폐기 대상 유형으로 **좁혀진다**(PR ①의 좁힘) — 좁힌 조건을 축으로 쓰면
 * 좁힘 밖 창고의 전표를 골랐을 때 남의 창고 위치 이름이 붙는다.
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

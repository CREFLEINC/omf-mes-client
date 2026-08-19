import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta, SelectOption } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조 넷.
 *
 * **적치 규칙은 이름 필드를 하나도 갖지 않는다**(계약 실측 — 식별자만 온다). 그래서 목록의
 * 품목·위치·단위 이름은 전부 화면이 참조 조회로 푼다.
 *
 * | 참조 | 경로 | 보이는 자리 | 언제 부르나 |
 * | --- | --- | --- | --- |
 * | 창고 | `/mdm/warehouses` | 조건 줄의 선택칸·조건 칩 | **첫 진입** |
 * | 위치 | `/mdm/locations?warehouseId=` | 목록 표의 위치 칸 | **창고를 고른 뒤** |
 * | 품목 | `/mdm/items` | 조건 줄의 선택칸 · 목록 표의 품목 칸 | 창고를 고른 뒤 |
 * | 단위 | `/mdm/uoms` | 목록 표의 용량 칸 | 창고를 고른 뒤 |
 *
 * 창고만 첫 진입에 부른다 — 이 화면은 창고를 고르는 것으로 시작한다. 나머지 셋은 창고가
 * 정해져야 부를 수 있거나(위치 — 계약이 `warehouseId`를 필수로 요구한다) 행이 서야 쓰인다.
 *
 * **참조 조회를 좁히지 않는다**(사본 체크리스트 10번). 화면의 조건(품목·사용 중만)을 이름 풀이
 * 조회에도 걸면 좁힘 밖의 정상 자료가 「알 수 없음」으로 보인다. 위치만 창고로 갈라 받는데
 * 그것은 좁힘이 아니라 **계약이 창고를 필수로 요구해서**이며, 목록도 같은 창고로 서므로
 * 이름 풀이 대상이 잘리지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.putawayRule;

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

/**
 * 창고 하나의 관리수준 코드. **창고 조회에만 있는 사실이다.**
 *
 * 이름 풀이용 `LookupEntry`에 얹지 않는다 — 넷 중 하나만 갖는 값을 공통 항목에 두면
 * 나머지 셋에 쓰이지 않는 통로가 생기고, 죽은 통로는 다음 사본으로 전파된다
 * (사본 체크리스트 7번).
 */
export interface WarehouseLevel {
  warehouseId: number;
  managementLevelCode: string;
}

/**
 * 위치 하나가 스스로 가진 용량.
 *
 * **수량과 단위를 함께 들고 있을 때만 만든다.** 계약이 둘을 「함께 있거나 함께 비어야
 * 한다」로 못 박았고(`ck_location_capacity`), 한쪽만 있는 값으로는 무엇과도 견줄 수 없다 —
 * 수량만 들고 오면 규칙 용량과 단위를 확인하지 않은 채 크고 작음을 말하게 된다.
 */
export interface LocationCapacity {
  locationId: number;
  capacityQty: number;
  capacityUomId: number;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /**
   * **조회가 실제로 성공해 목록을 받았으면 참.**
   *
   * `entries.length === 0` 하나만으로는 **「없다」와 「아직 모른다」가 갈리지 않는다** — 미도착·
   * 실패·조회가 열리지도 않은 상태가 전부 빈 배열이다. 그 셋을 「없다」로 단정하면 화면이
   * 확인하지 못한 것을 사실로 말하게 된다(`toReference`가 네 갈래를 가르는 것과 같은 이유).
   *
   * **조회가 잠긴 동안에도 거짓이다** — 열리지 않은 조회는 0건을 확인한 적이 없다.
   */
  hasLoaded: boolean;
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

/** 창고 조회만이 갖는 것. 나머지 셋에는 관리수준이라는 사실 자체가 없다. */
export interface WarehouseLookupResult extends LookupResult {
  levels: readonly WarehouseLevel[];
}

/** 위치 조회만이 갖는 것. 위치 자체 용량은 다른 세 참조에 없는 사실이다. */
export interface LocationLookupResult extends LookupResult {
  capacities: readonly LocationCapacity[];
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
 * 규칙의 위치 칸은 **다섯째 갈래**를 갖는다.
 *
 * 위치를 비운 규칙은 「창고 전체」이며 그것은 **확정된 뜻이지 빈 값이 아니다**
 * (그 창고 안 어디에 두어도 되고 세부 위치는 창고 안 정책이 정한다).
 * 「알 수 없음」이나 대시로 두면 자료가 빠진 것으로 읽혀 정반대가 된다.
 */
export type LocationState = ReferenceState | { kind: 'warehouseWide' };

/**
 * **「창고 전체」가 네 갈래보다 앞선다.** 그 뜻은 이름 목록을 필요로 하지 않으므로,
 * 참조 조회가 실패했거나 아직 오지 않았어도 흔들리지 않는다 — 뒤에 두면 조회가 실패한 동안
 * 창고 전체 규칙이 「이름을 불러오지 못했습니다」로 보인다.
 */
export const toLocation = (source: ReferenceSource, locationId: number | null): LocationState =>
  locationId === null ? { kind: 'warehouseWide' } : toReference(source, locationId);

export const describeLocation = (state: LocationState): string =>
  state.kind === 'warehouseWide' ? t.values.warehouseWide : describeReference(state);

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다** — 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 규칙의 이름을 풀기 위해서인데, 빼면 그 값을 조건으로 고를 수도 없다.
 * 지금은 쓰지 않는 위치에 남은 규칙을 정리하는 것이 이 화면의 정상 업무다.
 */
export const toSelectOptions = (source: ReferenceSource): SelectOption[] =>
  source.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * 선택칸 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
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
 * 표 아래에 붙일 안내 — **표가 이름을 푸는 축의 잘림을 읽는 자리다.**
 *
 * ⚠ 폼이 선 뒤로 위치·단위에도 선택칸이 생겼다. 그래도 이 자리는 남는다 — **선택칸이 읽는
 * 조회와 표가 읽는 조회가 같지 않기 때문이다.**
 *
 * - **위치**: 표는 조건 줄의 창고로 연 조회(`locations`)로 풀고, 폼 선택칸은 **폼이 고른 창고**로
 *   연 조회로 좁힌다 — 다른 조회이므로 잘림이 한쪽에만 있을 수 있다.
 * - **단위**: 같은 조회를 둘이 읽지만 **폼이 닫혀 있으면 선택칸이 아예 없다.** 목록만 보는
 *   사용자에게는 여기가 유일한 자리다.
 *
 * 이 자리가 없으면 `truncated`를 계산만 하고 아무도 보지 않게 되고, **잘린 목록으로 이름을 푼
 * 정상 규칙이 「알 수 없음」으로 보이는데 화면 어디에도 그 사실이 없다.** 「알 수 없음」은
 * *값이 잘못됐다*는 뜻이라 사용자가 정확히 반대로 읽는다.
 *
 * 실패는 여기서 말하지 않는다 — 실패한 축은 그 칸이 이미 「이름을 불러오지 못했습니다」로
 * 스스로 말하고 있어, 표 아래에서 한 번 더 말하면 같은 사실이 두 자리에 선다.
 */
export const nameLookupTruncatedNote = (
  ...sources: readonly ReferenceSource[]
): string | undefined =>
  sources.some((source) => source.truncated) ? t.notes.nameLookupTruncated : undefined;

/**
 * 선택칸 트리거에 설 자리표시.
 *
 * ⛔ **「고를 것이 없습니다」는 조회가 실제로 0건을 돌려줬을 때에만 말한다.**
 * `entries.length === 0`만 보면 **미도착·실패·조회가 열리지도 않은 상태**가 전부 그 문장을
 * 받는다 — 화면이 확인하지 못한 것을 사실로 말하게 되고, 실패 갈래에서는 바로 아래 안내
 * (「선택지를 불러오지 못했습니다」)와 **한 칸 안에서 정면으로 어긋난다.**
 *
 * **확정하지 못한 상태에서는 아무 말도 하지 않는다**(`undefined`). 이 슬라이스가 이미 두 자리에서
 * 쓰는 규율이다 — `toReference`는 실패·미도착을 「목록에 없음」보다 앞에 두고,
 * `UncoveredItemsPane`은 실패·미도착에 **건수를 아예 내지 않는다**(0을 내면 좋은 소식으로
 * 읽히는데 실제로는 확인하지 못한 것이다). 지어낸 문장 대신 침묵이 정확하다.
 *
 * 목록이 있을 때도 자리표시를 두지 않는다 — 그때는 빈 값 선택지(「전체」)가 서므로
 * 트리거가 언제나 고른 값을 그린다. 뜰 수 없는 문자열을 넘기면 「이 자리에서 자리표시가
 * 쓰인다」는 잘못된 인상만 남는다.
 */
export const optionsPlaceholder = (lookup: LookupResult, emptyText: string): string | undefined =>
  lookup.hasLoaded && lookup.entries.length === 0 ? emptyText : undefined;

/**
 * 고른 창고의 관리수준 코드. 목록에 없거나 아직 오지 않았으면 `null`이다.
 *
 * **없는 것을 값으로 지어내지 않는다** — 개폐를 판정하는 자리(`management-level.ts`)가
 * 「모르는 상태」를 그대로 받아 스스로 판정해야 한다.
 */
export const findWarehouseLevel = (
  levels: readonly WarehouseLevel[],
  warehouseId: number | null,
): string | null =>
  warehouseId === null
    ? null
    : (levels.find((level) => level.warehouseId === warehouseId)?.managementLevelCode ?? null);

/**
 * 그 위치가 스스로 가진 용량. 용량이 없거나 위치를 고르지 않았으면 `null`이다.
 *
 * `null`이 「용량이 0이다」가 아니라 **「견줄 값이 없다」**임에 주의한다 —
 * 읽는 자리가 두 사실을 가르지 못하면 용량 없는 위치에 초과 경고가 선다.
 */
export const findLocationCapacity = (
  capacities: readonly LocationCapacity[],
  locationId: number | null,
): LocationCapacity | null =>
  locationId === null
    ? null
    : (capacities.find((capacity) => capacity.locationId === locationId) ?? null);

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];
const EMPTY_LEVELS: WarehouseLevel[] = [];
const EMPTY_CAPACITIES: LocationCapacity[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 위치 조회의 쪽 크기.
 *
 * **넷 중 여기에만 쪽 크기를 싣는다.** 창고·품목·단위는 전사 기준정보라 서버 기본값으로
 * 충분하지만, **Location은 한 창고 안에서 가장 커지기 쉬운 축**이다(선반·구역이 쌓인다).
 *
 * **이 값에는 계약 근거가 없다** — `size`에 `maximum`이 적혀 있지 않아 화면이 정한 완화값이며
 * 보장이 아니다. 그래서 완화만으로 끝내지 않는다: 그래도 잘리면 `truncated`가 그 사실을
 * 밝히고 표 아래 안내가 그것을 읽는다(전례 `stock-adjust`의 `LOT_PAGE_SIZE`와 같은 형태).
 *
 * 잘린 목록으로 이름을 풀면 **뒤쪽 위치를 가리키는 정상 규칙이 「알 수 없음」으로 찍히는데,
 * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.**
 */
export const LOCATION_PAGE_SIZE = 200;

/**
 * 품목 찾기의 쪽 크기.
 *
 * 검색 결과는 **고를 수 있을 만큼만** 받는다 — 창 안 표가 다 담지 못할 만큼 받으면 사용자가
 * 훑는 대신 조건을 좁혀야 한다. 그래도 잘리면 `truncated`가 그 사실을 밝히고, 밝히지 않으면
 * 사용자는 「그런 품목이 없다」로 읽고 검색을 그만둔다.
 */
export const ITEM_SEARCH_SIZE = 50;

/** 창 안 표가 그리는 품목 한 줄. 내부 번호는 **고를 때만** 쓰고 화면 글자로 내지 않는다. */
export interface ItemSearchRow {
  itemId: number;
  itemCode: string;
  itemName: string;
}

export interface ItemSearchResult {
  rows: readonly ItemSearchRow[];
  isLoading: boolean;
  isError: boolean;
  truncated: boolean;
}

export const lookupKeys = {
  warehouses: ['putaway-rule-lookups', 'warehouses'] as const,
  /** 품목 찾기는 **검색어마다** 캐시가 갈린다 — 같은 말을 다시 찾으면 다시 부르지 않는다. */
  itemSearch: (keyword: string) => ['putaway-rule-lookups', 'item-search', keyword] as const,
  /** 위치는 **창고마다** 캐시가 갈린다 — 계약이 창고를 필수 조건으로 요구한다. */
  locations: (warehouseId: number) => ['putaway-rule-lookups', 'locations', warehouseId] as const,
  items: ['putaway-rule-lookups', 'items'] as const,
  uoms: ['putaway-rule-lookups', 'uoms'] as const,
};

/**
 * 창고 — 조건 줄의 선택칸과 조건 칩이 같은 목록을 쓴다.
 *
 * **`includeInactive=true`로 한 번 받아 둔다.** 기본 조회는 사용 중인 것만 내려주므로,
 * 지금은 쓰지 않는 창고에 남은 규칙을 찾을 길이 사라진다.
 *
 * **관리수준 코드를 함께 낸다**(`levels`). 그 값이 위치 입력의 개폐를 가르는데
 * (`management-level.ts` · `omf-mes#64`), 이름 풀이 항목에는 담을 자리가 없다.
 */
export const useWarehouseLookup = (): WarehouseLookupResult => {
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
    levels:
      data?.items.map((item) => ({
        warehouseId: item.warehouseId,
        managementLevelCode: item.managementLevelCode,
      })) ?? EMPTY_LEVELS,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    hasLoaded: query.isSuccess,
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 위치 — **고른 창고를 안 뒤에만 부를 수 있다.**
 *
 * 계약이 `warehouseId`를 **필수 쿼리**로 요구한다 — 창고를 모르면 요청 자체가 성립하지
 * 않으므로 부르지 않는다. 「조회가 성립하지 않는데 하위 요청만 나가 스켈레톤에 갇힌다」를
 * 구조로 막는 자리다.
 *
 * **이 좁힘은 사본 체크리스트 10번의 좁힘이 아니다.** 목록도 같은 창고로 서므로 보이는 모든
 * 행의 위치가 이 목록 안에 있다. 목록의 품목 조건은 여기 싣지 않는다.
 *
 * **위치 자체 용량을 함께 낸다**(`capacities`). 규칙 용량 옆에 그 값을 나란히 보이고 초과를
 * 경고하는 자리가 이 응답 말고는 근거를 얻을 데가 없다(`capacity-note.ts` · `omf-mes#84`).
 *
 * ⭐ **폼이 고른 창고로도 이 훅을 부른다.** 캐시 열쇠가 창고 번호라 조건 줄과 폼이 같은 창고를
 * 보는 동안에는 요청이 **한 번**만 나가고, 폼이 다른 창고를 고르면 그 창고의 위치가 따로 선다.
 */
export const useLocationLookup = (warehouseId: number | null): LocationLookupResult => {
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
          params: { query: { warehouseId, includeInactive: true, size: LOCATION_PAGE_SIZE } },
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
    /*
     * **둘 다 있는 위치만 담는다.** 계약이 수량과 단위를 함께 두게 했지만, 한쪽만 온 자료를
     * 그대로 받으면 단위를 모르는 수량으로 견주게 된다 — 그 자리는 담지 않는 것이 정확하다.
     */
    capacities:
      data?.items.flatMap((item) =>
        item.capacityQty === undefined ||
        item.capacityQty === null ||
        item.capacityUomId === undefined ||
        item.capacityUomId === null
          ? []
          : [
              {
                locationId: item.locationId,
                capacityQty: item.capacityQty,
                capacityUomId: item.capacityUomId,
              },
            ],
      ) ?? EMPTY_CAPACITIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    hasLoaded: query.isSuccess,
    isError: query.isError,
    isLoading: warehouseId !== null && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 품목 — 조건 줄의 선택칸과 목록 표의 품목 칸이 함께 쓴다.
 *
 * **창고를 고른 뒤 부른다.** 그전에는 세울 행도, 좁힐 대상도 없다.
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
    hasLoaded: query.isSuccess,
    isError: query.isError,
    isLoading: enabled && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

const EMPTY_SEARCH_ROWS: ItemSearchRow[] = [];

/**
 * 품목 **찾기** — 이름 풀이가 아니라 **고를 대상을 좁히는** 조회다.
 *
 * ⚠ **사본 체크리스트 10번과 갈리는 자리다.** 그 항목이 막는 것은 *좁힌 조회로 이름을 푸는
 * 것*이고, 여기서 좁히는 것은 *고를 선택지*다 — 이름 풀이는 좁히지 않은 `useItemLookup`이
 * 그대로 맡는다. 두 조회가 따로 있는 이유가 그것이다.
 *
 * **검색어가 비면 조회하지 않는다.** 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니고,
 * 전 품목을 받는 것은 화면에도 서버에도 뜻이 없다.
 *
 * **`includeInactive`를 싣지 않는다** — 새로 만드는 규칙이 미사용 품목을 가리킬 이유가 없다.
 * 선택 목록의 유효성은 서버가 판정한다(공유계약 G-8).
 */
export const useItemSearch = (keyword: string): ItemSearchResult => {
  const { client } = useApiClient();
  const isSearching = keyword !== '';

  const query = useQuery({
    queryKey: lookupKeys.itemSearch(keyword),
    enabled: isSearching,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items', { params: { query: { q: keyword, size: ITEM_SEARCH_SIZE } } }),
      ),
  });

  const data = query.data;

  return {
    rows:
      data?.items.map((item) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
      })) ?? EMPTY_SEARCH_ROWS,
    /* 조회가 열리지도 않은 상태를 「불러오는 중」으로 말하지 않는다 — 아직 찾지 않은 것이다. */
    isLoading: isSearching && query.isPending,
    isError: query.isError,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
  };
};

/** 단위 — 목록 표의 용량 칸이 쓴다. 수량만 보이면 크고 작음을 판단할 수 없다. */
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
    hasLoaded: query.isSuccess,
    isError: query.isError,
    isLoading: enabled && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

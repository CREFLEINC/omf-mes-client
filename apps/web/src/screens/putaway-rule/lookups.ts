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

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
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
 * 표 아래에 붙일 안내 — **선택칸이 없는 참조의 잘림을 읽는 자리다.**
 *
 * 위치·단위는 이 회차에 선택칸이 없고 **표 칸에만** 쓰인다. `lookupNote`는 선택칸에 붙는
 * 안내라 이 둘에는 닿을 자리가 없다 — 그러면 `truncated`를 계산만 하고 아무도 보지 않게 되고,
 * **잘린 목록으로 이름을 푼 정상 규칙이 「알 수 없음」으로 보이는데 화면 어디에도 그 사실이
 * 없다.** 「알 수 없음」은 *값이 잘못됐다*는 뜻이라 사용자가 정확히 반대로 읽는다.
 *
 * 실패는 여기서 말하지 않는다 — 실패한 축은 그 칸이 이미 「이름을 불러오지 못했습니다」로
 * 스스로 말하고 있어, 표 아래에서 한 번 더 말하면 같은 사실이 두 자리에 선다.
 */
export const nameLookupTruncatedNote = (
  ...sources: readonly ReferenceSource[]
): string | undefined =>
  sources.some((source) => source.truncated) ? t.notes.nameLookupTruncated : undefined;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];

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

export const lookupKeys = {
  warehouses: ['putaway-rule-lookups', 'warehouses'] as const,
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
 * 위치 — **고른 창고를 안 뒤에만 부를 수 있다.**
 *
 * 계약이 `warehouseId`를 **필수 쿼리**로 요구한다 — 창고를 모르면 요청 자체가 성립하지
 * 않으므로 부르지 않는다. 「조회가 성립하지 않는데 하위 요청만 나가 스켈레톤에 갇힌다」를
 * 구조로 막는 자리다.
 *
 * **이 좁힘은 사본 체크리스트 10번의 좁힘이 아니다.** 목록도 같은 창고로 서므로 보이는 모든
 * 행의 위치가 이 목록 안에 있다. 목록의 품목 조건은 여기 싣지 않는다.
 */
export const useLocationLookup = (warehouseId: number | null): LookupResult => {
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
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
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
    isError: query.isError,
    isLoading: enabled && query.isPending,
    refetch: () => {
      void query.refetch();
    },
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
    isError: query.isError,
    isLoading: enabled && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

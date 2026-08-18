import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  ITEM_SEARCH_SIZE,
  LOCATION_PAGE_SIZE,
  describeLocation,
  describeReference,
  findLocationCapacity,
  findWarehouseLevel,
  lookupNote,
  nameLookupTruncatedNote,
  optionsPlaceholder,
  toLocation,
  toReference,
  toSelectOptions,
  useItemLookup,
  useItemSearch,
  useLocationLookup,
  useUomLookup,
  useWarehouseLookup,
  type LookupResult,
  type ReferenceSource,
} from './lookups';
import { itemFixtures, locationFixtures, uomFixtures, warehouseFixtures } from './fixtures';
import type { LookupEntry } from './types';

const t = messages.putawayRule;

const entries: LookupEntry[] = [
  { value: '9101', label: 'SYN-ITEM-01 · 합성품목 가', isActive: true },
  { value: '9102', label: 'SYN-ITEM-02 · 합성품목 나', isActive: false },
];

const sourceOf = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름을 낸다', () => {
    expect(toReference(sourceOf(), 9101)).toEqual({
      kind: 'named',
      label: 'SYN-ITEM-01 · 합성품목 가',
    });
  });

  /**
   * 순서가 뜻을 정한다 — **실패 · 미도착이 「목록에 없음」보다 앞선다.** 목록이 없거나 못 받은
   * 것을 「그 값이 목록에 없다」로 판정하면 정상 값에 잘못된 값이라는 표를 붙이는 셈이다.
   */
  it('실패가 미도착·목록에 없음보다 앞선다', () => {
    expect(toReference(sourceOf({ isError: true, isLoading: true, entries: [] }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('미도착이 목록에 없음보다 앞선다', () => {
    expect(toReference(sourceOf({ isLoading: true, entries: [] }), 9101)).toEqual({
      kind: 'loading',
    });
  });

  it('목록은 왔는데 그 값이 없으면 알 수 없음이다', () => {
    expect(toReference(sourceOf(), 9999)).toEqual({ kind: 'unknown' });
  });

  it.each([null, undefined])('가리키는 값이 없으면(%s) 알 수 없음이다', (id) => {
    expect(toReference(sourceOf(), id)).toEqual({ kind: 'unknown' });
  });

  /**
   * **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`). 담을 자리가 없으면 화면으로 샐 경로도
   * 없다 — 내부 번호가 화면에 서면 그것이 식별자로 읽힌다.
   */
  it('어느 갈래의 결과에도 번호가 담기지 않는다', () => {
    const states = [
      toReference(sourceOf(), 9101),
      toReference(sourceOf(), 9999),
      toReference(sourceOf({ isLoading: true }), 9101),
      toReference(sourceOf({ isError: true }), 9101),
    ];

    for (const state of states) {
      expect(JSON.stringify(state)).not.toContain('9101');
      expect(JSON.stringify(state)).not.toContain('9999');
    }
  });
});

describe('describeReference', () => {
  /** 네 갈래의 문구가 서로 달라야 뜻이 구분된다. */
  it('네 갈래의 문구가 서로 다르다', () => {
    const texts = [
      describeReference({ kind: 'named', label: '가' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(new Set(texts).size).toBe(4);
  });

  it('실패 문구가 「알 수 없음」과 다르다 — 조회 실패를 정상값으로 뭉개지 않는다', () => {
    expect(describeReference({ kind: 'failed' })).toBe(t.values.referenceFailed);
    expect(describeReference({ kind: 'failed' })).not.toBe(t.values.unknown);
  });
});

describe('toLocation', () => {
  /**
   * 위치를 비운 규칙은 「창고 전체」이며 그것은 **확정된 뜻이지 빈 값이 아니다.**
   * 네 갈래보다 앞서야 참조 조회가 실패한 동안에도 흔들리지 않는다.
   */
  it('위치가 없으면 창고 전체다', () => {
    expect(toLocation(sourceOf(), null)).toEqual({ kind: 'warehouseWide' });
  });

  it('참조 조회가 실패해도 창고 전체는 흔들리지 않는다', () => {
    expect(toLocation(sourceOf({ isError: true }), null)).toEqual({ kind: 'warehouseWide' });
  });

  it('위치가 있으면 네 갈래로 판정한다', () => {
    expect(toLocation(sourceOf(), 9101)).toEqual({
      kind: 'named',
      label: 'SYN-ITEM-01 · 합성품목 가',
    });
  });

  it('창고 전체 문구가 「알 수 없음」과 다르다', () => {
    expect(describeLocation({ kind: 'warehouseWide' })).toBe(t.values.warehouseWide);
    expect(describeLocation({ kind: 'warehouseWide' })).not.toBe(t.values.unknown);
  });
});

describe('toSelectOptions', () => {
  /**
   * **미사용 값을 빼지 않고 표식만 붙인다** — 빼면 그 값을 가리키는 과거 규칙을 조건으로
   * 찾을 방법이 사라진다. 규칙은 위치·품목보다 오래 산다.
   */
  it('미사용 값에 표식을 붙이되 빼지 않는다', () => {
    const options = toSelectOptions(sourceOf());

    expect(options).toHaveLength(2);
    expect(options[1]?.label).toBe(`SYN-ITEM-02 · 합성품목 나${t.values.inactiveSuffix}`);
  });
});

/** 조회 하나의 상태 전부. 기본은 **성공해서 목록을 받은** 상태다. */
const resultOf = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  entries,
  hasLoaded: true,
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: () => undefined,
  ...overrides,
});

describe('lookupNote', () => {
  it('정상이면 안내가 없다', () => {
    expect(lookupNote(resultOf())).toBeUndefined();
  });

  /**
   * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
   * 다시 부르기가 실패하면 낡은 자료와 실패가 함께 참이 된다.
   */
  it('실패가 잘림보다 앞선다', () => {
    expect(lookupNote(resultOf({ isError: true, truncated: true }))).toBe(t.filters.lookupFailed);
  });

  it('잘렸으면 그 사실을 밝힌다', () => {
    expect(lookupNote(resultOf({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });
});

/**
 * **선택칸이 없는 참조의 잘림을 읽는 자리.** 위치·단위는 표 칸에만 쓰여 `lookupNote`가 닿지
 * 않는다 — 이 함수가 없으면 `truncated`를 계산만 하고 아무도 보지 않게 된다.
 */
describe('nameLookupTruncatedNote', () => {
  it('아무것도 잘리지 않았으면 안내가 없다', () => {
    expect(nameLookupTruncatedNote(sourceOf(), sourceOf())).toBeUndefined();
  });

  /** 축마다 따로 잰다 — 한 축만 잘려도 그 사실이 화면에 서야 한다. */
  it('첫째 축이 잘리면 안내를 낸다', () => {
    expect(nameLookupTruncatedNote(sourceOf({ truncated: true }), sourceOf())).toBe(
      t.notes.nameLookupTruncated,
    );
  });

  it('둘째 축이 잘리면 안내를 낸다', () => {
    expect(nameLookupTruncatedNote(sourceOf(), sourceOf({ truncated: true }))).toBe(
      t.notes.nameLookupTruncated,
    );
  });

  /**
   * 실패는 여기서 말하지 않는다 — 실패한 축은 그 칸이 이미 「이름을 불러오지 못했습니다」로
   * 스스로 말한다. 표 아래에서 한 번 더 말하면 같은 사실이 두 자리에 선다.
   */
  it('실패만으로는 잘림 안내를 내지 않는다', () => {
    expect(nameLookupTruncatedNote(sourceOf({ isError: true }), sourceOf())).toBeUndefined();
  });

  /** 안내 문면이 선택칸 쪽 문면과 달라야 한다 — 고를 칸이 없는데 「선택지」라 말하면 어긋난다. */
  it('선택칸 안내와 다른 문면이다', () => {
    expect(t.notes.nameLookupTruncated).not.toBe(t.filters.lookupTruncated);
  });
});

/**
 * ⛔ **「고를 것이 없습니다」는 조회가 실제로 0건을 돌려줬을 때에만 참이다.**
 * 빈 배열 하나로는 **없다 · 아직 안 왔다 · 못 받았다 · 아예 묻지 않았다** 넷이 갈리지 않는다.
 */
describe('optionsPlaceholder', () => {
  const EMPTY_TEXT = t.filters.noWarehouseOptions;

  it('조회가 성공하고 목록이 0건이면 「없습니다」를 말한다', () => {
    expect(optionsPlaceholder(resultOf({ entries: [] }), EMPTY_TEXT)).toBe(EMPTY_TEXT);
  });

  /** 화면의 첫 그림마다 지나는 자리다 — 응답 전에 「없다」고 하면 그 순간이 곧 거짓이다. */
  it('아직 오지 않았으면 아무 말도 하지 않는다', () => {
    expect(
      optionsPlaceholder(resultOf({ entries: [], hasLoaded: false, isLoading: true }), EMPTY_TEXT),
    ).toBeUndefined();
  });

  /**
   * 실패에서 「없다」고 말하면 바로 아래 안내(「선택지를 불러오지 못했습니다」)와
   * **한 칸 안에서 정면으로 어긋난다.**
   */
  it('조회가 실패했으면 아무 말도 하지 않는다', () => {
    expect(
      optionsPlaceholder(resultOf({ entries: [], hasLoaded: false, isError: true }), EMPTY_TEXT),
    ).toBeUndefined();
  });

  /** 열리지 않은 조회는 0건을 확인한 적이 없다 — 품목 칸이 창고 전에 놓이는 상태다. */
  it('조회가 열리지도 않았으면 아무 말도 하지 않는다', () => {
    expect(optionsPlaceholder(resultOf({ entries: [], hasLoaded: false }), EMPTY_TEXT)).toBe(
      undefined,
    );
  });

  /**
   * 목록이 있으면 빈 값 선택지(「전체」)가 서서 트리거가 언제나 고른 값을 그린다 —
   * 뜰 수 없는 문자열을 넘기면 「이 자리에서 자리표시가 쓰인다」는 잘못된 인상만 남는다.
   */
  it('목록이 있으면 자리표시를 두지 않는다', () => {
    expect(optionsPlaceholder(resultOf(), EMPTY_TEXT)).toBeUndefined();
  });
});

/* ── 조회 훅 ─────────────────────────────────────────────────────────── */

const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

const listBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 20, total },
});

const route = (pathname: string, items: unknown[], total?: number): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(listBody(items, total)),
});

/** 나간 요청의 주소를 기록한다. 「좁히지 않았다」는 실려 나간 질의값으로만 증명된다. */
const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
  };
};

describe('useWarehouseLookup', () => {
  it('미사용 창고까지 받아 둔다 — 과거 규칙의 이름이 비어 보이지 않게 한다', async () => {
    const { fetch, urls } = recordingFetch([route(WAREHOUSES_PATH, warehouseFixtures)]);
    const { result } = renderHookWithProviders(() => useWarehouseLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(warehouseFixtures.length);
    });
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
  });

  it('서버가 잘라 보내면 잘림을 밝힌다', async () => {
    const { fetch } = recordingFetch([route(WAREHOUSES_PATH, warehouseFixtures, 99)]);
    const { result } = renderHookWithProviders(() => useWarehouseLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });
});

describe('useLocationLookup', () => {
  /**
   * 계약이 `warehouseId`를 **필수 쿼리**로 요구한다 — 창고를 모르면 요청 자체가 성립하지
   * 않으므로 부르지 않는다.
   */
  it('창고를 모르면 부르지 않는다', () => {
    const { fetch, urls } = recordingFetch([route(LOCATIONS_PATH, locationFixtures)]);

    renderHookWithProviders(() => useLocationLookup(null), { fetch });

    expect(urls).toHaveLength(0);
  });

  /**
   * **좁힘은 창고 한 축뿐이다**(사본 체크리스트 10번). 창고는 계약이 요구하는 축이고
   * 목록도 같은 창고로 서므로 이름 풀이 대상이 잘리지 않는다. 목록의 품목 조건은 싣지 않는다.
   */
  it('창고로만 좁히고 목록 조건을 싣지 않는다', async () => {
    const { fetch, urls } = recordingFetch([route(LOCATIONS_PATH, locationFixtures)]);
    const { result } = renderHookWithProviders(() => useLocationLookup(9201), { fetch });

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0);
    });

    const query = urls[0]?.searchParams;

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.get('includeInactive')).toBe('true');
    expect(query?.has('itemId')).toBe(false);
    expect(query?.has('q')).toBe(false);
  });

  /**
   * **넷 중 여기에만 쪽 크기를 싣는다.** Location은 한 창고 안에서 가장 커지기 쉬운 축이라
   * 서버 기본 쪽 크기로는 잘릴 수 있고, 잘린 목록으로 이름을 풀면 정상 규칙이 「알 수 없음」이 된다.
   */
  it('쪽 크기를 명시해 잘림을 완화한다', async () => {
    const { fetch, urls } = recordingFetch([route(LOCATIONS_PATH, locationFixtures)]);
    const { result } = renderHookWithProviders(() => useLocationLookup(9201), { fetch });

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0);
    });

    expect(urls[0]?.searchParams.get('size')).toBe(String(LOCATION_PAGE_SIZE));
  });

  /** 완화는 보장이 아니다 — 그래도 잘리면 `truncated`가 그 사실을 밝힌다. */
  it('완화해도 잘리면 잘림을 밝힌다', async () => {
    const { fetch } = recordingFetch([route(LOCATIONS_PATH, locationFixtures, 9999)]);
    const { result } = renderHookWithProviders(() => useLocationLookup(9201), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });
});

describe('useItemLookup', () => {
  it('열리기 전에는 부르지 않는다', () => {
    const { fetch, urls } = recordingFetch([route(ITEMS_PATH, itemFixtures)]);

    renderHookWithProviders(() => useItemLookup(false), { fetch });

    expect(urls).toHaveLength(0);
  });

  /** 목록 조건을 이름 풀이 조회에 싣지 않는다 — 좁힘 밖의 정상 자료가 「알 수 없음」이 된다. */
  it('열리면 좁히지 않은 조회를 한 번 부른다', async () => {
    const { fetch, urls } = recordingFetch([route(ITEMS_PATH, itemFixtures)]);
    const { result } = renderHookWithProviders(() => useItemLookup(true), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(itemFixtures.length);
    });

    const query = urls[0]?.searchParams;

    expect(query?.get('includeInactive')).toBe('true');
    expect(query?.has('q')).toBe(false);
    expect(query?.has('itemTypeCode')).toBe(false);
  });
});

describe('useUomLookup', () => {
  it('열리기 전에는 부르지 않는다', () => {
    const { fetch, urls } = recordingFetch([route(UOMS_PATH, uomFixtures)]);

    renderHookWithProviders(() => useUomLookup(false), { fetch });

    expect(urls).toHaveLength(0);
  });

  it('열리면 좁히지 않은 조회를 부른다', async () => {
    const { fetch, urls } = recordingFetch([route(UOMS_PATH, uomFixtures)]);
    const { result } = renderHookWithProviders(() => useUomLookup(true), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(uomFixtures.length);
    });
    expect(urls[0]?.searchParams.has('q')).toBe(false);
  });

  /** 단위도 잘리면 그 사실이 읽는 쪽에 닿아야 한다 — 표가 그것을 말하는 유일한 자리다. */
  it('잘리면 잘림을 밝힌다', async () => {
    const { fetch } = recordingFetch([route(UOMS_PATH, uomFixtures, 9999)]);
    const { result } = renderHookWithProviders(() => useUomLookup(true), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  it('조회가 실패하면 실패를 밝힌다 — 빈 목록으로 뭉개지 않는다', async () => {
    const failing: StubRoute = {
      match: (request) => new URL(request.url).pathname === UOMS_PATH,
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { fetch } = recordingFetch([failing]);
    const { result } = renderHookWithProviders(() => useUomLookup(true), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.entries).toEqual([]);
  });
});

describe('useWarehouseLookup — 관리수준', () => {
  /**
   * 관리수준은 **창고 조회에만 있는 사실**이다. 이름 풀이 항목에 얹으면 나머지 셋에 쓰이지
   * 않는 통로가 생긴다(사본 체크리스트 7번).
   */
  it('창고마다 관리수준 코드를 함께 낸다', async () => {
    const { fetch } = recordingFetch([route(WAREHOUSES_PATH, warehouseFixtures)]);
    const { result } = renderHookWithProviders(() => useWarehouseLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.levels).toHaveLength(2);
    });

    expect(result.current.levels[0]).toEqual({
      warehouseId: 9201,
      managementLevelCode: 'SYN-LEVEL',
    });
  });
});

describe('findWarehouseLevel', () => {
  const levels = [
    { warehouseId: 9201, managementLevelCode: 'SYN-LEVEL' },
    { warehouseId: 9202, managementLevelCode: 'SYN-OTHER' },
  ];

  it('그 창고의 관리수준을 찾는다', () => {
    expect(findWarehouseLevel(levels, 9202)).toBe('SYN-OTHER');
  });

  /** 없는 것을 값으로 지어내지 않는다 — 개폐 판정이 「모르는 상태」를 그대로 받아야 한다. */
  it('목록에 없으면 null이다', () => {
    expect(findWarehouseLevel(levels, 9999)).toBeNull();
  });

  it('창고를 고르기 전에는 null이다', () => {
    expect(findWarehouseLevel(levels, null)).toBeNull();
  });
});

describe('useLocationLookup — 위치 자체 용량', () => {
  it('수량과 단위가 둘 다 있는 위치만 담는다', async () => {
    const { fetch } = recordingFetch([route(LOCATIONS_PATH, locationFixtures)]);
    const { result } = renderHookWithProviders(() => useLocationLookup(9201), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(result.current.capacities).toEqual([
      { locationId: 9301, capacityQty: 400, capacityUomId: 9401 },
    ]);
  });

  /**
   * 계약이 둘을 함께 두게 했지만, 한쪽만 온 자료를 그대로 받으면 **단위를 모르는 수량**으로
   * 견주게 된다 — 그 자리는 담지 않는 것이 정확하다.
   */
  it('단위 없는 용량은 담지 않는다', async () => {
    const halfCapacity = [{ ...locationFixtures[0], capacityUomId: null }];
    const { fetch } = recordingFetch([route(LOCATIONS_PATH, halfCapacity)]);
    const { result } = renderHookWithProviders(() => useLocationLookup(9201), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    expect(result.current.capacities).toEqual([]);
  });
});

describe('findLocationCapacity', () => {
  const capacities = [{ locationId: 9301, capacityQty: 400, capacityUomId: 9401 }];

  it('그 위치의 용량을 찾는다', () => {
    expect(findLocationCapacity(capacities, 9301)?.capacityQty).toBe(400);
  });

  /** 용량이 없는 위치와 「용량이 0인 위치」는 다른 사실이다 — 앞엣것만 `null`이다. */
  it('용량이 없는 위치는 null이다', () => {
    expect(findLocationCapacity(capacities, 9302)).toBeNull();
  });

  /** 위치를 비운 창고 전체 규칙은 견줄 위치 자체가 없다. */
  it('위치를 고르지 않았으면 null이다', () => {
    expect(findLocationCapacity(capacities, null)).toBeNull();
  });
});

describe('useItemSearch', () => {
  /** 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니다. */
  it('검색어가 비면 부르지 않는다', async () => {
    const { fetch, urls } = recordingFetch([route(ITEMS_PATH, itemFixtures)]);
    const { result } = renderHookWithProviders(() => useItemSearch(''), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(0);
    });

    /* 조회가 열리지도 않은 상태를 「불러오는 중」으로 말하지 않는다 — 아직 찾지 않은 것이다. */
    expect(result.current.isLoading).toBe(false);
  });

  it('검색어와 쪽 크기를 실어 부른다', async () => {
    const { fetch, urls } = recordingFetch([route(ITEMS_PATH, itemFixtures)]);
    const { result } = renderHookWithProviders(() => useItemSearch('합성'), { fetch });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });

    expect(urls[0]?.searchParams.get('q')).toBe('합성');
    expect(urls[0]?.searchParams.get('size')).toBe(String(ITEM_SEARCH_SIZE));
  });

  /** 새로 만드는 규칙이 미사용 품목을 가리킬 이유가 없다(공유계약 G-8). */
  it('미사용 품목을 함께 달라고 하지 않는다', async () => {
    const { fetch, urls } = recordingFetch([route(ITEMS_PATH, itemFixtures)]);
    const { result } = renderHookWithProviders(() => useItemSearch('합성'), { fetch });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });

    expect(urls[0]?.searchParams.get('includeInactive')).toBeNull();
  });

  /** 잘렸다는 사실을 감추면 사용자가 「그런 품목은 없다」로 읽고 검색을 그만둔다. */
  it('잘림을 밝힌다', async () => {
    const { fetch } = recordingFetch([route(ITEMS_PATH, itemFixtures, 120)]);
    const { result } = renderHookWithProviders(() => useItemSearch('합성'), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  it('조회가 실패하면 실패를 밝힌다 — 빈 목록으로 뭉개지 않는다', async () => {
    const failing: StubRoute = {
      match: (request) => new URL(request.url).pathname === ITEMS_PATH,
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { fetch } = recordingFetch([failing]);
    const { result } = renderHookWithProviders(() => useItemSearch('합성'), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.rows).toEqual([]);
  });
});

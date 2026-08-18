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
  LOCATION_PAGE_SIZE,
  describeLocation,
  describeReference,
  lookupNote,
  nameLookupTruncatedNote,
  toLocation,
  toReference,
  toSelectOptions,
  useItemLookup,
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

describe('lookupNote', () => {
  const resultOf = (overrides: Partial<LookupResult> = {}): LookupResult => ({
    entries,
    isError: false,
    isLoading: false,
    truncated: false,
    refetch: () => undefined,
    ...overrides,
  });

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

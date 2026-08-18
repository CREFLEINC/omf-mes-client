import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { itemFixtures, locationFixtures, lotFixtures } from './fixtures';
import {
  describeReference,
  lookupNote,
  lotOptionsFor,
  toReference,
  toSelectOptions,
  useLocationLookup,
  useLotLookup,
  type LookupResult,
  type LotLookupResult,
  type ReferenceSource,
} from './lookups';

/**
 * 참조 다섯의 표기와 조회 시점.
 *
 * **네 갈래를 가르는 것이 요점이다**(미도착 · 목록에 없음 · 실패 · 정상). 하나로 뭉개면
 * 본 자료가 참조보다 먼저 오는 순간 정상 값이 「알 수 없음」으로 보이고, 그 문구는
 * *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다.
 */

const t = messages.stockAdjust;

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9401', label: 'SAMPLE-LOC-01 · 합성 위치 가', isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const lookup = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  entries: [...source().entries],
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: () => undefined,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 9401)).toEqual({
      kind: 'named',
      label: 'SAMPLE-LOC-01 · 합성 위치 가',
    });
  });

  it('목록에 없으면 알 수 없음이다', () => {
    expect(toReference(source(), 9409)).toEqual({ kind: 'unknown' });
  });

  it('값이 비어 있으면 알 수 없음이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
  });

  /** 순서가 뜻을 정한다 — **실패·미도착이 「목록에 없음」보다 앞선다.** */
  it('불러오기에 실패하면 「목록에 없음」이 아니라 실패다', () => {
    expect(toReference(source({ isError: true, entries: [] }), 9401)).toEqual({ kind: 'failed' });
  });

  it('아직 오지 않았으면 「목록에 없음」이 아니라 조회 중이다', () => {
    expect(toReference(source({ isLoading: true, entries: [] }), 9401)).toEqual({
      kind: 'loading',
    });
  });
});

describe('describeReference', () => {
  it('네 갈래의 문구가 서로 다르다 — 뭉개면 뜻이 사라진다', () => {
    const texts = [
      describeReference({ kind: 'named', label: 'SAMPLE-LOC-01' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(new Set(texts).size).toBe(4);
  });
});

describe('toSelectOptions', () => {
  it('미사용 값을 빼지 않고 표식만 붙인다', () => {
    const options = toSelectOptions(
      source({
        entries: [{ value: '9402', label: 'SAMPLE-LOC-02 · 합성 위치 나', isActive: false }],
      }),
    );

    expect(options).toEqual([
      { value: '9402', label: `SAMPLE-LOC-02 · 합성 위치 나${t.values.inactiveSuffix}` },
    ]);
  });
});

/**
 * **좁힘은 선택지 한 자리에만 건다**(사본 체크리스트 10번). 이름 풀이는 받은 전체로 한다 —
 * 좁힌 목록을 이름 풀이에도 쓰면 좁힘 밖의 정상 LOT이 「알 수 없음」으로 보인다.
 */
describe('lotOptionsFor', () => {
  const lots: LotLookupResult = {
    entries: [
      { value: '9701', label: 'SAMPLE-LOT-0001', isActive: true, itemId: '9501' },
      { value: '9702', label: 'SAMPLE-LOT-0002', isActive: true, itemId: '9502' },
    ],
    isError: false,
    isLoading: false,
    truncated: false,
    refetch: () => undefined,
  };

  it('그 줄의 품목이 가진 LOT만 고르게 한다', () => {
    expect(lotOptionsFor(lots, '9501')).toEqual([{ value: '9701', label: 'SAMPLE-LOT-0001' }]);
  });

  it('품목을 고르지 않았으면 고를 LOT도 없다', () => {
    expect(lotOptionsFor(lots, '')).toEqual([]);
  });

  /** 좁혀도 **이름 풀이는 전체가 그대로 쓴다** — 이 감지기가 그 짝이다. */
  it('좁힌 선택지가 이름 풀이를 줄이지 않는다', () => {
    expect(toReference(lots, 9702)).toEqual({ kind: 'named', label: 'SAMPLE-LOT-0002' });
  });
});

describe('lookupNote', () => {
  it('실패가 잘림보다 앞선다 — 둘 다 참인 자리가 실재한다', () => {
    expect(lookupNote(lookup({ isError: true, truncated: true }))).toBe(t.lookups.failed);
  });

  it('잘린 목록은 그 사실을 밝힌다', () => {
    expect(lookupNote(lookup({ truncated: true }))).toBe(t.lookups.truncated);
  });

  it('온전한 목록에는 안내를 붙이지 않는다 — 남으면 화면이 거짓말을 한다', () => {
    expect(lookupNote(lookup())).toBeUndefined();
  });
});

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

const route = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(listBody(items)),
});

const recordingFetch = (
  routes: StubRoute[],
): { fetch: (request: Request) => Promise<Response>; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
    urls,
  };
};

/**
 * **창고를 모르면 위치를 부르지 않는다.** 계약이 창고를 필수 조건으로 요구하므로 요청 자체가
 * 성립하지 않는다 — 부르면 400이 오고 사용자에게는 「화면이 안 된다」로 보인다.
 */
describe('useLocationLookup', () => {
  it('대상 창고를 알기 전에는 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recordingFetch([route('/mdm/locations', locationFixtures)]);
    const { result } = renderHookWithProviders(() => useLocationLookup(null), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toHaveLength(0);
  });

  it('창고를 알면 그 창고로 좁혀 부른다', async () => {
    const { fetch, urls } = recordingFetch([route('/mdm/locations', locationFixtures)]);
    const { result } = renderHookWithProviders(() => useLocationLookup(9201), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(urls[0]?.searchParams.get('warehouseId')).toBe('9201');
    /* 미사용 위치의 이름도 풀 수 있어야 한다 — 그 위치에 남은 재고를 조정하는 것이 정상 업무다. */
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
  });
});

/**
 * 자재 LOT은 **품목마다 한 번씩** 받는다 — 계약에 번호 목록으로 받는 조건이 없기 때문이다.
 * 같은 품목의 줄이 여럿이어도 요청은 하나여야 한다.
 */
describe('useLotLookup', () => {
  it('품목마다 한 번씩만 부른다', async () => {
    const { fetch, urls } = recordingFetch([route('/trace/lots', lotFixtures)]);
    const { result } = renderHookWithProviders(() => useLotLookup([9501, 9501, 9502], true), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls.map((url) => url.searchParams.get('itemId'))).toEqual(['9501', '9502']);
  });

  it('아직 부를 때가 아니면 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recordingFetch([route('/trace/lots', lotFixtures)]);
    const { result } = renderHookWithProviders(() => useLotLookup([9501], false), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toHaveLength(0);
  });

  it('어느 품목의 LOT인지 항목이 함께 든다 — 선택지를 좁히는 근거다', async () => {
    const { fetch } = recordingFetch([route('/trace/lots', itemLots())]);
    const { result } = renderHookWithProviders(() => useLotLookup([9501], true), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    expect(result.current.entries[0]?.itemId).toBe('9501');
  });
});

const itemLots = (): unknown[] => [
  { lotId: 9701, lotNo: 'SAMPLE-LOT-0001', itemId: itemFixtures[0]?.itemId ?? 9501 },
];

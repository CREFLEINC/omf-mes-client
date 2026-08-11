import { messages } from '@omf-mes/i18n';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { locationFixtures, PARTNER_LABEL, partnerFixtures } from './fixtures';
import {
  describeReference,
  isLotHeld,
  lookupNote,
  toReference,
  useLocationOptions,
  usePartnerOptions,
  type LotReferenceSource,
  type ReferenceSource,
} from './lookups';

const t = messages.supplierReturn;

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9701', label: 'SAMPLE-WH-01 · 합성 창고 가', isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const lotSource = (overrides: Partial<LotReferenceSource> = {}): LotReferenceSource => ({
  entries: [
    { value: '9601', label: 'LOT-2026-900010', isActive: true, held: false },
    { value: '9602', label: 'LOT-2026-900011', isActive: true, held: true },
  ],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 9701)).toEqual({
      kind: 'named',
      label: 'SAMPLE-WH-01 · 합성 창고 가',
    });
  });

  /**
   * **#47을 재생산하지 않는 자리다.** 본 자료가 참조보다 먼저 오면 정상 값이 「알 수 없음」으로
   * 보이는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  it('아직 오지 않은 것과 목록에 없는 것을 가른다', () => {
    expect(toReference(source({ entries: [], isLoading: true }), 9701)).toEqual({ kind: 'loading' });
    expect(toReference(source({ entries: [] }), 9701)).toEqual({ kind: 'unknown' });
  });

  /* 못 받은 목록으로 「그 값이 목록에 없다」를 판정하면 정상 값에 잘못된 값이라는 표를 붙인다. */
  it('실패가 미도착·목록에 없음보다 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true, entries: [] }), 9701)).toEqual({
      kind: 'failed',
    });
  });

  it('가리키는 번호가 없으면 알 수 없음이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /** **어느 갈래에도 번호를 담지 않는다**(#44). 담을 자리가 없으면 화면으로 샐 경로도 없다. */
  it.each([
    ['named', source(), 9701],
    ['unknown', source({ entries: [] }), 9701],
    ['loading', source({ entries: [], isLoading: true }), 9701],
    ['failed', source({ isError: true }), 9701],
  ] as const)('%s 갈래가 번호를 담지 않는다', (_kind, given, id) => {
    expect(JSON.stringify(toReference(given, id))).not.toContain('9701');
  });
});

describe('describeReference', () => {
  it('네 갈래의 문구가 서로 다르다', () => {
    const labels = [
      describeReference({ kind: 'named', label: '합성 창고 가' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(new Set(labels).size).toBe(4);
    expect(labels[1]).toBe(t.values.unknown);
    expect(labels[2]).toBe(t.values.referenceLoading);
    expect(labels[3]).toBe(t.values.referenceFailed);
  });
});

describe('lookupNote', () => {
  it('정상이면 안내가 없다', () => {
    expect(lookupNote(source())).toBeUndefined();
  });

  it('잘리면 그 사실을 밝힌다', () => {
    expect(lookupNote(source({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });

  /* 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 둘이 함께 참이 된다. */
  it('실패가 잘림보다 앞선다', () => {
    expect(lookupNote(source({ truncated: true, isError: true }))).toBe(t.filters.lookupFailed);
  });
});

describe('isLotHeld', () => {
  /**
   * 반품해도 LOT 보류는 유지된다(착수 이슈 §6) — 사용자가 그 사실을 아는 자리가 화면에
   * 있어야 한다. **표식은 표시일 뿐이며 선택을 막지 않는다.**
   */
  it('보류 중인 LOT을 가려낸다', () => {
    expect(isLotHeld(lotSource(), 9602)).toBe(true);
    expect(isLotHeld(lotSource(), 9601)).toBe(false);
  });

  /**
   * **모르는 것을 「보류 아님」으로 말하지 않는다** — 표식을 내지 않을 뿐이다.
   * 그 칸의 이름 표기가 이미 「아직 못 풀었다」를 네 갈래로 말하고 있다.
   */
  /**
   * **부분 자료로 표식을 붙이지 않는다.**
   *
   * 미도착·실패 갈래를 `entries: []`로 두면 가드가 있으나 없으나 `find()`가 `undefined`를 주어
   * **그 가드가 재어지지 않는다.** 실제로는 자재 LOT을 **품목마다** 조회하므로(`useLotOptions`)
   * 품목 둘 중 하나만 실패하거나 늦게 오면 **`isError`·`isLoading`이 참인데 `entries`는 차
   * 있는** 상태가 된다. 그때 가드가 없으면 이름 칸에는 「불러오기 실패」를 내면서 그 옆에
   * 보류 표식을 붙이는 어긋난 두 말이 나온다 — 그래서 **차 있는 상태로** 잰다.
   */
  it.each([
    ['목록에 없음', lotSource({ entries: [] })],
    ['일부만 도착', lotSource({ isLoading: true })],
    ['일부가 실패', lotSource({ isError: true })],
  ])('%s이면 표식을 내지 않는다', (_case, given) => {
    /* 짝 방향 — 뒤 둘은 그 번호가 목록에 **있는** 상태다(없어서 통과한 것이 아니다). */
    expect(given.entries.some((entry) => entry.value === '9602' && entry.held)).toBe(
      given.entries.length > 0,
    );
    expect(isLotHeld(given, 9602)).toBe(false);
  });
});

/**
 * 적치 위치 조회의 **성립 조건**을 재는 자리.
 *
 * 상세 조회와 같은 형태로 두 겹이다 — **① `enabled`**(창고가 없으면 조회 자체를 열지 않는다)와
 * **② `queryFn`의 가드**. 화면 수준에서 요청 수만 세면 ①을 떼어도 ②가 요청을 막아 아무
 * 단언도 실패하지 않는다. 계약이 창고를 **필수 쿼리**로 두었으므로 ①이 풀린 채 ②가 대체값으로
 * 바뀌면 **화면이 스스로 만든 실패**를 사용자에게 보이게 된다. 여기서 ①을 단독으로 잰다.
 */
const LOCATIONS_PATH = '/mdm/locations';

const locationsRoute = {
  match: (request: Request): boolean =>
    request.method === 'GET' && new URL(request.url).pathname === LOCATIONS_PATH,
  respond: (): Response =>
    jsonResponse({ items: locationFixtures, page: { page: 1, size: 50, total: locationFixtures.length } }),
};

const recordingFetch = (): { fetch: ReturnType<typeof createStubFetch>; paths: string[] } => {
  const paths: string[] = [];
  const stub = createStubFetch([locationsRoute]);

  return {
    paths,
    fetch: async (request) => {
      paths.push(new URL(request.url).pathname);

      return stub(request);
    },
  };
};

/**
 * 던져진 실패가 상태로 앉을 시간을 준다 — **동기로 곧바로 단언하면 놓친다.**
 * `queryFn`이 던져도 그 실패는 마이크로태스크를 한 바퀴 돈 뒤에야 쿼리 상태가 된다.
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('useLocationOptions', () => {
  it('창고가 없으면 조회가 서지 않는다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useLocationOptions(null), { fetch });

    await settle();

    expect(paths).toEqual([]);
    /* 조회가 **아예 서지 않았다** — 섰다가 가드에 막힌 것이 아니다. */
    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  /** 짝 방향 — 창고가 있으면 그 조건으로 실제로 나간다. */
  it('창고가 있으면 그 창고로 조회한다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useLocationOptions(9701), { fetch });

    await waitFor(() => {
      expect(result.current.entries.length).toBe(locationFixtures.length);
    });

    expect(paths).toEqual([LOCATIONS_PATH]);
  });
});

const PARTNERS_PATH = '/mdm/partners';

const partnersFetch = (
  page: Partial<{ page: number; size: number; total: number }> = {},
): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch([
    {
      match: (request: Request): boolean =>
        request.method === 'GET' && new URL(request.url).pathname === PARTNERS_PATH,
      respond: (): Response =>
        jsonResponse({
          items: partnerFixtures,
          page: { page: 1, size: 50, total: partnerFixtures.length, ...page },
        }),
    },
  ]);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
  };
};

describe('usePartnerOptions', () => {
  it('전표를 고르기 전에는 조회가 서지 않는다', async () => {
    const { fetch, urls } = partnersFetch();
    const { result } = renderHookWithProviders(() => usePartnerOptions(false), { fetch });

    await settle();

    expect(urls).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  /** 짝 방향 — 고른 뒤에는 실제로 나가고 「코드 · 이름」으로 읽힌다. */
  it('고른 뒤에는 코드와 이름을 함께 낸다', async () => {
    const { fetch, urls } = partnersFetch();
    const { result } = renderHookWithProviders(() => usePartnerOptions(true), { fetch });

    await waitFor(() => {
      expect(result.current.entries.length).toBe(partnerFixtures.length);
    });

    expect(urls.map((url) => url.pathname)).toEqual([PARTNERS_PATH]);
    expect(result.current.entries[0]?.label).toBe(PARTNER_LABEL);
  });

  /*
   * **미사용 거래처를 함께 받지 않는다.** 다른 다섯 참조와 갈리는 자리다 — 여기는 새 전표에
   * 실을 값을 **고르는** 곳이라, 미사용 값을 목록에 두면 유효하지 않은 도착지를 고를 수 있다.
   * 유효성 판정은 서버가 하며 기본 조회가 유효한 것만 내린다.
   */
  it('미사용 포함 조건을 싣지 않는다', async () => {
    const { fetch, urls } = partnersFetch();

    renderHookWithProviders(() => usePartnerOptions(true), { fetch });

    await waitFor(() => {
      expect(urls.length).toBe(1);
    });

    expect(urls[0]?.searchParams.has('includeInactive')).toBe(false);
  });

  /*
   * 계약에 **번호로 한 건을 받는 경로가 없어** 잘린 뒤쪽의 거래처는 고를 길이 아예 없다 —
   * 감추면 사용자가 「그런 거래처가 없다」로 결론짓는다.
   */
  it('전체 건수가 받은 건수보다 많으면 잘린 것으로 낸다', async () => {
    const { fetch } = partnersFetch({ total: partnerFixtures.length + 1 });
    const { result } = renderHookWithProviders(() => usePartnerOptions(true), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  it('잘리지 않았으면 그렇게 낸다', async () => {
    const { fetch } = partnersFetch();
    const { result } = renderHookWithProviders(() => usePartnerOptions(true), { fetch });

    await waitFor(() => {
      expect(result.current.entries.length).toBe(partnerFixtures.length);
    });

    expect(result.current.truncated).toBe(false);
  });
});

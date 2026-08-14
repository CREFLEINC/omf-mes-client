import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  itemFixtures,
  locationFixtures,
  lotFixturesByItem,
  PARTNER_LABEL,
  partnerFixtures,
  SAMPLE_PARTNER_ROLE,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import {
  describeReference,
  isLotHeld,
  isTruncated,
  LOT_PAGE_SIZE,
  lookupNote,
  toReference,
  useDisposalPartnerOptions,
  useItemOptions,
  useLocationOptions,
  useLotOptions,
  usePartnerNames,
  useUomOptions,
  useWarehouseOptions,
  type LotReferenceSource,
  type ReferenceSource,
} from './lookups';

const t = messages.disposalIssue;

const WAREHOUSES_PATH = '/mdm/warehouses';
const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9701', label: WAREHOUSE_LABEL, isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 9701)).toEqual({ kind: 'named', label: WAREHOUSE_LABEL });
  });

  /**
   * **`omf-mes#47`을 재생산하지 않는 자리다.** 본 자료가 참조보다 먼저 오면 정상 값이
   * 「알 수 없음」으로 보이는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
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

  it('번호가 없으면 목록에 없음으로 본다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /** **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`) — 담을 자리가 없으면 샐 경로도 없다. */
  it('어느 갈래에도 번호를 담지 않는다', () => {
    for (const state of [
      toReference(source(), 9701),
      toReference(source({ entries: [] }), 9799),
      toReference(source({ isLoading: true, entries: [] }), 9701),
      toReference(source({ isError: true, entries: [] }), 9701),
    ]) {
      expect(JSON.stringify(state)).not.toContain('9701');
      expect(JSON.stringify(state)).not.toContain('9799');
    }
  });
});

describe('describeReference', () => {
  /** 네 갈래의 문구가 서로 달라야 뜻이 구분된다 — 뭉치면 사용자가 원인을 반대로 읽는다. */
  it('네 갈래의 문구가 서로 다르다', () => {
    const texts = [
      describeReference({ kind: 'named', label: WAREHOUSE_LABEL }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(texts).toEqual([
      WAREHOUSE_LABEL,
      t.values.unknown,
      t.values.referenceLoading,
      t.values.referenceFailed,
    ]);
    expect(new Set(texts).size).toBe(4);
  });
});

describe('isTruncated · lookupNote', () => {
  it('전체 건수가 받은 건수보다 많으면 잘린 것이다', () => {
    expect(isTruncated({ page: 1, size: 50, total: 120 }, 50)).toBe(true);
    expect(isTruncated({ page: 1, size: 50, total: 50 }, 50)).toBe(false);
  });

  /** **실패가 잘림보다 앞선다** — 첫 조회가 잘리고 다시 부르기가 실패하면 둘이 함께 참이 된다. */
  it('실패가 잘림보다 앞선다', () => {
    expect(lookupNote({ isError: true, truncated: true })).toBe(t.filters.lookupFailed);
    expect(lookupNote({ isError: false, truncated: true })).toBe(t.filters.lookupTruncated);
    expect(lookupNote({ isError: false, truncated: false })).toBeUndefined();
  });

  /**
   * **창고 유형 미확정 안내는 이 함수가 내지 않는다.** 목록을 받아 온 결과가 아니라 값 목록이
   * 확정되지 않았다는 별개의 사실이고, 화면이 둘을 이어 붙인다.
   */
  it('창고 유형 미확정 안내를 내지 않는다', () => {
    expect(lookupNote({ isError: false, truncated: false })).not.toBe(t.filters.warehouseTypePending);
  });
});

const warehousesFetch = (
  page: Partial<{ page: number; size: number; total: number }> = {},
): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
  const urls: URL[] = [];

  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === WAREHOUSES_PATH,
      respond: (request) => {
        urls.push(new URL(request.url));

        return jsonResponse({
          items: warehouseFixtures,
          page: { page: 1, size: 50, total: warehouseFixtures.length, ...page },
        });
      },
    },
  ]);

  return { fetch, urls };
};

describe('useWarehouseOptions', () => {
  it('「코드 · 이름」으로 풀고 유형 코드를 함께 나른다', async () => {
    const { fetch } = warehousesFetch();
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(warehouseFixtures.length);
    });

    expect(result.current.entries[0]).toEqual({
      value: '9701',
      label: WAREHOUSE_LABEL,
      isActive: true,
      warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
    });
  });

  /**
   * **미사용 창고를 빼지 않는다** — 이 칸은 과거 입고를 찾는 조건이라, 빼면 그 입고를
   * 조건으로 찾을 방법이 사라진다. 목록에 남기고 표식은 화면이 붙인다.
   */
  it('미사용까지 받아 오고 목록에 남긴다', async () => {
    const { fetch, urls } = warehousesFetch();
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(warehouseFixtures.length);
    });

    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
    expect(result.current.entries.some((entry) => !entry.isActive)).toBe(true);
  });

  /**
   * **유형으로 좁혀 받지 않는다.** 실을 값이 아직 없고, 값이 정해져도 목록 표의 창고 이름은
   * 조건 밖 창고까지 풀어야 한다 — 좁히는 자리는 선택지 하나다.
   */
  it('창고 유형 조건을 싣지 않는다', async () => {
    const { fetch, urls } = warehousesFetch();
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(warehouseFixtures.length);
    });

    expect(urls[0]?.searchParams.has('warehouseTypeCode')).toBe(false);
  });

  it('목록이 잘리면 그 사실을 낸다', async () => {
    const { fetch } = warehousesFetch({ total: 120 });
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  it('실패하면 실패로 앉고 복구 경로를 낸다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === WAREHOUSES_PATH,
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.entries).toEqual([]);
    expect(typeof result.current.refetch).toBe('function');
  });
});

const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';
const LOCATIONS_PATH = '/mdm/locations';

const recording = (
  routes: StubRoute[],
): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
    urls,
  };
};

const listBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 50, total },
});

const route = (pathname: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond,
});

describe('useItemOptions · useUomOptions', () => {
  /**
   * **전표를 고르기 전에는 부르지 않는다.** 이름이 필요한 라인 표 자체가 상세 응답을
   * 기다리므로 미리 받아 둘 이득이 없고, 첫 진입의 요청 수만 이유 없이 는다.
   */
  it('고르기 전에는 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([
      route(ITEMS_PATH, () => jsonResponse(listBody(itemFixtures))),
      route(UOMS_PATH, () => jsonResponse(listBody(uomFixtures))),
    ]);
    const { result } = renderHookWithProviders(
      () => ({ items: useItemOptions(false), uoms: useUomOptions(false) }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.items.isLoading).toBe(false);
    });

    expect(urls).toEqual([]);
    /* 「아직 안 불렀다」를 **불러오는 중**으로 말하지 않는다 — 그러면 이름 칸이 영영 회색이다. */
    expect(result.current.uoms.isLoading).toBe(false);
  });

  it('「코드 · 이름」으로 풀고 미사용까지 받아 온다', async () => {
    const { fetch, urls } = recording([
      route(ITEMS_PATH, () => jsonResponse(listBody(itemFixtures))),
      route(UOMS_PATH, () => jsonResponse(listBody(uomFixtures))),
    ]);
    const { result } = renderHookWithProviders(
      () => ({ items: useItemOptions(true), uoms: useUomOptions(true) }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.items.entries).toHaveLength(itemFixtures.length);
      expect(result.current.uoms.entries).toHaveLength(uomFixtures.length);
    });

    expect(result.current.items.entries[0]).toEqual({
      value: '9301',
      label: 'SAMPLE-ITEM-01 · 합성 자재 가',
      isActive: true,
    });
    expect(result.current.uoms.entries[0]?.label).toBe('SAMPLE-UOM-EA · 합성 낱개');
    expect(result.current.items.entries.some((entry) => !entry.isActive)).toBe(true);

    for (const url of urls) {
      expect(url.searchParams.get('includeInactive')).toBe('true');
    }
  });

  it('잘리면 그 사실을 낸다', async () => {
    const { fetch } = recording([
      route(ITEMS_PATH, () => jsonResponse(listBody(itemFixtures, 500))),
    ]);
    const { result } = renderHookWithProviders(() => useItemOptions(true), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  /**
   * **기준정보 조회는 쪽 크기를 싣지 않는다**(`filters.ts`의 문면과 짝). 예외는 **잘릴 수
   * 있는 거래 기록 둘**(자재 LOT·재고 잔액)뿐이다 — 그 사실이 한 곳에만 적혀 있으면
   * 나중에 상수가 늘어도 아무도 모른다.
   */
  it('창고·품목·단위·위치는 쪽 크기를 싣지 않는다', async () => {
    const { fetch, urls } = recording([
      route(WAREHOUSES_PATH, () => jsonResponse(listBody(warehouseFixtures))),
      route(ITEMS_PATH, () => jsonResponse(listBody(itemFixtures))),
      route(UOMS_PATH, () => jsonResponse(listBody(uomFixtures))),
      route(LOCATIONS_PATH, () => jsonResponse(listBody(locationFixtures))),
    ]);
    const { result } = renderHookWithProviders(
      () => ({
        warehouses: useWarehouseOptions(),
        items: useItemOptions(true),
        uoms: useUomOptions(true),
        locations: useLocationOptions(9701),
      }),
      { fetch },
    );

    /* 짝 방향 — 네 조회가 실제로 나가 응답까지 도착했다. 0건이면 「싣지 않는다」가 공허하다. */
    await waitFor(() => {
      expect(result.current.warehouses.entries.length).toBeGreaterThan(0);
      expect(result.current.items.entries.length).toBeGreaterThan(0);
      expect(result.current.uoms.entries.length).toBeGreaterThan(0);
      expect(result.current.locations.entries.length).toBeGreaterThan(0);
    });

    expect(urls).toHaveLength(4);

    for (const url of urls) {
      expect(url.searchParams.has('size')).toBe(false);
    }
  });
});

describe('useLotOptions', () => {
  const lotsRoute = (): StubRoute =>
    route(LOTS_PATH, (request) => {
      const itemId = Number(new URL(request.url).searchParams.get('itemId'));

      return jsonResponse(listBody(lotFixturesByItem[itemId] ?? []));
    });

  it('고르기 전에는 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([lotsRoute()]);
    const { result } = renderHookWithProviders(() => useLotOptions([9301], false), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toEqual([]);
  });

  /**
   * **품목마다 한 번씩 받아 번호로 맞춘다** — 번호 여러 개로 한 번에 조회하는 수단이 계약에
   * 없다(실측). 같은 품목이 줄에 여럿이어도 요청은 한 번이다.
   */
  it('품목마다 한 번 부르고 중복 품목은 한 번만 부른다', async () => {
    const { fetch, urls } = recording([lotsRoute()]);
    const { result } = renderHookWithProviders(() => useLotOptions([9301, 9301, 9302], true), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3);
    });

    expect(urls.map((url) => url.searchParams.get('itemId')).sort()).toEqual(['9301', '9302']);
  });

  /** **쪽 크기를 명시한다** — 거래 기록이라 한 품목의 LOT이 시간이 갈수록 쌓인다. */
  it('쪽 크기를 싣는다', async () => {
    const { fetch, urls } = recording([lotsRoute()]);
    const { result } = renderHookWithProviders(() => useLotOptions([9301], true), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(urls[0]?.searchParams.get('size')).toBe(String(LOT_PAGE_SIZE));
  });

  /** LOT 번호를 라벨로 낸다 — 「코드 · 이름」이 아니다. 보류 여부는 응답이 함께 준다. */
  it('LOT 번호를 라벨로 내고 보류를 나른다', async () => {
    const { fetch } = recording([lotsRoute()]);
    const { result } = renderHookWithProviders(() => useLotOptions([9301], true), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(result.current.entries[0]).toEqual({
      value: '9601',
      label: 'SAMPLE-LOT-0001',
      isActive: true,
      held: false,
    });
    expect(result.current.entries[1]?.held).toBe(true);
  });

  /** **하나라도 실패하면 실패다** — 일부만 받은 목록으로 「목록에 없음」을 판정할 수 없다. */
  it('한 품목이 실패하면 전체가 실패다', async () => {
    const { fetch } = recording([
      route(LOTS_PATH, (request) =>
        new URL(request.url).searchParams.get('itemId') === '9302'
          ? jsonResponse({ message: '' }, { status: 500 })
          : jsonResponse(listBody(lotFixturesByItem[9301] ?? [])),
      ),
    ]);
    const { result } = renderHookWithProviders(() => useLotOptions([9301, 9302], true), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('isLotHeld', () => {
  const lotSource = (overrides: Partial<LotReferenceSource> = {}): LotReferenceSource => ({
    entries: [
      { value: '9601', label: 'SAMPLE-LOT-0001', isActive: true, held: false },
      { value: '9602', label: 'SAMPLE-LOT-0002', isActive: true, held: true },
    ],
    isError: false,
    isLoading: false,
    truncated: false,
    ...overrides,
  });

  it('보류인 LOT만 참이다', () => {
    expect(isLotHeld(lotSource(), 9602)).toBe(true);
    expect(isLotHeld(lotSource(), 9601)).toBe(false);
  });

  /**
   * **모르는 것을 「보류 아님」으로 말하지 않는다** — 표식을 내지 않을 뿐이다.
   * 같은 칸의 이름 표기가 이미 「아직 못 풀었다」를 네 갈래로 말한다.
   */
  it('못 풀었거나 번호가 없으면 표식을 내지 않는다', () => {
    expect(isLotHeld(lotSource({ isError: true }), 9602)).toBe(false);
    expect(isLotHeld(lotSource({ isLoading: true }), 9602)).toBe(false);
    expect(isLotHeld(lotSource(), null)).toBe(false);
    expect(isLotHeld(lotSource(), 9699)).toBe(false);
  });
});

describe('useLocationOptions', () => {
  const locationsRoute = (): StubRoute =>
    route(LOCATIONS_PATH, () => jsonResponse(listBody(locationFixtures)));

  /**
   * **창고 번호가 없으면 부르지 않는다.** 계약이 창고를 필수 조건으로 두어 없이 부르면
   * 실패한다 — `?? 0`으로 메우면 **없는 창고의 조건으로 요청이 나간다.**
   */
  it('창고가 없으면 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([locationsRoute()]);
    const { result } = renderHookWithProviders(() => useLocationOptions(null), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toEqual([]);
  });

  it('고른 전표의 창고로 조회하고 미사용까지 받아 온다', async () => {
    const { fetch, urls } = recording([locationsRoute()]);
    const { result } = renderHookWithProviders(() => useLocationOptions(9701), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(locationFixtures.length);
    });

    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      includeInactive: 'true',
    });
    expect(result.current.entries[0]?.label).toBe('SAMPLE-LOC-01 · 합성 적치 가');
  });
});

const PARTNERS_PATH = '/mdm/partners';

/**
 * 거래처 응답 — **질의에 따라 내용이 달라진다.**
 *
 * 좁힌 조회와 좁히지 않은 조회가 **같은 경로**라, 스텁이 늘 같은 목록을 돌려주면 「선택지가
 * 좁혀 받은 목록인가 이름 풀이 목록인가」를 어떤 감지기도 가를 수 없다 — 캐시 키를 한 벌로
 * 합쳐 두는 결함이 그대로 통과한다(전례의 두 스텁 형태 중 **내용까지 달라지는** 쪽).
 */
const partnersRoute = (total?: number): StubRoute =>
  route(PARTNERS_PATH, (request) => {
    const narrowed = new URL(request.url).searchParams.has('roleTypeCode');
    const items = narrowed ? partnerFixtures.slice(0, 1) : partnerFixtures;

    return jsonResponse(listBody(items, total ?? items.length));
  });

/**
 * **선택지 조회의 전환 감지기**(변경 통지 #128 §3 · 완료 조건 C23·C24).
 *
 * 역할 코드가 비어 있는 동안은 **부르지 않는 것이 규칙이다** — 빈 값으로 부르면 좁히지 않은
 * 거래처 전부가 폐기 거래처 선택지로 서고, 사용자는 폐기와 무관한 상대를 되돌릴 수 없는
 * 전표에 실을 수 있다.
 */
describe('useDisposalPartnerOptions — 전환 두 방향', () => {
  it('역할 코드가 비면 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(() => useDisposalPartnerOptions('', true), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toEqual([]);
    expect(result.current.entries).toEqual([]);
  });

  /** 공백만인 값도 채워진 것이 아니다 — 그대로 실으면 좁히지 않은 목록을 좁혔다고 믿는다. */
  it('공백만인 역할 코드로도 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(() => useDisposalPartnerOptions('   ', true), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toEqual([]);
  });

  /** 전표를 고르기 전에도 부르지 않는다 — 폼 자체가 상세 응답을 기다린다. */
  it('전표를 고르기 전에는 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(
      () => useDisposalPartnerOptions(SAMPLE_PARTNER_ROLE, false),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toEqual([]);
  });

  /**
   * **둘째 방향** — 채우면 살아나지 않는 자리표시는 죽은 가지다. 그 값이 **질의 조건으로
   * 실려 나가는지**까지 본다: 실리지 않으면 좁히지 않은 목록을 좁혔다고 믿게 된다.
   */
  it('역할 코드를 채우면 그 값이 질의로 실려 나간다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(
      () => useDisposalPartnerOptions(SAMPLE_PARTNER_ROLE, true),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0);
    });

    expect(urls).toHaveLength(1);
    expect(urls[0]?.searchParams.get('roleTypeCode')).toBe(SAMPLE_PARTNER_ROLE);
    /* 좁혀 받은 목록이 실제로 온다 — 좁히지 않은 응답을 쓰면 건수가 다르다. */
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toEqual({
      value: '9561',
      label: PARTNER_LABEL,
      isActive: true,
    });
  });

  /**
   * **미사용 거래처를 함께 받지 않는다.** 이름 풀이와 갈리는 자리다 — 여기는 새 전표에 실을
   * 값을 **고르는** 곳이라, 미사용 값을 목록에 두면 유효하지 않은 도착지를 고를 수 있다.
   * 유효성 판정은 서버가 하며 기본 조회가 유효한 것만 내린다(공유계약 G-8).
   */
  it('미사용 포함 조건을 싣지 않는다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(
      () => useDisposalPartnerOptions(SAMPLE_PARTNER_ROLE, true),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0);
    });

    expect(urls[0]?.searchParams.has('includeInactive')).toBe(false);
  });

  /**
   * 계약에 **번호로 한 건을 받는 경로가 없어**(실측: `q`·`roleTypeCode`·`page`·`size` 등)
   * 잘린 뒤쪽의 거래처는 이 화면에서 고를 길이 아예 없다 — 감추면 사용자가 「그런 거래처가
   * 없다」로 결론짓는다. 형제 슬라이스가 같은 한계를 질문으로 올려 두었다.
   */
  it('목록이 잘리면 그 사실을 낸다', async () => {
    const { fetch } = recording([partnersRoute(120)]);
    const { result } = renderHookWithProviders(
      () => useDisposalPartnerOptions(SAMPLE_PARTNER_ROLE, true),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  it('잘리지 않았으면 그렇게 낸다', async () => {
    const { fetch } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(
      () => useDisposalPartnerOptions(SAMPLE_PARTNER_ROLE, true),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0);
    });

    expect(result.current.truncated).toBe(false);
  });
});

/**
 * **이름 풀이는 좁히지 않는다**(`omf-mes#47` · copy-checklist).
 *
 * 좁힌 조회로 이름을 풀면 좁힘 밖의 정상 거래처가 「알 수 없음」으로 보이는데, 그 문구는
 * *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다. 이미 저장된 전표는 지금의 역할 좁힘과
 * 무관한 거래처를 가리킬 수 있다 — 역할이 나중에 회수될 수도 있다.
 */
describe('usePartnerNames — 좁히지 않는다', () => {
  it('가리키는 도착지가 없으면 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(() => usePartnerNames(false), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls).toEqual([]);
  });

  it('역할 코드를 싣지 않고 미사용까지 받아 온다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(() => usePartnerNames(true), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(partnerFixtures.length);
    });

    expect(urls[0]?.searchParams.has('roleTypeCode')).toBe(false);
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
    /* 짝 방향 — 미사용 거래처가 실제로 목록에 남는다(빼면 그 전표의 이름이 비어 보인다). */
    expect(result.current.entries.some((entry) => !entry.isActive)).toBe(true);
  });

  it('「코드 · 이름」으로 풀고 번호를 담지 않는다', async () => {
    const { fetch } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(() => usePartnerNames(true), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(partnerFixtures.length);
    });

    expect(result.current.entries[0]?.label).toBe(PARTNER_LABEL);
    expect(result.current.entries[0]?.label).not.toContain('9561');
  });

  /**
   * **두 조회가 서로 다른 요청이고 서로 다른 목록을 받는다**(완료 조건 C25).
   *
   * 캐시 키를 한 벌로 합치면 먼저 도착한 쪽이 다른 쪽 자리에 서고, 그때 좁힌 목록으로 이름을
   * 푸는 `omf-mes#47`이 그대로 되살아난다 — 그것을 **건수 차이**로 잰다.
   */
  it('선택지 조회와 다른 요청으로 나가고 목록도 다르다', async () => {
    const { fetch, urls } = recording([partnersRoute()]);
    const { result } = renderHookWithProviders(
      () => ({
        options: useDisposalPartnerOptions(SAMPLE_PARTNER_ROLE, true),
        names: usePartnerNames(true),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.options.entries.length).toBeGreaterThan(0);
      expect(result.current.names.entries.length).toBeGreaterThan(0);
    });

    expect(urls).toHaveLength(2);
    expect(urls.filter((url) => url.searchParams.has('roleTypeCode'))).toHaveLength(1);
    expect(result.current.options.entries).toHaveLength(1);
    expect(result.current.names.entries).toHaveLength(partnerFixtures.length);
  });
});

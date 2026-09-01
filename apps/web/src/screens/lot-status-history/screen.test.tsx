import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { components } from '@omf-mes/api-client';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { pickRange } from '../../test/date-picker';
import { LotStatusHistoryScreen } from './screen';

const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === path,
  respond,
});

const list = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 50, total },
});

type LotTypeState = 'ready' | 'empty' | 'error';

const codeRoute = (typeState: LotTypeState = 'ready'): StubRoute =>
  route('/mdm/code-values', (request) => {
    const group = new URL(request.url).searchParams.get('codeGroupCode');
    if (group === 'LOT_TYPE' && typeState === 'error') {
      return jsonResponse({ message: '합성 오류' }, { status: 500 });
    }
    const items =
      group === 'LOT_TYPE'
        ? typeState === 'empty'
          ? []
          : [{ code: 'SAMPLE_MATERIAL', codeName: '합성 자재', displayOrder: 1, isActive: true }]
        : [
            { code: 'SAMPLE_NORMAL', codeName: '합성 정상', displayOrder: 1, isActive: false },
            { code: 'SAMPLE_DEFECTIVE', codeName: '합성 불량', displayOrder: 2, isActive: true },
            { code: 'SAMPLE_PENDING', codeName: '합성 대기', displayOrder: 3, isActive: true },
            { code: 'SAMPLE_SCRAPPED', codeName: '합성 폐기', displayOrder: 4, isActive: true },
          ];
    return jsonResponse(
      list(items, group === 'LOT_TYPE' && typeState === 'ready' ? 2 : items.length),
    );
  });

const referenceRoutes = (itemStatus = 200): StubRoute[] => [
  route('/mdm/warehouses', () =>
    jsonResponse(
      list(
        [
          {
            warehouseId: 101,
            warehouseCode: 'SAMPLE-WH-01',
            warehouseName: '합성 창고',
            isActive: false,
          },
        ],
        2,
      ),
    ),
  ),
  route('/mdm/items', () =>
    jsonResponse(
      list([{ itemId: 103, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목', isActive: false }]),
      { status: itemStatus },
    ),
  ),
  route('/mdm/locations', () =>
    jsonResponse(
      list([
        {
          locationId: 102,
          locationCode: 'SAMPLE-LOC-01',
          locationName: '합성 위치',
          isActive: true,
        },
      ]),
    ),
  ),
];

const statusRow: components['schemas']['LotQualityStatus'] = {
  lotId: 401,
  lotNo: 'SAMPLE-LOT-001',
  itemId: 103,
  lotTypeCode: 'SAMPLE_MATERIAL',
  lotStatusCode: 'SAMPLE_UNKNOWN',
  onHandQty: 0,
  fullyHeld: false,
  latestTransitionAt: '2026-08-21T12:34:00+09:00',
  latestReasonCode: 'SAMPLE_REASON',
  versionNo: 1,
};

const qualityRoutes = (
  listStatus = 200,
  summaryStatus = 200,
  rows = [statusRow],
  total = 101,
  outOfScopeCount: number | null = 2,
  pageOverride: Partial<components['schemas']['PageMeta']> = {},
): StubRoute[] => [
  route('/quality/lot-statuses', (request) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
    return jsonResponse(
      { items: rows, page: { page, size: 50, total, ...pageOverride } },
      { status: listStatus },
    );
  }),
  route('/quality/lot-status-summary', () =>
    jsonResponse(
      {
        counts: [
          { statusCode: 'SAMPLE_NORMAL', lotCount: 7, lotTypeCode: 'SAMPLE_MATERIAL' },
          { statusCode: 'SAMPLE_DEFECTIVE', lotCount: 3, lotTypeCode: 'SAMPLE_MATERIAL' },
          { statusCode: 'SAMPLE_PENDING', lotCount: 0, lotTypeCode: 'SAMPLE_MATERIAL' },
        ],
        asOf: '2026-08-21T13:00:00+09:00',
        outOfScopeCount,
      },
      { status: summaryStatus },
    ),
  ),
];

const detailRoutes = (
  detailStatus = 200,
  lotOverrides: Record<string, unknown> = {},
): StubRoute[] => [
  route('/trace/lots/401', () =>
    jsonResponse(
      {
        lot: {
          lotId: 401,
          lotNo: 'SAMPLE-LOT-001',
          itemId: 103,
          lotTypeCode: 'SAMPLE_MATERIAL',
          plantId: 201,
          initialQty: 120,
          uomId: 301,
          manufacturedAt: '2026-08-20T08:30:00+09:00',
          expiryDate: '2027-08-20',
          sourceTypeCode: 'SAMPLE_SOURCE',
          sourceId: 501,
          statusCode: 'SAMPLE_DEFECTIVE',
          ...lotOverrides,
        },
        externalIdentifiers: [],
        holds: [],
      },
      { status: detailStatus },
    ),
  ),
];

const holdRoutes = (holdStatus = 200, userStatus = 200, actorTotal = 2): StubRoute[] => [
  route('/quality/lot-holds', (request) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
    const items =
      page === 1
        ? [
            {
              lotHoldId: 701,
              lotId: 401,
              reasonCode: 'SAMPLE_REASON_OPEN',
              statusCode: 'SAMPLE_OPEN',
              heldBy: 601,
              heldAt: '2026-08-21T09:00:00+09:00',
              holdQty: null,
              releaseCondition: '합성 해제 조건',
            },
            {
              lotHoldId: 702,
              lotId: 401,
              reasonCode: 'SAMPLE_REASON_RELEASED',
              statusCode: 'SAMPLE_RELEASED',
              heldBy: 601,
              heldAt: '2026-08-19T09:00:00+09:00',
              releasedBy: 602,
              releasedAt: '2026-08-20T10:00:00+09:00',
              holdQty: 0,
            },
          ]
        : [
            {
              lotHoldId: 703,
              lotId: 401,
              reasonCode: 'SAMPLE_REASON_PAGE_2',
              statusCode: 'SAMPLE_OPEN',
              heldBy: 601,
              heldAt: '2026-08-18T09:00:00+09:00',
              holdQty: 5,
            },
          ];
    return jsonResponse({ items, page: { page, size: 50, total: 51 } }, { status: holdStatus });
  }),
  route('/app/users', () =>
    jsonResponse(
      list(
        [
          {
            appUserId: 601,
            loginId: 'sample.holder',
            userName: '합성 등록자',
            statusCode: 'SAMPLE_ACTIVE',
            isActive: true,
          },
          {
            appUserId: 602,
            loginId: 'sample.releaser',
            userName: '합성 해제자',
            statusCode: 'SAMPLE_ACTIVE',
            isActive: false,
          },
        ],
        actorTotal,
      ),
      { status: userStatus },
    ),
  ),
];

const eventRoutes = (status = 200, empty = false): StubRoute[] => [
  route('/quality/lot-hold-events', (request) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
    const items = empty
      ? []
      : page === 1
        ? [
            {
              lotHoldId: 801,
              eventTypeCode: 'HELD',
              occurredAt: '2026-08-20T09:00:00+09:00',
              lotId: 401,
              lotNo: 'SAMPLE-LOT-001',
              actorId: 601,
              actorName: '사건 응답 이름',
              reasonCode: 'SAMPLE_REASON_HELD',
            },
            {
              lotHoldId: 801,
              eventTypeCode: 'RELEASED',
              occurredAt: '2026-08-21T10:00:00+09:00',
              lotId: 401,
              lotNo: 'SAMPLE-LOT-001',
              actorId: 602,
              actorName: '   ',
            },
          ]
        : [
            {
              lotHoldId: 802,
              eventTypeCode: 'HELD',
              occurredAt: '2026-08-19T08:00:00+09:00',
              lotId: 402,
              lotNo: 'SAMPLE-LOT-002',
              actorId: 601,
              actorName: '다음 쪽 담당자',
              reasonCode: 'SAMPLE_REASON_PAGE_2',
            },
          ];
    return jsonResponse({ items, page: { page, size: 2, total: empty ? 0 : 3 } }, { status });
  }),
];

const fetchFor = (
  typeState: LotTypeState = 'ready',
  currentRoutes = qualityRoutes(),
  itemStatus = 200,
) => createStubFetch([codeRoute(typeState), ...referenceRoutes(itemStatus), ...currentRoutes]);

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderScreen = (
  route = '/quality/lot-status',
  typeState: LotTypeState = 'ready',
  currentRoutes = qualityRoutes(),
  itemStatus = 200,
) => {
  const urls: URL[] = [];
  const stubFetch = fetchFor(typeState, currentRoutes, itemStatus);
  const result = renderWithProviders(
    <>
      <LotStatusHistoryScreen />
      <LocationProbe />
    </>,
    {
      route,
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stubFetch(request);
      },
    },
  );
  return { ...result, urls };
};

const locationSearch = (): URLSearchParams => {
  const value = screen.getByTestId('location').textContent ?? '';
  return new URL(value, 'http://test').searchParams;
};

const requestCount = (urls: URL[], path: string): number =>
  urls.filter(({ pathname }) => pathname === path).length;

const lastRequest = (urls: URL[], path: string): URL | undefined =>
  urls.filter(({ pathname }) => pathname === path).at(-1);

const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('Lot Status 화면 shell', () => {
  it('기본 모드에서 초안을 주소에 쓰지 않고 조회할 때만 적용한다', async () => {
    const { urls } = renderScreen('/quality/lot-status?from=2026-08-01');
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { name: 'Lot Status 현황·변경이력 조회' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: '탐색 경로' })).toBeVisible();
    expect(screen.getByRole('tablist', { name: 'Lot Status 조회 모드' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'LOT으로 찾기' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await choose(user, 'LOT 유형', '합성 자재');
    await choose(user, '현재 상태', '합성 정상 (미사용)');
    await choose(user, '창고', 'SAMPLE-WH-01 · 합성 창고 (미사용)');
    await user.type(screen.getByLabelText('LOT 번호'), 'SAMPLE-LOT-001');
    expect(await screen.findByText('일부 LOT 유형만 표시됩니다.')).toBeVisible();
    expect(await screen.findByText('일부 창고만 표시됩니다.')).toBeVisible();
    expect(locationSearch().get('lotType')).toBeNull();

    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(locationSearch().get('lotType')).toBe('SAMPLE_MATERIAL');
    expect(locationSearch().get('q')).toBe('SAMPLE-LOT-001');
    expect(locationSearch().get('status')).toBe('SAMPLE_NORMAL');
    expect(locationSearch().get('warehouse')).toBe('101');
    expect(locationSearch().get('from')).toBe('2026-08-01');
    expect(await screen.findByText('7')).toBeVisible();
    const summary = within(screen.getByRole('group', { name: '현재 상태 요약' }));
    expect(summary.getAllByText('건')).toHaveLength(4);
    const cardLabels = summary.getAllByRole('group').map((card) => card.getAttribute('aria-label'));
    expect(cardLabels.join()).toBe('합성 정상 (미사용),합성 불량,합성 대기,합성 폐기');
    expect(summary.getByText('0')).toBeVisible();
    expect(summary.getByText('집계 미확정')).toBeVisible();
    expect(screen.getByText('SAMPLE_UNKNOWN (목록 미확정)')).toBeVisible();
    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 (미사용)')).toBeVisible();
    expect(screen.getByText('권한 범위 밖 2건이 제외되었습니다.')).toBeVisible();
    expect(screen.getByText('기준 시각 2026-08-21 13:00')).toBeVisible();
    const table = screen.getByRole('table', { name: '현재 LOT 상태' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
    expect(within(table).getByText('0')).toBeVisible();
  });

  it('이력 모드로 바꾸면 다른 조건은 보존하고 선택 LOT만 제거한다', async () => {
    renderScreen('/quality/lot-status?lotType=SAMPLE_MATERIAL&lot=404&from=2026-08-01');
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: '이력으로 찾기' }));
    await waitFor(() => expect(locationSearch().get('mode')).toBe('history'));
    expect(locationSearch().get('lotType')).toBe('SAMPLE_MATERIAL');
    expect(locationSearch().get('from')).toBe('2026-08-01');
    expect(locationSearch().get('lot')).toBeNull();
    expect(screen.getByText('기간을 선택하고 조회하세요')).toBeVisible();
  });

  it('이력 모드 최초 진입에서는 현재 조회 선택지를 요청하지 않는다', async () => {
    const { urls } = renderScreen('/quality/lot-status?mode=history', 'ready', holdRoutes());

    expect(screen.getByText('기간을 선택하고 조회하세요')).toBeVisible();
    await waitFor(() => expect(requestCount(urls, '/app/users')).toBe(1));
    expect(lastRequest(urls, '/app/users')?.searchParams.get('includeInactive')).toBe('true');
    for (const path of ['/mdm/code-values', '/mdm/items', '/mdm/warehouses']) {
      expect(requestCount(urls, path)).toBe(0);
    }
  });

  it.each([
    [200, 3, '일부 행위자만 표시됩니다.'],
    [500, 2, '행위자 목록을 불러오지 못했습니다.'],
  ])('행위자 목록 상태 %i를 필터를 감추지 않고 밝힌다', async (status, total, note) => {
    renderScreen('/quality/lot-status?mode=history', 'ready', holdRoutes(200, status, total));

    expect(await screen.findByText(note)).toBeVisible();
    expect(screen.getByLabelText('행위자')).toBeVisible();
  });

  it('이력 초안을 조회할 때만 URL에 적용하고 이력 초기화가 LOT 조건을 보존한다', async () => {
    const { urls } = renderScreen(
      '/quality/lot-status?mode=history&lotType=SAMPLE_MATERIAL&page=3&from=2026-08-01&to=2026-08-07&actor=601&historyLot=OLD&historyPage=4',
      'ready',
      [...holdRoutes(), ...eventRoutes()],
    );
    const user = userEvent.setup();

    await pickRange(user, screen.getByLabelText('기간'), '2026-07-20', '2026-07-25');
    await choose(user, '행위자', '합성 해제자 (미사용)');
    await user.clear(screen.getByLabelText('LOT'));
    await user.type(screen.getByLabelText('LOT'), 'SAMPLE-LOT-001');
    expect(locationSearch().get('historyLot')).toBe('OLD');

    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(Object.fromEntries(locationSearch())).toMatchObject({
      mode: 'history',
      lotType: 'SAMPLE_MATERIAL',
      page: '3',
      from: '2026-07-20',
      to: '2026-07-25',
      actor: '602',
      historyLot: 'SAMPLE-LOT-001',
    });
    expect(locationSearch().get('historyPage')).toBeNull();
    await waitFor(() => expect(requestCount(urls, '/quality/lot-hold-events')).toBe(2));

    await user.click(screen.getByRole('button', { name: '초기화' }));
    for (const key of ['from', 'to', 'actor', 'historyLot', 'historyPage']) {
      expect(locationSearch().get(key)).toBeNull();
    }
    expect(locationSearch().get('lotType')).toBe('SAMPLE_MATERIAL');
    expect(locationSearch().get('page')).toBe('3');
  });

  it('보류 등록·해제 사건을 응답 행위자로 5열 표에 표시하고 서버 쪽을 이동한다', async () => {
    const { urls } = renderScreen(
      '/quality/lot-status?mode=history&from=2026-08-01&to=2026-08-07&actor=601&historyLot=SAMPLE-LOT-001',
      'ready',
      [...holdRoutes(), ...eventRoutes()],
    );
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: '보류 사건 이력' });

    expect(screen.getByText(/전체 상태 전이는 기록되지 않습니다/)).toBeVisible();
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['일시', 'LOT', '전이/사건', '행위자', '사유']);
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('2026-08-20 09:00SAMPLE-LOT-001보류 등록');
    expect(rows[2]).toHaveTextContent('2026-08-21 10:00SAMPLE-LOT-001보류 해제');
    expect(within(table).getByText('보류 등록')).toBeVisible();
    expect(within(table).getByText('보류 해제')).toBeVisible();
    expect(within(table).getByText('사건 응답 이름')).toBeVisible();
    expect(within(table).getByText('이름 미확인')).toBeVisible();
    expect(within(table).queryByText('601')).not.toBeInTheDocument();
    expect(screen.getByText('1–2 / 전체 3건')).toBeVisible();
    const first = lastRequest(urls, '/quality/lot-hold-events');
    expect(first?.searchParams.get('occurredFrom')).toContain('2026-08-01T00:00:00');
    expect(first?.searchParams.get('occurredTo')).toContain('2026-08-08T00:00:00');
    expect(first?.searchParams.get('actorId')).toBe('601');
    expect(first?.searchParams.get('lotNo')).toBe('SAMPLE-LOT-001');
    expect(first?.searchParams.get('sort')).toBe('occurredDesc');

    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(await screen.findByText('3–3 / 전체 3건')).toBeVisible();
    expect(locationSearch().get('historyPage')).toBe('2');
    expect(lastRequest(urls, '/quality/lot-hold-events')?.searchParams.get('page')).toBe('2');
  });

  it('기간 미적용·오류·빈 결과에서도 보류 이력의 한계를 항상 밝힌다', async () => {
    const { unmount } = renderScreen('/quality/lot-status?mode=history', 'ready', holdRoutes());
    expect(screen.getByText(/전체 상태 전이는 기록되지 않습니다/)).toBeVisible();
    expect(screen.getByText('기간을 선택하고 조회하세요')).toBeVisible();
    unmount();

    const failed = renderScreen(
      '/quality/lot-status?mode=history&from=2026-08-01&to=2026-08-07',
      'ready',
      [...holdRoutes(), ...eventRoutes(500)],
    );
    const user = userEvent.setup();
    expect(await screen.findByText('보류 사건 이력을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.getByText(/전체 상태 전이는 기록되지 않습니다/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '보류 사건 이력 다시 시도' }));
    await waitFor(() => expect(requestCount(failed.urls, '/quality/lot-hold-events')).toBe(2));
    failed.unmount();

    renderScreen('/quality/lot-status?mode=history&from=2026-08-01&to=2026-08-07', 'ready', [
      ...holdRoutes(),
      ...eventRoutes(200, true),
    ]);
    expect(await screen.findByText('이 기간의 보류 사건이 없습니다')).toBeVisible();
    expect(screen.getByText('현재 LOT 상태와 일치하지 않아도 오류가 아닙니다.')).toBeVisible();
    expect(screen.getByText(/전체 상태 전이는 기록되지 않습니다/)).toBeVisible();
  });

  it('첫 사건 응답을 기다리는 동안에도 한계와 로딩 상태를 함께 표시한다', () => {
    const baseFetch = fetchFor('ready', holdRoutes());
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?mode=history&from=2026-08-01&to=2026-08-07',
      fetch: async (request) =>
        new URL(request.url).pathname === '/quality/lot-hold-events'
          ? new Promise<Response>(() => undefined)
          : baseFetch(request),
    });

    expect(screen.getByText(/전체 상태 전이는 기록되지 않습니다/)).toBeVisible();
    expect(screen.getByRole('status', { name: '보류 사건 이력을 불러오는 중' })).toBeVisible();
  });

  it('쪽 응답 중 기존 사건·초점을 유지하고 서버 PageMeta로 범위를 계산한다', async () => {
    const urls: URL[] = [];
    const baseFetch = fetchFor('ready', [...holdRoutes(), ...eventRoutes()]);
    let releasePageTwo: (() => void) | undefined;
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?mode=history&from=2026-08-01&to=2026-08-07',
      fetch: async (request) => {
        const url = new URL(request.url);
        urls.push(url);
        if (url.pathname === '/quality/lot-hold-events' && url.searchParams.get('page') === '2') {
          return new Promise<Response>((resolve) => {
            releasePageTwo = () =>
              resolve(
                jsonResponse({
                  items: [
                    {
                      lotHoldId: 803,
                      eventTypeCode: 'HELD',
                      occurredAt: '2026-08-18T08:00:00+09:00',
                      lotId: 403,
                      lotNo: 'SAMPLE-LOT-003',
                      actorId: 603,
                      actorName: '페이지 담당자',
                    },
                  ],
                  page: { page: 2, size: 20, total: 21 },
                }),
              );
          });
        }
        return baseFetch(request);
      },
    });
    const user = userEvent.setup();
    await screen.findByText('1–2 / 전체 3건');
    const next = screen.getByRole('button', { name: '다음 쪽' });

    await user.click(next);
    await waitFor(() => expect(releasePageTwo).toBeDefined());
    expect(next).toHaveFocus();
    expect(screen.getByText('보류 사건 이력을 갱신하는 중입니다.')).toBeVisible();
    expect(
      screen.getByRole('table', { name: '보류 사건 이력' }).closest('[aria-busy]'),
    ).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByText('SAMPLE-LOT-001')).toHaveLength(2);
    releasePageTwo?.();
    expect(await screen.findByText('21–21 / 전체 21건')).toBeVisible();
    expect(screen.getByRole('button', { name: '다음 쪽' })).toBeDisabled();
  });

  it('초기화는 현재 모드 조건·쪽·선택만 지우고 이력 조건은 보존한다', async () => {
    renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL&q=LOT&page=3&lot=404&from=2026-08-01',
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(locationSearch().get('lotType')).toBeNull();
    expect(locationSearch().get('q')).toBeNull();
    expect(locationSearch().get('page')).toBeNull();
    expect(locationSearch().get('lot')).toBeNull();
    expect(locationSearch().get('from')).toBe('2026-08-01');
  });

  it('LOT 유형 기준값이 비어 있으면 필터를 공개하되 조회 사유를 밝힌다', async () => {
    renderScreen('/quality/lot-status', 'empty');

    expect(await screen.findByText('LOT 유형 기준값이 준비되지 않았습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });

  it('LOT 유형 기준값 요청 중에는 조회를 막고 사유를 밝힌다', async () => {
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status',
      fetch: async () => new Promise<Response>(() => undefined),
    });

    expect(await screen.findByText('LOT 유형 기준값을 불러오는 중입니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });

  it('LOT 유형 기준값 요청 실패 시 조회를 막고 사유를 밝힌다', async () => {
    renderScreen('/quality/lot-status', 'error');

    expect(await screen.findByText('LOT 유형 기준값을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });

  it('목록 실패가 요약 카드를 가리지 않는다', async () => {
    const { urls } = renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL',
      'ready',
      qualityRoutes(500),
    );
    const user = userEvent.setup();

    expect(await screen.findByText('LOT 목록을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.getByText('7')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'LOT 목록 다시 시도' }));
    await waitFor(() => expect(requestCount(urls, '/quality/lot-statuses')).toBe(2));
    expect(requestCount(urls, '/quality/lot-status-summary')).toBe(1);
  });

  it('요약 실패가 LOT 목록을 가리지 않는다', async () => {
    const { urls } = renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL',
      'ready',
      qualityRoutes(200, 500),
    );
    const user = userEvent.setup();

    expect(await screen.findByText('현재 상태 요약을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.getByText('SAMPLE-LOT-001')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '현재 상태 요약 다시 시도' }));
    await waitFor(() => expect(requestCount(urls, '/quality/lot-status-summary')).toBe(2));
    expect(requestCount(urls, '/quality/lot-statuses')).toBe(1);
  });

  it.each([
    ['/quality/lot-statuses', 'LOT 목록을 불러오는 중', '기준 시각 2026-08-21 13:00'],
    ['/quality/lot-status-summary', '현재 상태 요약을 불러오는 중', 'SAMPLE-LOT-001'],
  ])('한쪽만 로딩 중이어도 %s 상태를 독립 표시한다', async (pendingPath, label, success) => {
    const resolvedFetch = fetchFor();
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?lotType=SAMPLE_MATERIAL',
      fetch: async (request) =>
        new URL(request.url).pathname === pendingPath
          ? new Promise<Response>(() => undefined)
          : resolvedFetch(request),
    });

    expect(screen.getByRole('status', { name: label })).toBeVisible();
    expect(await screen.findByText(success)).toBeVisible();
  });

  it.each([
    [0, 200, '알 수 없음'],
    [null, 500, '품목 목록 조회 실패'],
  ] as const)(
    '수량 null·품목 fallback·범위 밖 %s에서 내부 ID를 숨긴다',
    async (scope, itemStatus, itemMessage) => {
      renderScreen(
        '/quality/lot-status?lotType=SAMPLE_MATERIAL',
        'ready',
        qualityRoutes(200, 200, [{ ...statusRow, itemId: 999, onHandQty: undefined }], 1, scope),
        itemStatus,
      );

      const table = await screen.findByRole('table', { name: '현재 LOT 상태' });
      expect(within(table).getByText(itemMessage)).toBeVisible();
      expect(within(table).getByText('—')).toBeVisible();
      expect(within(table).queryByText('999')).not.toBeInTheDocument();
      expect(screen.queryByText(/권한 범위 밖 .*건이 제외/)).not.toBeInTheDocument();
    },
  );

  it('품목 목록 로딩 중에도 내부 ID 대신 로딩 상태를 표시한다', async () => {
    const resolvedFetch = fetchFor(
      'ready',
      qualityRoutes(200, 200, [{ ...statusRow, itemId: 999 }]),
    );
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?lotType=SAMPLE_MATERIAL',
      fetch: async (request) =>
        new URL(request.url).pathname === '/mdm/items'
          ? new Promise<Response>(() => undefined)
          : resolvedFetch(request),
    });

    const table = await screen.findByRole('table', { name: '현재 LOT 상태' });
    expect(within(table).getByText('불러오는 중…')).toBeVisible();
    expect(within(table).queryByText('999')).not.toBeInTheDocument();
  });

  it.each([
    [0, null, '조건에 맞는 LOT이 없습니다'],
    [101, '3', '이 쪽에는 결과가 없습니다'],
  ] as const)('빈 목록 total=%i의 사유를 구분한다', async (total, page, message) => {
    const suffix = page === null ? '' : `&page=${page}`;
    const { urls } = renderScreen(
      `/quality/lot-status?lotType=SAMPLE_MATERIAL${suffix}`,
      'ready',
      qualityRoutes(200, 200, [], total),
    );
    expect(await screen.findByText(message)).toBeVisible();
    const listUrl = urls.find(({ pathname }) => pathname === '/quality/lot-statuses');
    expect(listUrl?.searchParams.get('page')).toBe(page);
  });

  it('세 열만 서버 정렬하고 정렬 변경 시 첫 쪽으로 돌아간다', async () => {
    const rows = [
      { ...statusRow, lotId: 401, lotNo: 'SAMPLE-LOT-Z' },
      { ...statusRow, lotId: 402, lotNo: 'SAMPLE-LOT-A' },
    ];
    const { urls } = renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL&sort=itemDesc&page=3',
      'ready',
      qualityRoutes(200, 200, rows, 120),
    );
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: '현재 LOT 상태' });
    const itemHeader = within(table)
      .getAllByRole('columnheader')
      .find((header) => header.textContent === '품목');

    expect(itemHeader).toHaveAttribute('aria-sort', 'descending');
    expect(
      within(table)
        .getAllByRole('button')
        .filter((button) => button.closest('th') !== null)
        .map((button) => button.textContent),
    ).toEqual(['LOT', '품목', '최근 전이']);
    await user.click(within(table).getByRole('button', { name: 'LOT' }));
    await waitFor(() => expect(locationSearch().get('sort')).toBe('lotNoAsc'));
    await waitFor(() => expect(requestCount(urls, '/quality/lot-statuses')).toBe(2));
    expect(locationSearch().get('page')).toBeNull();
    expect(lastRequest(urls, '/quality/lot-statuses')?.searchParams.get('sort')).toBe('lotNoAsc');
    expect(requestCount(urls, '/quality/lot-status-summary')).toBe(1);
    expect(
      within(screen.getByRole('table', { name: '현재 LOT 상태' })).getAllByRole('row')[1],
    ).toHaveTextContent('SAMPLE-LOT-Z');
    await user.click(screen.getByRole('button', { name: 'LOT' }));
    await waitFor(() => expect(locationSearch().get('sort')).toBe('lotNoDesc'));
    await user.click(screen.getByRole('button', { name: 'LOT' }));
    await waitFor(() => expect(locationSearch().get('sort')).toBeNull());
    const latestHeader = screen
      .getAllByRole('columnheader')
      .find((header) => header.textContent === '최근 전이');
    expect(latestHeader).toHaveAttribute('aria-sort', 'descending');
    expect(lastRequest(urls, '/quality/lot-statuses')?.searchParams.get('sort')).toBe(
      'latestTransitionDesc',
    );
    expect(requestCount(urls, '/quality/lot-status-summary')).toBe(1);
  });

  it('이전·다음 쪽 이동을 URL과 목록 요청에만 반영한다', async () => {
    const { urls } = renderScreen('/quality/lot-status?lotType=SAMPLE_MATERIAL');
    const user = userEvent.setup();

    expect(await screen.findByText('1–1 / 전체 101건')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    await waitFor(() => expect(locationSearch().get('page')).toBe('2'));
    expect(lastRequest(urls, '/quality/lot-statuses')?.searchParams.get('page')).toBe('2');
    expect(requestCount(urls, '/quality/lot-status-summary')).toBe(1);
    await user.click(screen.getByRole('button', { name: '이전 쪽' }));
    await waitFor(() => expect(locationSearch().get('page')).toBeNull());
    expect(lastRequest(urls, '/quality/lot-statuses')?.searchParams.get('page')).toBeNull();
  });

  it('URL과 다른 서버 page·size를 쪽 표시와 이동의 정본으로 쓴다', async () => {
    const { urls } = renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL&page=9',
      'ready',
      qualityRoutes(200, 200, [statusRow], 31, 2, { page: 2, size: 20 }),
    );
    const user = userEvent.setup();

    expect(await screen.findByText('21–21 / 전체 31건')).toBeVisible();
    expect(screen.getByRole('button', { name: '다음 쪽' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '이전 쪽' }));
    await waitFor(() => expect(locationSearch().get('page')).toBeNull());
    expect(lastRequest(urls, '/quality/lot-statuses')?.searchParams.get('page')).toBeNull();
  });

  it('쪽 재조회가 지연돼도 기존 표와 현재 초점을 유지한다', async () => {
    const resolvedFetch = fetchFor();
    let releaseNext: (() => void) | undefined;
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?lotType=SAMPLE_MATERIAL',
      fetch: async (request) => {
        const url = new URL(request.url);
        if (url.pathname === '/quality/lot-statuses' && url.searchParams.get('page') === '2') {
          return new Promise<Response>((resolve) => {
            releaseNext = () =>
              resolve(
                jsonResponse({ items: [statusRow], page: { page: 2, size: 50, total: 101 } }),
              );
          });
        }
        return resolvedFetch(request);
      },
    });
    const user = userEvent.setup();

    await screen.findByText('1–1 / 전체 101건');
    const next = screen.getByRole('button', { name: '다음 쪽' });
    await user.click(next);
    await waitFor(() => expect(releaseNext).toBeDefined());
    expect(next).toHaveFocus();
    expect(screen.getByRole('status', { name: 'LOT 목록 갱신 중' })).toBeVisible();
    expect(
      screen.getByRole('table', { name: '현재 LOT 상태' }).closest('[aria-busy]'),
    ).toHaveAttribute('aria-busy', 'true');
    releaseNext?.();
    expect(await screen.findByText('51–51 / 전체 101건')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'LOT 목록 갱신 중' })).not.toBeInTheDocument();
  });

  it('전체 범위 밖 쪽은 첫 쪽 복구 동작을 제공한다', async () => {
    const { urls } = renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL&page=4',
      'ready',
      qualityRoutes(200, 200, [], 101),
    );
    const user = userEvent.setup();

    expect(await screen.findByText('이 쪽에는 결과가 없습니다')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));
    await waitFor(() => expect(locationSearch().get('page')).toBeNull());
    expect(lastRequest(urls, '/quality/lot-statuses')?.searchParams.get('page')).toBeNull();
  });

  it('LOT 선택을 URL에 보존하고 상세 원문을 표시한다', async () => {
    renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL&page=3&sort=lotNoAsc&from=2026-08-01',
      'ready',
      [...qualityRoutes(), ...detailRoutes()],
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'SAMPLE-LOT-001 상세 보기' }));
    await waitFor(() => expect(locationSearch().get('lot')).toBe('401'));
    expect(locationSearch().get('sort')).toBe('lotNoAsc');
    expect(locationSearch().get('from')).toBe('2026-08-01');

    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });
    expect(within(dialog).getByText('합성 자재')).toBeVisible();
    expect(within(dialog).getByText('합성 불량')).toBeVisible();
    expect(within(dialog).getByText('SAMPLE-ITEM-01 · 합성 품목 (미사용)')).toBeVisible();
    expect(within(dialog).getByText('SAMPLE-LOT-001')).toBeVisible();
    expect(within(dialog).getByText('120')).toBeVisible();
    expect(within(dialog).getByText('2027-08-20')).toBeVisible();
    expect(within(dialog).getByText('2026-08-20 08:30')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '판정·전이 처리' })).toBeDisabled();
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/W-03-03 화면에서 진행/)).toBeVisible();

    const close = within(dialog).getAllByRole('button', { name: '닫기' }).at(-1);
    if (close === undefined) throw new Error('닫기 버튼이 없습니다.');
    await user.click(close);
    await waitFor(() => expect(locationSearch().get('lot')).toBeNull());
    expect(locationSearch().get('page')).toBe('3');
    expect(locationSearch().get('from')).toBe('2026-08-01');
  });

  it('상세 참조·날짜가 없을 때 내부 ID를 숨기고 원문 경계를 보존한다', async () => {
    renderScreen(
      '/quality/lot-status?lot=401',
      'ready',
      detailRoutes(200, {
        itemId: 999,
        lotTypeCode: 'SAMPLE_UNKNOWN_TYPE',
        statusCode: 'SAMPLE_UNKNOWN_STATUS',
        expiryDate: null,
        manufacturedAt: null,
      }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });
    expect(await within(dialog).findByText('알 수 없음')).toBeVisible();
    expect(within(dialog).queryByText('999')).not.toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE_UNKNOWN_TYPE (목록 미확정)')).toBeVisible();
    expect(within(dialog).getByText('SAMPLE_UNKNOWN_STATUS (목록 미확정)')).toBeVisible();
    expect(within(dialog).getAllByText('—')).toHaveLength(2);
  });

  it('상세가 품목 목록보다 먼저 오면 알 수 없음 대신 로딩 상태를 보인다', async () => {
    const resolvedFetch = fetchFor('ready', detailRoutes());
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?lot=401',
      fetch: async (request) =>
        new URL(request.url).pathname === '/mdm/items'
          ? new Promise<Response>(() => undefined)
          : resolvedFetch(request),
    });

    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });
    expect(await within(dialog).findByText('이름 불러오는 중')).toBeVisible();
    expect(within(dialog).queryByText('103')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('알 수 없음')).not.toBeInTheDocument();
  });

  it('주소로 고른 LOT 상세의 실패·재시도를 처리한다', async () => {
    const { urls } = renderScreen('/quality/lot-status?lot=401', 'ready', [
      ...detailRoutes(500),
      ...holdRoutes(),
    ]);
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });
    expect(await within(dialog).findByText('LOT 상세를 불러오지 못했습니다.')).toBeVisible();
    expect(await within(dialog).findByRole('table', { name: '보류 문서' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'LOT 상세 다시 시도' }));
    await waitFor(() => expect(requestCount(urls, '/trace/lots/401')).toBe(2));
    expect(requestCount(urls, '/quality/lot-holds')).toBe(1);
  });

  it('열린·해제 보류 문서를 5열 서버 페이지로 이동한다', async () => {
    const { urls } = renderScreen('/quality/lot-status?lot=401', 'ready', [
      ...detailRoutes(),
      ...holdRoutes(),
    ]);
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });
    const holds = await within(dialog).findByRole('table', { name: '보류 문서' });

    expect(within(dialog).getByText(/전체 상태 전이는 기록되지 않습니다/)).toBeVisible();
    expect(within(holds).getAllByRole('columnheader')).toHaveLength(5);
    expect(within(holds).getByText('보류 건 상태')).toBeVisible();
    expect(within(holds).getByText('SAMPLE_OPEN')).toBeVisible();
    expect(within(holds).getByText('SAMPLE_RELEASED')).toBeVisible();
    expect(within(holds).getByText('전량')).toBeVisible();
    expect(within(holds).getByText('0')).toBeVisible();
    expect(within(holds).getAllByText('합성 등록자')).toHaveLength(2);
    expect(within(holds).getByText('합성 해제자')).toBeVisible();
    expect(within(dialog).getByText('1–2 / 전체 51건')).toBeVisible();
    expect(lastRequest(urls, '/quality/lot-holds')?.searchParams.get('open')).toBe('false');
    expect(lastRequest(urls, '/app/users')?.searchParams.get('includeInactive')).toBe('true');

    await user.click(within(dialog).getByRole('button', { name: '다음 쪽' }));
    expect(await within(dialog).findByText('51–51 / 전체 51건')).toBeVisible();
    expect(lastRequest(urls, '/quality/lot-holds')?.searchParams.get('page')).toBe('2');
    expect(requestCount(urls, '/trace/lots/401')).toBe(1);
  });

  it('쪽 응답 중 기존 표·초점을 유지하고 서버 PageMeta로 로컬 쪽을 맞춘다', async () => {
    const urls: URL[] = [];
    const baseFetch = fetchFor('ready', [...detailRoutes(), ...holdRoutes()]);
    const serverPage = () =>
      jsonResponse({
        items: [
          {
            lotHoldId: 704,
            lotId: 401,
            reasonCode: 'SAMPLE_SERVER_META',
            statusCode: 'SAMPLE_OPEN',
            heldAt: '2026-08-17T09:00:00+09:00',
          },
        ],
        page: { page: 3, size: 20, total: 41 },
      });
    let releasePageTwo: (() => void) | undefined;
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?lot=401',
      fetch: async (request) => {
        const url = new URL(request.url);
        urls.push(url);
        if (url.pathname === '/quality/lot-holds' && url.searchParams.get('page') === '3') {
          return serverPage();
        }
        if (url.pathname === '/quality/lot-holds' && url.searchParams.get('page') === '2') {
          return new Promise<Response>((resolve) => {
            releasePageTwo = () => resolve(serverPage());
          });
        }
        return baseFetch(request);
      },
    });
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });
    await within(dialog).findByText('1–2 / 전체 51건');
    const next = within(dialog).getByRole('button', { name: '다음 쪽' });

    await user.click(next);
    await waitFor(() => expect(releasePageTwo).toBeDefined());
    expect(next).toHaveFocus();
    expect(within(dialog).getByText('보류 문서를 갱신하는 중입니다.')).toBeVisible();
    expect(
      within(dialog).getByRole('table', { name: '보류 문서' }).closest('[aria-busy]'),
    ).toHaveAttribute('aria-busy', 'true');
    expect(within(dialog).getByText('1–2 / 전체 51건')).toBeVisible();
    releasePageTwo?.();
    await waitFor(() =>
      expect(lastRequest(urls, '/quality/lot-holds')?.searchParams.get('page')).toBe('3'),
    );
    expect(within(dialog).getByText('41–41 / 전체 41건')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '다음 쪽' })).toBeDisabled();
  });

  it('보류 문서 실패와 재시도를 LOT 상세와 독립 처리한다', async () => {
    const { urls } = renderScreen('/quality/lot-status?lot=401', 'ready', [
      ...detailRoutes(),
      ...holdRoutes(500),
    ]);
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });

    expect(await within(dialog).findByText('보류 문서를 불러오지 못했습니다.')).toBeVisible();
    expect(within(dialog).getByText('SAMPLE-LOT-001')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '보류 문서 다시 시도' }));
    await waitFor(() => expect(requestCount(urls, '/quality/lot-holds')).toBe(2));
    expect(requestCount(urls, '/trace/lots/401')).toBe(1);
  });

  it('행위자 조회 실패가 문서를 가리지 않고 사용자 번호 fallback을 밝힌다', async () => {
    renderScreen('/quality/lot-status?lot=401', 'ready', [
      ...detailRoutes(),
      ...holdRoutes(200, 500),
    ]);
    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });

    expect(await within(dialog).findByText(/사용자 번호를 표시합니다/)).toBeVisible();
    expect(within(dialog).getByRole('table', { name: '보류 문서' })).toHaveTextContent('601');
  });

  it('행위자 목록이 잘렸음을 이름이 없는 번호 fallback과 함께 밝힌다', async () => {
    renderScreen('/quality/lot-status?lot=401', 'ready', [
      ...detailRoutes(),
      ...holdRoutes(200, 200, 3),
    ]);
    const dialog = await screen.findByRole('dialog', { name: 'LOT 상세' });

    expect(await within(dialog).findByText(/일부 행위자 이름을 확인하지 못해/)).toBeVisible();
    expect(within(dialog).getByRole('table', { name: '보류 문서' })).toBeVisible();
  });
});

import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopHomeScreen } from './screen';

const t = messages.popChrome.home;

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '합성 단말',
  scopes: [{ businessUnitId: 1001 }],
  permissions: ['P-02-01', 'P-02-04', 'P-04-01', 'P-05-02'],
};

const Here = () => {
  const { pathname, state } = useLocation();
  return (
    <>
      <p>지금: {pathname}</p>
      {state !== null && <p>넘긴 것: {JSON.stringify(state)}</p>}
    </>
  );
};

const EQUIPMENT = { equipmentId: 31, equipmentCode: 'EQ-31', equipmentName: '조립 1호기' };

/** 상태별 W/O 수 — `/production/work-orders` 가 `page.total` 로 답한다. */
const TOTALS: Record<string, number> = { IN_PROGRESS: 1, RELEASED: 5, 'COMPLETED,CLOSED': 3 };

const NEXT = {
  workOrderId: 77,
  workOrderNo: 'WO-20261117-0003',
  itemId: 9,
  itemCode: 'FG-COVER',
  orderQty: 200,
};

const setup = (
  counts: Record<string, number>,
  equipment: typeof EQUIPMENT | null = null,
  workOrderQueries: URL[] = [],
  terminalId: number | null = null,
) =>
  renderWithProviders(
    <PopIdentityProvider
      value={{ ...UNKNOWN_POP_IDENTITY, terminalId, workerNo: '2048', equipment }}
    >
      <PopHomeScreen />
      <Here />
    </PopIdentityProvider>,
    {
      fetch: createStubFetch([
        {
          match: (request) => request.url.endsWith('/app/sessions/current'),
          respond: () => jsonResponse(SESSION),
        },
        {
          match: (request) => new URL(request.url).pathname === '/production/work-orders',
          respond: (request) => {
            const url = new URL(request.url);
            workOrderQueries.push(url);
            const status = url.searchParams.get('statusCode') ?? '';
            return jsonResponse({
              items: status === 'RELEASED' ? [NEXT] : [],
              page: { page: 1, size: 1, total: TOTALS[status] ?? 0 },
            });
          },
        },
        {
          match: (request) => new URL(request.url).pathname === '/app/terminal-work-counts',
          respond: () =>
            jsonResponse({
              shipmentPacking: 0,
              workStart: 0,
              emergencyWorkOrder: 0,
              reworkResult: 0,
              oqcInspection: 0,
              ...counts,
            }),
        },
      ]),
      route: '/pop/home',
    },
  );

afterEach(() => {
  window.localStorage.clear();
});

describe('PopHomeScreen — 홈(#291)', () => {
  it('인사, 남은 작업, 이 단말이 갈 수 있는 바로가기만 보인다', async () => {
    setup({ shipmentPacking: 4, workStart: 3 });

    expect(screen.getByRole('heading', { name: t.greeting('2048') })).toBeInTheDocument();
    const remaining = await within(
      screen.getByRole('region', { name: new RegExp(`^${t.remainingTitle}`, 'u') }),
    ).findByRole('button', { name: messages.popChrome.remaining.count('출하 포장', 4) });
    expect(remaining).toHaveTextContent(t.remainingCount(4));

    const shortcuts = within(screen.getByRole('region', { name: t.shortcutsTitle }));
    expect(
      shortcuts
        .getAllByRole('button')
        .filter((button) => button.classList.contains('home-tile'))
        .map((tile) => tile.querySelector('.name')?.textContent),
    ).toEqual(['생산 작업', '작업지시 목록', '출하 포장']);
  });

  it('남은 작업·바로가기를 누르면 그 화면으로 간다', async () => {
    const user = userEvent.setup();
    setup({ workStart: 3 });

    await user.click(
      await within(
        screen.getByRole('region', { name: new RegExp(`^${t.remainingTitle}`, 'u') }),
      ).findByRole('button', { name: messages.popChrome.remaining.count('작업지시 목록', 3) }),
    );
    expect(screen.getByText('지금: /pop/work-start')).toBeInTheDocument();
  });

  it('사번을 모르면 사번 입력 화면으로 보낸다', async () => {
    renderWithProviders(
      <PopIdentityProvider value={UNKNOWN_POP_IDENTITY}>
        <PopHomeScreen />
        <Here />
      </PopIdentityProvider>,
      { fetch: createStubFetch([]), route: '/pop/home' },
    );

    expect(await screen.findByText('지금: /pop/worker-assignment')).toBeInTheDocument();
  });

  it('남은 작업이 없으면 그렇게 말한다', async () => {
    setup({});

    await waitFor(() => {
      expect(screen.getByRole('region', { name: t.shortcutsTitle })).toBeInTheDocument();
    });
    expect(screen.getByText(t.remainingNone)).toBeInTheDocument();
  });

  it('오늘 작업 현황 — 이 단말 설비의 진행 중·대기·완료 수와 다음 작업을 보인다', async () => {
    const user = userEvent.setup();
    const queries: URL[] = [];
    setup({}, EQUIPMENT, queries);

    const card = within(await screen.findByRole('region', { name: t.statusTitle }));
    expect(await card.findByText(t.statusCount(5))).toBeInTheDocument();
    expect(card.getByText(t.statusCount(1))).toBeInTheDocument();
    expect(card.getByText(t.statusCount(3))).toBeInTheDocument();
    expect(card.getByText(NEXT.workOrderNo)).toBeInTheDocument();
    expect(card.getByText(t.nextPlan('FG-COVER', '200'))).toBeInTheDocument();

    /*
     * 진행·대기는 작업지시 목록과 같은 조건(open)·설비 축으로, 완료는 오늘 0시 이후 갱신분(updatedSince)으로
     * 묻는다 — POP 단말은 그 두 길로만 목록을 읽는다(서버 단말 읽기 규칙 · #291).
     */
    expect(queries.map((url) => url.searchParams.get('statusCode')).sort()).toEqual([
      'COMPLETED,CLOSED',
      'IN_PROGRESS',
      'RELEASED',
    ]);
    for (const url of queries) {
      const done = url.searchParams.get('statusCode') === 'COMPLETED,CLOSED';
      expect(url.searchParams.get('open')).toBe(done ? null : 'true');
      if (done) expect(url.searchParams.get('updatedSince')).not.toBeNull();
      expect(url.searchParams.get('plannedEquipmentId')).toBe('31');
      expect(url.searchParams.get('includeUnplannedEquipment')).toBe('true');
    }

    /* 다음 작업을 누르면 그 W/O 를 고른 채로 작업지시 목록을 연다 — 홈에서 보던 설비 범위(지정 설비)와 함께. */
    await user.click(card.getByRole('button', { name: new RegExp(NEXT.workOrderNo, 'u') }));
    expect(screen.getByText('지금: /pop/work-start')).toBeInTheDocument();
    expect(
      screen.getByText(
        `넘긴 것: ${JSON.stringify({ workOrderId: NEXT.workOrderId, allEquipment: false })}`,
      ),
    ).toBeInTheDocument();
  });

  it('설비가 지정된 단말은 [전체 설비]로 바꿔 전체를 셀 수 있다', async () => {
    const user = userEvent.setup();
    const queries: URL[] = [];
    setup({}, EQUIPMENT, queries, 7);

    const toggle = within(await screen.findByRole('tablist', { name: t.statusScopeLabel }));
    expect(toggle.getByRole('tab', { name: t.statusMyEquipment('조립 1호기') })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(queries).toHaveLength(3));

    await user.click(toggle.getByRole('tab', { name: t.statusEveryEquipment }));
    await waitFor(() => expect(queries).toHaveLength(6));
    for (const url of queries.slice(3)) {
      expect(url.searchParams.get('plannedEquipmentId')).toBeNull();
    }
  });

  it('단말에 설비가 없으면 전체 설비로 세고 그렇다고 적는다', async () => {
    const queries: URL[] = [];
    setup({}, null, queries, 7);

    const card = within(
      await screen.findByRole('region', { name: new RegExp(t.statusTitle, 'u') }),
    );
    expect(card.getByText(t.statusAllEquipment)).toBeInTheDocument();
    expect(await card.findByText(t.statusCount(5))).toBeInTheDocument();
    for (const url of queries) {
      expect(url.searchParams.get('plannedEquipmentId')).toBeNull();
    }
  });

  it('[편집]으로 바로가기를 빼고 넣으면 단말에 남고, [기본으로] 되돌린다', async () => {
    const user = userEvent.setup();
    /* 비가동 실적 입력은 설비가 지정된 단말에만 선다(#291) — 그래서 설비를 준다. */
    setup({}, EQUIPMENT);

    const shortcuts = () =>
      within(screen.getByRole('region', { name: new RegExp(t.shortcutsTitle, 'u') }));
    const tileNames = () =>
      shortcuts()
        .getAllByRole('button')
        .filter((button) => button.classList.contains('home-tile'))
        .map((tile) => tile.querySelector('.name')?.textContent);

    await waitFor(() => {
      expect(tileNames()).toEqual(['생산 작업', '작업지시 목록', '출하 포장']);
    });

    await user.click(shortcuts().getByRole('button', { name: t.edit }));
    await user.click(shortcuts().getByRole('button', { name: t.editPicked('생산 작업') }));
    await user.click(shortcuts().getByRole('button', { name: '비가동 실적 입력' }));
    await user.click(shortcuts().getByRole('button', { name: t.editDone }));

    expect(tileNames()).toEqual(['작업지시 목록', '출하 포장', '비가동 실적 입력']);
    expect(JSON.parse(window.localStorage.getItem('omf.pop.home.shortcuts') ?? 'null')).toEqual([
      '/pop/work-start',
      '/pop/packing',
      '/pop/downtime',
    ]);

    await user.click(shortcuts().getByRole('button', { name: t.edit }));
    await user.click(shortcuts().getByRole('button', { name: t.editReset }));
    await user.click(shortcuts().getByRole('button', { name: t.editDone }));
    expect(tileNames()).toEqual(['생산 작업', '작업지시 목록', '출하 포장']);
    expect(window.localStorage.getItem('omf.pop.home.shortcuts')).toBeNull();
  });
});

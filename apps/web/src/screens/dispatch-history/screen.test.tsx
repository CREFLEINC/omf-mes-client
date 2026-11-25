import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { defaultPeriod, toPeriodQuery, validatePeriod } from './period';
import { DispatchHistoryScreen } from './screen';
import type { Delivery as ZaloDelivery, Dispatch as NotificationDispatch } from './types';

const t = messages.dispatchHistory;

const dispatch = (
  id: number,
  overrides: Partial<NotificationDispatch> = {},
): NotificationDispatch => ({
  notificationEventId: id,
  eventCode: 'WORK_ORDER_CLOSED',
  occurredAt: '2026-10-21T07:10:00Z',
  departmentId: 7,
  departmentName: '생산1팀',
  targetTypeCode: 'WORK_ORDER',
  targetId: 501,
  targetLabel: 'WO-20261021-001',
  dispatchStatus: 'NOTIFIED',
  skipReasonCode: null,
  notificationCount: 3,
  zalo: { pending: 0, sent: 2, failed: 1, expired: 0, skippedNoPhone: 0 },
  ...overrides,
});

const delivery = (id: number, overrides: Partial<ZaloDelivery> = {}): ZaloDelivery => ({
  zaloDeliveryId: id,
  notificationEventId: 9001,
  eventCode: 'WORK_ORDER_CLOSED',
  occurredAt: '2026-10-21T07:10:00Z',
  departmentName: '생산1팀',
  targetLabel: 'WO-20261021-001',
  recipientUserId: 41,
  recipientName: `수신자 ${String(id)}`,
  phoneMasked: '091*****78',
  status: 'SENT',
  attemptCount: 1,
  lastErrorCode: null,
  lastErrorMessage: null,
  sentAt: '2026-10-21T07:10:20Z',
  trackingId: `ne9001-u41-${String(id)}`,
  ...overrides,
});

const ROUTE = '/notification/dispatch-history?from=2026-10-15&to=2026-10-21';

const setup = (
  options: {
    route?: string;
    dispatches?: NotificationDispatch[];
    deliveries?: ZaloDelivery[];
  } = {},
) => {
  const dispatchQueries: URL[] = [];
  /* 위 줄 결과 칩의 건수 조회(한 줄만 · size=1) — 목록 조회와 따로 모은다. */
  const countQueries: URL[] = [];
  const deliveryQueries: URL[] = [];
  const items = options.dispatches ?? [dispatch(9001)];
  renderWithProviders(<DispatchHistoryScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/app/notification-dispatches',
        respond: (request) => {
          const url = new URL(request.url);
          if (url.searchParams.get('size') === '1') {
            countQueries.push(url);
            const status = url.searchParams.get('status');
            const total = items.filter((item) => item.dispatchStatus === status).length;
            return jsonResponse({ items: [], page: { page: 1, size: 1, total } });
          }
          dispatchQueries.push(url);
          return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/app/zalo-deliveries',
        respond: (request) => {
          const url = new URL(request.url);
          deliveryQueries.push(url);
          /* 계약대로 기간이 없으면 400 — 스텁이 서버보다 너그러우면 화면의 결손을 덮는다. */
          if (!url.searchParams.has('from') || !url.searchParams.has('to')) {
            return jsonResponse(
              { code: 'REQUIRED', message: '기간이 필요합니다' },
              { status: 400 },
            );
          }
          const rows = options.deliveries ?? [delivery(1)];
          return jsonResponse({ items: rows, page: { page: 1, size: 200, total: rows.length } });
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/app/notification-events',
        respond: () =>
          jsonResponse({
            items: [
              { eventCode: 'WORK_ORDER_CLOSED', eventName: '생산 마감' },
              { eventCode: 'WORK_SESSION_STOPPED', eventName: '생산 중단' },
            ],
          }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/departments',
        respond: () =>
          jsonResponse({
            items: [
              {
                departmentId: 7,
                departmentCode: 'D-PRD1',
                departmentName: '생산1팀',
                parentDepartmentId: null,
                businessUnitId: null,
                isActive: true,
              },
            ],
            page: { page: 1, size: 100, total: 1 },
          }),
      },
    ]),
    route: options.route ?? ROUTE,
  });
  return { dispatchQueries, countQueries, deliveryQueries };
};

/* 조회 조건 · 목록 · 상세 통일 배치(#358) — 목록 상자 「처리 결과 목록」, 상세 상자는 고른 건의 대상 이름. */
const dispatchPane = () => within(screen.getByRole('region', { name: t.workspace.list }));
const deliveryPane = () => within(screen.getByRole('region', { name: t.panes.deliveries }));
/* 위 줄 오른쪽 결과 칩 묶음(#358 — 종전 「결과 선택」 칸 자리). */
const resultChips = () => within(screen.getByRole('group', { name: t.filters.result }));
/* 고른 줄 — 다른 목록 | 상세 화면처럼 줄 안 고르는 단추의 aria-current 로 짚는다. */
const isPicked = (row: HTMLElement): boolean =>
  row.querySelector('.users-roles-row-pick[aria-current="true"]') !== null;

describe('period', () => {
  it('31일까지는 조회할 수 있고 넘으면 막는다', () => {
    expect(validatePeriod({ from: '2026-10-01', to: '2026-10-31' })).toBeNull();
    expect(validatePeriod({ from: '2026-10-01', to: '2026-11-01' })).toBe(t.errors.periodTooLong);
    expect(validatePeriod({ from: '2026-10-21', to: '2026-10-20' })).toBe(t.errors.periodReversed);
    expect(validatePeriod({ from: '', to: '2026-10-20' })).toBe(t.errors.periodRequired);
  });

  it('끝은 다음 날 0시다 — 월말·연말도 넘긴다', () => {
    expect(toPeriodQuery({ from: '2026-12-25', to: '2026-12-31' }, 420)).toEqual({
      from: '2026-12-25T00:00:00+07:00',
      to: '2027-01-01T00:00:00+07:00',
    });
  });

  it('기본 기간은 오늘을 포함한 7일이다', () => {
    expect(defaultPeriod(new Date(2026, 9, 21))).toEqual({ from: '2026-10-15', to: '2026-10-21' });
  });
});

describe('DispatchHistoryScreen', () => {
  it('US8-1 이벤트·부서·대상·결과·알림 수·Zalo 집계를 보인다', async () => {
    setup();

    const row = (await dispatchPane().findByText('WO-20261021-001')).closest('tr') as HTMLElement;
    expect(within(row).getByText('생산 마감')).toBeInTheDocument();
    expect(within(row).getByText('생산1팀')).toBeInTheDocument();
    expect(within(row).getByText(t.results.NOTIFIED)).toBeInTheDocument();
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText(t.zaloSummary(2, 1, 0, 0, 0))).toBeInTheDocument();
  });

  it('US8-3 알리지 않은 이유를 이벤트 단위 문구로 보인다', async () => {
    setup({
      dispatches: [
        dispatch(9002, {
          dispatchStatus: 'SKIPPED',
          skipReasonCode: 'EVENT_DISABLED',
          notificationCount: 0,
        }),
        dispatch(9003, {
          dispatchStatus: 'SKIPPED',
          skipReasonCode: 'DEPARTMENT_UNRESOLVED',
          departmentId: null,
          departmentName: null,
          notificationCount: 0,
        }),
      ],
    });

    expect(
      await dispatchPane().findByText(t.skipped(t.skipReasons.EVENT_DISABLED)),
    ).toBeInTheDocument();
    expect(
      dispatchPane().getByText(t.skipped(t.skipReasons.DEPARTMENT_UNRESOLVED)),
    ).toBeInTheDocument();
  });

  it('조건은 주소에서 읽어 RFC3339 기간과 함께 쿼리로 보낸다', async () => {
    const { dispatchQueries } = setup({
      route: `${ROUTE}&event=WORK_ORDER_CLOSED&dept=7&result=SKIPPED&page=2`,
    });

    await waitFor(() => expect(dispatchQueries.length).toBeGreaterThan(0));
    const params = (dispatchQueries.at(-1) as URL).searchParams;
    expect(params.get('from')).toMatch(/^2026-10-15T00:00:00[+-]\d{2}:\d{2}$/);
    /* 서버는 [from, to) — 끝은 마지막 날 다음 날 0시다. */
    expect(params.get('to')).toMatch(/^2026-10-22T00:00:00[+-]\d{2}:\d{2}$/);
    expect(params.get('eventCode')).toBe('WORK_ORDER_CLOSED');
    expect(params.get('departmentId')).toBe('7');
    expect(params.get('status')).toBe('SKIPPED');
    expect(params.get('page')).toBe('2');
  });

  it('결과는 위 줄 칩으로 거른다 — 누르면 그 결과로 곧바로 다시 부르고, 다시 누르면 전체로 돌아간다(#358)', async () => {
    const user = userEvent.setup();
    const { dispatchQueries } = setup({
      dispatches: [
        dispatch(9001),
        dispatch(9002, { dispatchStatus: 'SKIPPED', skipReasonCode: 'EVENT_DISABLED' }),
      ],
    });

    await dispatchPane().findByText(t.skipped(t.skipReasons.EVENT_DISABLED));
    /* 조회 상자에는 결과 칸이 없다. */
    expect(screen.queryByRole('combobox', { name: /결과/ })).toBeNull();
    const skipped = await resultChips().findByRole('button', {
      name: messages.common.inspectionHub.count(t.results.SKIPPED, 1),
    });
    await user.click(skipped);

    await waitFor(() =>
      expect((dispatchQueries.at(-1) as URL).searchParams.get('status')).toBe('SKIPPED'),
    );
    expect(skipped).toHaveAttribute('aria-pressed', 'true');

    await user.click(skipped);
    await waitFor(() =>
      expect((dispatchQueries.at(-1) as URL).searchParams.get('status')).toBeNull(),
    );
  });

  it('결과 칩 건수는 결과만 빼고 지금 걸린 조건으로 세고(「건」 없이), 0건 칩은 걸린 칩이 아니면 감춘다(#358)', async () => {
    const { countQueries } = setup({ route: `${ROUTE}&event=WORK_ORDER_CLOSED&dept=7` });

    expect(
      await resultChips().findByRole('button', {
        name: messages.common.inspectionHub.count(t.results.NOTIFIED, 1),
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(countQueries).toHaveLength(2));
    for (const url of countQueries) {
      expect(url.searchParams.get('eventCode')).toBe('WORK_ORDER_CLOSED');
      expect(url.searchParams.get('departmentId')).toBe('7');
      expect(url.searchParams.get('from')).toMatch(/^2026-10-15T00:00:00[+-]\d{2}:\d{2}$/);
    }
    expect(countQueries.map((url) => url.searchParams.get('status')).sort()).toEqual([
      'NOTIFIED',
      'SKIPPED',
    ]);
    /* 발송 생략 0건 — 감춘다. */
    expect(resultChips().queryByRole('button', { name: new RegExp(t.results.SKIPPED) })).toBeNull();
  });

  it('주소에 걸린 결과는 0건이어도 칩이 남아 눌러 풀 수 있다(#358)', async () => {
    const user = userEvent.setup();
    const { dispatchQueries } = setup({ route: `${ROUTE}&result=SKIPPED` });

    const skipped = await resultChips().findByRole('button', {
      name: messages.common.inspectionHub.count(t.results.SKIPPED, 0),
    });
    expect(skipped).toHaveAttribute('aria-pressed', 'true');
    await user.click(skipped);

    await waitFor(() =>
      expect((dispatchQueries.at(-1) as URL).searchParams.get('status')).toBeNull(),
    );
  });

  it('31일을 넘는 기간은 조회하지 않고 그 사유를 보인다', async () => {
    const { dispatchQueries } = setup({
      route: '/notification/dispatch-history?from=2026-09-01&to=2026-10-21',
    });

    expect(await dispatchPane().findByText(t.errors.periodTooLong)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.filters.search })).toBeDisabled();
    expect(dispatchQueries).toHaveLength(0);
  });

  it('기간은 날짜 선택 부품으로 고르고, 기간 오류로 잠긴 [조회]는 그 사유를 가리킨다(#189 C-12·C-4)', async () => {
    setup({ route: '/notification/dispatch-history?from=2026-09-01&to=2026-10-21' });

    await dispatchPane().findByText(t.errors.periodTooLong);
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByLabelText(messages.common.startDate)).toBeInTheDocument();
    expect(screen.getByLabelText(messages.common.endDate)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.filters.search })).toHaveAccessibleDescription(
      t.errors.periodTooLong,
    );
  });

  it('부서 선택지는 「이름 (코드)」, Zalo 집계는 쉼표로 나열한다(#189 C-13)', async () => {
    const user = userEvent.setup();
    setup();

    await dispatchPane().findByText('WO-20261021-001');
    expect(t.zaloSummary(2, 1, 0, 0, 3)).toBe('성공 2, 실패 1, 대기 0, 만료 0, 번호없음 3');
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    await user.click(screen.getByRole('combobox', { name: t.filters.departmentSelect }));
    expect(await screen.findByRole('option', { name: '생산1팀 (D-PRD1)' })).toBeInTheDocument();
  });

  /* 보이는 조건은 둘(C-6) — 부서는 접혀 있고, 걸려 있으면 칩이 알린다. 결과는 위 줄 칩이 거른다. */
  it('부서는 조건 더보기에 접히고, 걸린 부서는 칩으로 보이며 × 가 그 조건만 풀어 다시 조회한다', async () => {
    const user = userEvent.setup();
    const { dispatchQueries } = setup({ route: `${ROUTE}&dept=7&result=SKIPPED` });

    await dispatchPane().findByText('WO-20261021-001');
    expect(screen.queryByRole('combobox', { name: t.filters.departmentSelect })).toBeNull();
    expect(await screen.findByText(t.filters.chipDepartment('생산1팀 (D-PRD1)'))).toBeVisible();
    expect(screen.getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(1);

    await user.click(
      screen.getByRole('button', {
        name: messages.common.filterMore.remove(t.filters.department),
      }),
    );

    await waitFor(() =>
      expect((dispatchQueries.at(-1) as URL).searchParams.get('departmentId')).toBeNull(),
    );
    expect((dispatchQueries.at(-1) as URL).searchParams.get('status')).toBe('SKIPPED');
  });

  it('US8-1 행을 고르면 기간과 함께 Zalo 발송 상세를 부르고 SENDING 을 「대기」로 보인다', async () => {
    const user = userEvent.setup();
    const { deliveryQueries } = setup({
      deliveries: [
        delivery(1),
        delivery(2, { status: 'SENDING', sentAt: null }),
        delivery(3, { status: 'FAILED', lastErrorCode: '-108', lastErrorMessage: '전화번호 오류' }),
      ],
    });

    /* 고르기 전에는 상세 상자가 「알림 건을 선택하세요.」 빈 상태다(#358). */
    await dispatchPane().findByText('WO-20261021-001');
    expect(screen.getByText(t.workspace.selectTitle)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.panes.deliveries })).toBeNull();
    await user.click(dispatchPane().getByText('WO-20261021-001'));

    await waitFor(() =>
      expect(deliveryQueries.at(-1)?.searchParams.get('notificationEventId')).toBe('9001'),
    );
    /* 서버가 기간을 필수로 받는다 — 목록에 적용된 기간을 그대로 싣는다. */
    const deliveryParams = (deliveryQueries.at(-1) as URL).searchParams;
    expect(deliveryParams.get('from')).toMatch(/^2026-10-15T00:00:00[+-]\d{2}:\d{2}$/);
    expect(deliveryParams.get('to')).toMatch(/^2026-10-22T00:00:00[+-]\d{2}:\d{2}$/);
    const sending = (await deliveryPane().findByText('수신자 2')).closest('tr') as HTMLElement;
    expect(within(sending).getByText(t.deliveryStatus.PENDING)).toBeInTheDocument();
    expect(deliveryPane().getByText('-108 전화번호 오류')).toBeInTheDocument();
    expect(deliveryPane().getAllByText('091*****78')).toHaveLength(3);
  });

  it('Zalo 상세 상태 필터는 「대기」로 PENDING·SENDING 을 함께 거른다', async () => {
    const user = userEvent.setup();
    setup({
      route: `${ROUTE}&selected=9001`,
      deliveries: [
        delivery(1),
        delivery(2, { status: 'SENDING' }),
        delivery(3, { status: 'PENDING' }),
      ],
    });

    await deliveryPane().findByText('수신자 1');
    await user.click(deliveryPane().getByRole('combobox', { name: t.filters.deliveryStatus }));
    await user.click(await screen.findByRole('option', { name: t.deliveryStatus.PENDING }));

    expect(deliveryPane().queryByText('수신자 1')).toBeNull();
    expect(deliveryPane().getByText('수신자 2')).toBeInTheDocument();
    expect(deliveryPane().getByText('수신자 3')).toBeInTheDocument();
  });

  /** 상세 머리가 어느 건의 상세인지 말한다(종전 드로어 머리 · #183 → 상세 상자 · #358). */
  it('행을 고르면 오른쪽 상세 상자 제목에 대상, 요약 상자에 이벤트·발생 시각을 보이고 행을 선택으로 표시한다', async () => {
    const user = userEvent.setup();
    setup({ dispatches: [dispatch(9001), dispatch(9002, { targetLabel: 'WO-20261021-002' })] });

    await user.click(await dispatchPane().findByText('WO-20261021-002'));

    const detail = await screen.findByRole('region', { name: 'WO-20261021-002' });
    expect(within(detail).getByRole('heading', { name: 'WO-20261021-002' })).toBeInTheDocument();
    /* 요약 상자 — 「이름 위 · 값 아래」 쌍(다른 화면 상세와 같다 · #358). */
    const fact = (label: string) =>
      within(detail).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;
    expect(fact(t.columns.event)).toHaveTextContent('생산 마감');
    expect(fact(t.columns.occurredAt).textContent).toMatch(/^2026-10-21 /);
    expect(within(detail).getByRole('heading', { name: t.panes.deliveries })).toBeInTheDocument();
    const row = dispatchPane().getByText('WO-20261021-002').closest('tr') as HTMLElement;
    expect(isPicked(row)).toBe(true);
    expect(isPicked(dispatchPane().getByText('WO-20261021-001').closest('tr') as HTMLElement)).toBe(
      false,
    );
  });

  it('고른 행을 한 번 더 누르면 선택이 풀리고 상세 상자가 닫힌다', async () => {
    const user = userEvent.setup();
    setup({ dispatches: [dispatch(9001), dispatch(9002, { targetLabel: 'WO-20261021-002' })] });

    await user.click(await dispatchPane().findByText('WO-20261021-002'));
    await screen.findByRole('region', { name: 'WO-20261021-002' });
    const row = dispatchPane().getByText('WO-20261021-002').closest('tr') as HTMLElement;
    expect(isPicked(row)).toBe(true);

    await user.click(dispatchPane().getByText('WO-20261021-002'));
    await waitFor(() => expect(isPicked(row)).toBe(false));
    expect(screen.queryByRole('region', { name: 'WO-20261021-002' })).toBeNull();
  });

  it('주소의 selected 로 열면 상세 상자가 그 건으로 열리고 행이 선택으로 보인다', async () => {
    setup({ route: `${ROUTE}&selected=9001` });

    const detail = await screen.findByRole('region', { name: 'WO-20261021-001' });
    await within(detail).findByText('수신자 1');
    const row = (await dispatchPane().findByText('WO-20261021-001')).closest('tr') as HTMLElement;
    expect(isPicked(row)).toBe(true);
  });

  it('[초기화]는 기본 7일 · 조건 없음으로 되돌려 다시 조회한다(#358)', async () => {
    const user = userEvent.setup();
    const { dispatchQueries } = setup({ route: `${ROUTE}&result=SKIPPED` });

    await dispatchPane().findByText('WO-20261021-001');
    expect((dispatchQueries.at(-1) as URL).searchParams.get('status')).toBe('SKIPPED');
    await user.click(screen.getByRole('button', { name: t.workspace.clear }));

    await waitFor(() =>
      expect((dispatchQueries.at(-1) as URL).searchParams.get('status')).toBeNull(),
    );
    /* 처음 값으로 돌아왔으니 초기화는 다시 숨는다. */
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
  });

  it('[초기화]는 처음 값(기본 7일 · 조건 없음)이면 없고, 조회 단추 오른쪽에 조건 더보기가 선다(#358)', async () => {
    setup({ route: '/notification/dispatch-history' });

    await dispatchPane().findByText('WO-20261021-001');
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
    const search = screen.getByRole('button', { name: t.filters.search });
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });
    expect(search.parentElement).toBe(more.parentElement);
    expect(search.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('결과가 없으면 빈 안내를 보인다', async () => {
    setup({ dispatches: [] });

    expect(await dispatchPane().findByText(t.state.empty)).toBeInTheDocument();
  });
});

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
  const deliveryQueries: URL[] = [];
  const items = options.dispatches ?? [dispatch(9001)];
  renderWithProviders(<DispatchHistoryScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/app/notification-dispatches',
        respond: (request) => {
          dispatchQueries.push(new URL(request.url));
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
  return { dispatchQueries, deliveryQueries };
};

const dispatchPane = () => within(screen.getByRole('region', { name: t.panes.dispatches }));
const deliveryPane = () => within(screen.getByRole('region', { name: t.panes.deliveries }));

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

  it('필터를 바꿔 조회하면 그 조건을 쿼리에 싣는다', async () => {
    const user = userEvent.setup();
    const { dispatchQueries } = setup();

    await dispatchPane().findByText('WO-20261021-001');
    await user.click(screen.getByRole('combobox', { name: t.filters.result }));
    await user.click(await screen.findByRole('option', { name: t.results.SKIPPED }));
    await user.click(screen.getByRole('button', { name: t.filters.search }));

    await waitFor(() =>
      expect((dispatchQueries.at(-1) as URL).searchParams.get('status')).toBe('SKIPPED'),
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

  it('US8-1 행을 고르면 기간과 함께 Zalo 발송 상세를 부르고 SENDING 을 「대기」로 보인다', async () => {
    const user = userEvent.setup();
    const { deliveryQueries } = setup({
      deliveries: [
        delivery(1),
        delivery(2, { status: 'SENDING', sentAt: null }),
        delivery(3, { status: 'FAILED', lastErrorCode: '-108', lastErrorMessage: '전화번호 오류' }),
      ],
    });

    /* 고르기 전에는 드로어가 없다 — 목록 아래에 안내 자리도 두지 않는다(C-2). */
    await dispatchPane().findByText('WO-20261021-001');
    expect(screen.queryByRole('dialog')).toBeNull();
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

  /** T-W-A — 드로어가 목록을 덮으므로 머리가 어느 건의 상세인지 말해야 한다(omf-all-around#183). */
  it('행을 고르면 오른쪽 드로어 머리에 대상·이벤트·발생 시각을 보이고 행을 선택으로 표시한다', async () => {
    const user = userEvent.setup();
    setup({ dispatches: [dispatch(9001), dispatch(9002, { targetLabel: 'WO-20261021-002' })] });

    await user.click(await dispatchPane().findByText('WO-20261021-002'));

    const drawer = await screen.findByRole('dialog', { name: 'WO-20261021-002' });
    expect(within(drawer).getByText(/생산 마감, /)).toBeInTheDocument();
    const row = dispatchPane().getByText('WO-20261021-002').closest('tr') as HTMLElement;
    expect(row).toHaveAttribute('aria-selected', 'true');
  });

  it('주소의 selected 로 열면 드로어가 열린 채로 오고, 닫으면 선택이 풀린다', async () => {
    const user = userEvent.setup();
    setup({ route: `${ROUTE}&selected=9001` });

    const drawer = await screen.findByRole('dialog', { name: 'WO-20261021-001' });
    await within(drawer).findByText('수신자 1');
    await user.click(within(drawer).getByRole('button', { name: /닫기|close/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const row = dispatchPane().getByText('WO-20261021-001').closest('tr') as HTMLElement;
    expect(row).not.toHaveAttribute('aria-selected', 'true');
  });

  it('결과가 없으면 빈 안내를 보인다', async () => {
    setup({ dispatches: [] });

    expect(await dispatchPane().findByText(t.state.empty)).toBeInTheDocument();
  });
});

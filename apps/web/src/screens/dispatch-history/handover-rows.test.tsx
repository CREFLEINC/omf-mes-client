import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { DispatchHistoryScreen } from './screen';
import type { Dispatch } from './types';

const t = messages.dispatchHistory;

const row = (overrides: Partial<Dispatch>): Dispatch => ({
  notificationEventId: 1,
  eventCode: 'WORK_SESSION_STARTED',
  occurredAt: '2026-10-27T02:00:00Z',
  departmentId: 7,
  departmentName: '생산1팀',
  targetTypeCode: 'WORK_ORDER',
  targetId: 11,
  targetLabel: 'WO-합성-01',
  dispatchStatus: 'NOTIFIED',
  skipReasonCode: null,
  notificationCount: 2,
  zalo: { pending: 0, sent: 1, failed: 0, expired: 0, skippedNoPhone: 1 },
  ...overrides,
});

const ROWS: Dispatch[] = [
  row({ notificationEventId: 1 }),
  /* 인계 사건 — 부서가 없고(null) 대상 칸에 피킹 지시 번호가 온다. */
  row({
    notificationEventId: 2,
    eventCode: 'MATERIAL_PICKING_REQUESTED',
    departmentId: null,
    departmentName: null,
    targetLabel: '원자재창고 PK-합성-07',
  }),
  row({
    notificationEventId: 3,
    eventCode: 'PUTAWAY_REQUESTED',
    departmentId: null,
    departmentName: null,
    targetLabel: '원자재창고 GR-합성-03',
    dispatchStatus: 'SKIPPED',
    skipReasonCode: 'EVENT_DISABLED',
    notificationCount: 0,
    zalo: { pending: 0, sent: 0, failed: 0, expired: 0, skippedNoPhone: 0 },
  }),
];

const setup = () => {
  const queries: URL[] = [];
  const pathOf = (request: Request) => new URL(request.url).pathname;
  renderWithProviders(<DispatchHistoryScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => pathOf(request) === '/app/notification-dispatches',
        respond: (request) => {
          queries.push(new URL(request.url));
          return jsonResponse({ items: ROWS, page: { page: 1, size: 50, total: ROWS.length } });
        },
      },
      {
        match: (request) => pathOf(request) === '/app/notification-events',
        respond: () =>
          jsonResponse({
            items: [
              {
                eventCode: 'WORK_SESSION_STARTED',
                eventName: '생산 실행',
                recipientMode: 'CONFIGURED',
              },
            ],
          }),
      },
      {
        match: (request) => pathOf(request) === '/app/handover-alert-types',
        respond: () =>
          jsonResponse({
            items: [
              ['MATERIAL_PICKING_REQUESTED', '자재 출고 피킹'],
              ['PUTAWAY_REQUESTED', '적치'],
            ].map(([alertTypeCode, name]) => ({
              alertTypeCode,
              name,
              nameVi: name,
              targetTypeCode: 'PICKING_ORDER',
            })),
          }),
      },
      {
        match: (request) => pathOf(request) === '/mdm/departments',
        respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
      },
    ]),
    route: '/notification/dispatch-history?from=2026-10-21&to=2026-10-27',
  });
  return { queries };
};

const rowOf = async (target: string): Promise<HTMLElement> =>
  (await screen.findByText(target)).closest('tr') as HTMLElement;

describe('DispatchHistoryScreen — 인계 사건(피처 002)', () => {
  it('FR-022 인계 사건은 종류 이름, 부서 「—」, 대상 번호로 보이고 기존 사건 줄은 그대로다', async () => {
    setup();

    const picking = await rowOf('원자재창고 PK-합성-07');
    await waitFor(() => expect(within(picking).getByText('자재 출고 피킹')).toBeInTheDocument());
    expect(within(picking).getByText('—')).toBeInTheDocument();

    const putaway = await rowOf('원자재창고 GR-합성-03');
    expect(within(putaway).getByText('적치')).toBeInTheDocument();
    expect(within(putaway).getByText(t.skipped(t.skipReasons.EVENT_DISABLED))).toBeInTheDocument();

    const existing = await rowOf('WO-합성-01');
    expect(within(existing).getByText('생산 실행')).toBeInTheDocument();
    expect(within(existing).getByText('생산1팀')).toBeInTheDocument();
  });

  it('FR-022 이벤트 거르기에 「인계 작업」 묶음이 있고 고르면 그 코드로 부른다', async () => {
    const user = userEvent.setup();
    const { queries } = setup();

    await rowOf('WO-합성-01');
    await user.click(screen.getByRole('combobox', { name: t.filters.event }));
    const listbox = await screen.findByRole('listbox');
    const groups = within(listbox).getAllByRole('group');
    expect(groups).toHaveLength(2);
    await user.click(within(groups[1] as HTMLElement).getByRole('option', { name: '적치' }));
    await user.click(screen.getByRole('button', { name: t.filters.search }));

    await waitFor(() => {
      expect(queries.at(-1)?.searchParams.get('eventCode')).toBe('PUTAWAY_REQUESTED');
    });
  });
});

import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { notificationEventListBody, notificationFixture, notificationListBody } from './fixtures';
import { NotificationCenterScreen } from './screen';
import type { Notification } from './types';

const t = messages.notificationCenter;

/** 인계 종류 셋만 — 이름 풀이·묶음·이동을 재기에 충분하다. 이름은 코드와 뚜렷이 다르다. */
const HANDOVER_TYPES = [
  ['PUTAWAY_REQUESTED', '적치', 'GOODS_RECEIPT'],
  ['IQC_INSPECTION_REQUESTED', 'IQC 수입검사', 'INBOUND_RECEIPT'],
  ['MATERIAL_PICKING_REQUESTED', '자재 출고 피킹', 'PICKING_ORDER'],
].map(([alertTypeCode, name, targetTypeCode]) => ({
  alertTypeCode,
  name,
  nameVi: `${name ?? ''} vi`,
  targetTypeCode,
}));

const NOTIFICATIONS: Notification[] = [
  notificationFixture({ notificationId: 9101, eventCode: 'WORK_SESSION_STARTED' }),
  notificationFixture({
    notificationId: 9102,
    eventCode: 'IQC_INSPECTION_REQUESTED',
    message: '입하 합성-01: LOT 3건 IQC 의뢰',
    targetTypeCode: 'INBOUND_RECEIPT',
    targetId: 9201,
  }),
  notificationFixture({
    notificationId: 9103,
    eventCode: 'PUTAWAY_REQUESTED',
    message: '입고 합성-02: 적치 지시 2건',
    targetTypeCode: 'LOT',
    targetId: 9202,
  }),
];

const pathOf = (request: Request): string => new URL(request.url).pathname;

const routes = (handover: StubRoute['respond']): StubRoute[] => [
  {
    match: (request) => pathOf(request) === '/app/notifications',
    respond: () => jsonResponse(notificationListBody(NOTIFICATIONS)),
  },
  {
    match: (request) => pathOf(request) === '/app/notification-events',
    respond: () => jsonResponse(notificationEventListBody()),
  },
  { match: (request) => pathOf(request) === '/app/handover-alert-types', respond: handover },
  {
    match: (request) => pathOf(request) === '/app/notifications/unread-count',
    respond: () => jsonResponse({ unreadCount: 3 }),
  },
];

const render = (handover: StubRoute['respond']) =>
  renderWithProviders(<NotificationCenterScreen />, {
    fetch: createStubFetch(routes(handover)),
    route: '/?from=2026-08-01&to=2026-08-31',
  });

const okTypes = () => jsonResponse({ items: HANDOVER_TYPES });

describe('NotificationCenterScreen — 인계 작업 10종 합치기(피처 002)', () => {
  it('FR-022 인계 알림 제목을 인계 종류 이름으로 풀고 기존 6종 풀이는 그대로다', async () => {
    render(okTypes);

    expect(await screen.findByRole('button', { name: 'IQC 수입검사' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '적치' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '생산 실행' })).toBeInTheDocument();
  });

  it('FR-022 유형 거르기는 「이벤트」 묶음 뒤에 「인계 작업」 묶음을 보인다', async () => {
    const user = userEvent.setup();
    render(okTypes);

    await screen.findByRole('button', { name: 'IQC 수입검사' });
    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));

    const listbox = await screen.findByRole('listbox');
    const groups = within(listbox).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-label') ?? group.textContent)).toEqual([
      expect.stringContaining(t.filters.eventGroup),
      expect.stringContaining(t.filters.handoverGroup),
    ]);
    const handoverOptions = within(groups[1] as HTMLElement).getAllByRole('option');
    /* 업무 흐름 순서 — 서버가 준 차례(적치 먼저)가 아니다. */
    expect(handoverOptions.map((option) => option.textContent)).toEqual(
      ['IQC 수입검사', '적치', '자재 출고 피킹'].map((name) => expect.stringContaining(name)),
    );
    expect(
      within(groups[0] as HTMLElement).getByRole('option', { name: '생산 실행' }),
    ).toBeInTheDocument();
  });

  it('FR-011 T10 IQC 알림만 IQC 화면으로 가는 링크를 갖는다', async () => {
    render(okTypes);

    const link = await screen.findByRole('link', { name: t.actions.openTarget('IQC 수입검사') });
    expect(link).toHaveAttribute('href', '/logistics/iqc-inspection');
    expect(screen.queryByRole('link', { name: t.actions.openTarget('적치') })).toBeNull();
  });

  it('FR-018 인계 종류 조회가 실패해도 기존 6종 선택지·실패 안내는 그대로이고 제목은 코드로 낙하한다', async () => {
    const user = userEvent.setup();
    render(() => jsonResponse({ message: '' }, { status: 500 }));

    expect(
      await screen.findByRole('button', { name: 'IQC_INSPECTION_REQUESTED' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.filters.eventsFailed)).toBeNull();
    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryAllByRole('group')).toHaveLength(0);
    expect(within(listbox).getByRole('option', { name: '생산 실행' })).toBeInTheDocument();
  });
});

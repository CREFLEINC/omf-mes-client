import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { WorkOrderCloseAction, type WorkOrderCloseActionProps } from './wo-close-action';

const t = messages.productionResult.flow.woClose;
const WORK_ORDER_ID = 701;
const DETAIL = `/production/work-orders/${String(WORK_ORDER_ID)}`;

interface Recorded {
  path: string;
  headers: Headers;
  body: unknown;
}

const detail = (judgment: 'UNDER' | 'NORMAL' | 'OVER', extra: Record<string, unknown> = {}) => ({
  workOrderId: WORK_ORDER_ID,
  workOrderNo: 'WO-SYN-1',
  orderQty: 10,
  uomId: 1,
  statusCode: 'IN_PROGRESS',
  completionVarianceReasonCode: 'EQUIPMENT_FAILURE',
  progress: {
    goodQty: judgment === 'UNDER' ? 4 : 10,
    achievementRate: judgment === 'UNDER' ? 0.4 : 1,
    varianceQty: judgment === 'UNDER' ? 6 : 0,
    completionJudgmentCode: judgment,
  },
  preIssuedLots: { slotCount: 3, withResultCount: 1, withoutResultCount: 2 },
  ...extra,
});

const routes = (
  writes: Recorded[],
  judgment: 'UNDER' | 'NORMAL' | 'OVER',
  closeResponse: () => Response = () => jsonResponse(detail(judgment)),
): StubRoute[] => [
  {
    match: (request) => request.method === 'GET' && new URL(request.url).pathname === DETAIL,
    respond: () => jsonResponse(detail(judgment), { headers: { ETag: '"5"' } }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/trace/lots',
    respond: () =>
      jsonResponse({
        items: [
          { lotId: 1, lotNo: 'LOT-SYN-ACTIVE', lifecycleStatusCode: 'ACTIVE' },
          { lotId: 2, lotNo: 'LOT-SYN-WAITING', lifecycleStatusCode: 'WAITING' },
        ],
        page: { page: 1, size: 100, total: 2 },
      }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: [
          { code: 'MATERIAL_SHORTAGE', codeName: '자재 부족', displayOrder: 1, isActive: true },
          { code: 'EQUIPMENT_FAILURE', codeName: '설비 고장', displayOrder: 2, isActive: true },
        ],
        page: { page: 1, size: 100, total: 2 },
      }),
  },
  {
    match: (request) => request.method === 'POST',
    respond: async (request) => {
      const path = new URL(request.url).pathname;
      writes.push({ path, headers: request.headers, body: await request.clone().json() });
      return path.endsWith(':end')
        ? jsonResponse({ workSessionId: 55, statusCode: 'ENDED' })
        : closeResponse();
    },
  },
];

const baseProps: WorkOrderCloseActionProps = {
  workOrderId: WORK_ORDER_ID,
  workOrderNo: 'WO-SYN-1',
  statusCode: 'IN_PROGRESS',
  workerNo: '900028',
  gate: 'allowed',
  isOnline: true,
  pendingCount: 0,
  ownSessionId: null,
  isOwnSessionPending: false,
  uomLabel: 'EA',
};

const renderAction = (routeList: StubRoute[], overrides: Partial<WorkOrderCloseActionProps> = {}) =>
  renderWithProviders(<WorkOrderCloseAction {...baseProps} {...overrides} />, {
    fetch: createStubFetch(routeList),
    route: '/pop/production-result',
    dataRouter: true,
  });

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: t.button }));
  return screen.findByRole('dialog', { name: t.title('WO-SYN-1') });
};

describe('WorkOrderCloseAction', () => {
  it('미달이면 잔량 처리를 고르게 하고, 세션을 끝낸 뒤 마감하고 작업 시작으로 돌아간다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    const { router } = renderAction(routes(writes, 'UNDER'), { ownSessionId: 55 });

    const dialog = await openDialog(user);
    expect(await within(dialog).findByText(t.judgments.UNDER)).toBeVisible();
    expect(within(dialog).getByText(t.fields.shortfallQty).nextElementSibling).toHaveTextContent(
      '6 EA',
    );
    expect(await within(dialog).findByText(t.prefilled)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '설비 고장' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await within(dialog).findByText(t.openLots(1, 'LOT-SYN-ACTIVE'))).toBeVisible();
    expect(within(dialog).getByText(t.voidedSlots(2))).toBeVisible();
    expect(within(dialog).getByText(t.needRemainder)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: t.confirm })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: t.remainder.WRITE_OFF }));
    await user.click(within(dialog).getByRole('button', { name: t.confirm }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[0]?.path).toBe('/production/work-sessions/55:end');
    expect(writes[1]?.path).toBe(`${DETAIL}:close`);
    expect(writes[1]?.headers.get('If-Match')).toBe('"5"');
    expect(writes[1]?.headers.get('X-Worker-No')).toBe('900028');
    expect(writes[1]?.body).toEqual({
      remainderDispositionCode: 'WRITE_OFF',
      reasonCode: 'EQUIPMENT_FAILURE',
    });
    await waitFor(() => expect(router?.state.location.pathname).toBe('/pop/work-start'));
  });

  it('정상이면 입력 없이 빈 본문으로 마감한다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    renderAction(routes(writes, 'NORMAL'));

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    expect(within(dialog).queryByText(t.fields.remainder)).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: t.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body).toEqual({});
  });

  it('다른 단말 세션이 열려 거부되면 서버 문구를 보이고 머문다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    const message =
      '열린 작업 세션이 있어 마감할 수 없습니다(단말 POP-2·홍길동). 그 단말에서 작업을 종료하거나 관리웹에서 작업 세션을 강제 종료한 뒤 다시 마감하세요.';
    const { router } = renderAction(
      routes(writes, 'NORMAL', () =>
        jsonResponse({ code: 'OPEN_SESSION_EXISTS', message, openSessions: [] }, { status: 409 }),
      ),
    );

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    await user.click(within(dialog).getByRole('button', { name: t.confirm }));

    expect(await within(dialog).findByText(message, { exact: false })).toBeVisible();
    expect(router?.state.location.pathname).toBe('/pop/production-result');
  });

  it.each([
    [
      '권한이 꺼진 단말',
      { gate: 'denied' as const },
      t.blocked.denied(
        `${messages.workOrderClose.breadcrumbRoot} › ${messages.workOrderClose.title}`,
        `${messages.terminalProcessMap.breadcrumbRoot} › ${messages.terminalProcessMap.title}`,
      ),
    ],
    ['오프라인', { isOnline: false }, t.blocked.offline],
    ['보내지 못한 실적', { pendingCount: 2 }, t.blocked.pending(2)],
    ['시작 전 작업지시', { statusCode: 'RELEASED' }, t.blocked.status],
  ])('%s이면 단추를 막고 까닭을 말한다', (_case, overrides, reason) => {
    renderAction([], overrides);

    expect(screen.getByRole('button', { name: t.button })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.button })).toHaveAccessibleDescription(reason);
  });

  it('이미 마감된 작업지시에는 단추를 두지 않는다', () => {
    renderAction([], { statusCode: 'CLOSED' });

    expect(screen.queryByRole('button', { name: t.button })).toBeNull();
  });
});

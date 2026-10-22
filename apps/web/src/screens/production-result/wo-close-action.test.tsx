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
const TERMINAL_ID = 10;
const DETAIL = `/production/work-orders/${String(WORK_ORDER_ID)}`;
const CLOSE = `${DETAIL}:close`;
const END = '/production/work-sessions/55:end';

type Judgment = 'UNDER' | 'NORMAL' | 'OVER' | null;

interface Recorded {
  path: string;
  key: string | null;
  ifMatch: string | null;
  workerNo: string | null;
  body: unknown;
}

const detail = (judgment: Judgment) => ({
  workOrderId: WORK_ORDER_ID,
  workOrderNo: 'WO-SYN-1',
  orderQty: 10,
  uomId: 1,
  statusCode: 'IN_PROGRESS',
  completionVarianceReasonCode: 'EQUIPMENT_FAILURE',
  ...(judgment === null
    ? {}
    : {
        progress: {
          goodQty: judgment === 'UNDER' ? 4 : 10,
          achievementRate: judgment === 'UNDER' ? 0.4 : 1,
          varianceQty: judgment === 'UNDER' ? 6 : 0,
          completionJudgmentCode: judgment,
        },
      }),
  preIssuedLots: { slotCount: 3, withResultCount: 1, withoutResultCount: 2 },
});

const session = (workSessionId: number, terminalId: number, statusCode: string) => ({
  workSessionId,
  workOrderId: WORK_ORDER_ID,
  sessionNo: workSessionId,
  shiftId: 1,
  terminalId,
  terminalCode: `POP-SYN-${String(terminalId)}`,
  workerNo: '900028',
  workerName: '합성 작업자',
  startedAt: '2026-10-22T08:00:00+07:00',
  statusCode,
  versionNo: 1,
});

interface Scenario {
  judgment?: Judgment;
  sessions?: () => unknown[];
  end?: (attempt: number) => Response;
  close?: (attempt: number) => Response;
  lots?: () => Response | Promise<Response>;
}

const stateLocked = (message: string) =>
  jsonResponse({ errors: [{ scope: 'screen', code: 'STATE_LOCKED', message }] }, { status: 400 });

const routes = (writes: Recorded[], scenario: Scenario): StubRoute[] => {
  const judgment = scenario.judgment === undefined ? 'NORMAL' : scenario.judgment;
  let endAttempts = 0;
  let closeAttempts = 0;

  return [
    {
      match: (request) => request.method === 'GET' && new URL(request.url).pathname === DETAIL,
      respond: () => jsonResponse(detail(judgment), { headers: { ETag: '"5"' } }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/trace/lots',
      respond: () =>
        scenario.lots?.() ??
        jsonResponse({
          items: [
            { lotId: 1, lotNo: 'LOT-SYN-ACTIVE', lifecycleStatusCode: 'ACTIVE' },
            { lotId: 2, lotNo: 'LOT-SYN-WAITING', lifecycleStatusCode: 'WAITING' },
          ],
          page: { page: 1, size: 100, total: 2 },
        }),
    },
    {
      match: (request) =>
        request.method === 'GET' && new URL(request.url).pathname === '/production/work-sessions',
      respond: () => {
        const items = scenario.sessions?.() ?? [];
        return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
      },
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
        writes.push({
          path,
          key: request.headers.get('Idempotency-Key'),
          ifMatch: request.headers.get('If-Match'),
          workerNo: request.headers.get('X-Worker-No'),
          body: await request.clone().json(),
        });
        if (path === END) {
          endAttempts += 1;
          return scenario.end?.(endAttempts) ?? jsonResponse(session(55, TERMINAL_ID, 'ENDED'));
        }
        closeAttempts += 1;
        return scenario.close?.(closeAttempts) ?? jsonResponse(detail(judgment));
      },
    },
  ];
};

const baseProps: WorkOrderCloseActionProps = {
  workOrderId: WORK_ORDER_ID,
  workOrderNo: 'WO-SYN-1',
  statusCode: 'IN_PROGRESS',
  workerNo: '900028',
  terminalId: TERMINAL_ID,
  gate: 'allowed',
  isOnline: true,
  pendingCount: 0,
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

const confirmOf = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: t.confirm });

const ownRunning = () => [session(55, TERMINAL_ID, 'RUNNING')];

describe('WorkOrderCloseAction — 보내는 순서', () => {
  it('미달이면 잔량 처리를 고르게 하고, 이 단말 세션을 끝낸 뒤 마감하고 작업 시작으로 돌아간다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    const { router } = renderAction(routes(writes, { judgment: 'UNDER', sessions: ownRunning }));

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
    expect(confirmOf(dialog)).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: t.remainder.WRITE_OFF }));
    await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
    await user.click(confirmOf(dialog));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes.map((write) => write.path)).toEqual([END, CLOSE]);
    expect(writes[1]).toMatchObject({
      ifMatch: '"5"',
      workerNo: '900028',
      body: { remainderDispositionCode: 'WRITE_OFF', reasonCode: 'EQUIPMENT_FAILURE' },
    });
    await waitFor(() => expect(router?.state.location.pathname).toBe('/pop/work-start'));
  });

  it('정상이고 열린 세션이 없으면 빈 본문으로 마감만 보낸다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    renderAction(routes(writes, {}));

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    expect(within(dialog).queryByText(t.fields.remainder)).toBeNull();
    await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
    await user.click(confirmOf(dialog));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ path: CLOSE, body: {} });
  });
});

describe('WorkOrderCloseAction — 이 단말이 끝낼 수 없는 세션', () => {
  it.each([
    [
      '다른 단말의 세션',
      () => [...ownRunning(), session(77, 11, 'RUNNING')],
      'POP-SYN-11',
      t.sessions.other(messages.workOrderClose.menuPath),
    ],
    [
      '이 단말의 중단 세션',
      () => [session(66, TERMINAL_ID, 'STOPPED')],
      'POP-SYN-10',
      t.sessions.here(messages.workHoldRegister.title),
    ],
  ])(
    '%s이 있으면 아무것도 보내지 않고 단말과 끝낼 곳을 보인다',
    async (_case, sessions, terminal, where) => {
      const writes: Recorded[] = [];
      const user = userEvent.setup();
      renderAction(routes(writes, { sessions }));

      const dialog = await openDialog(user);
      expect((await within(dialog).findAllByText(t.sessions.blocked))[0]).toBeVisible();
      const row = within(dialog).getByText(terminal).closest('tr') as HTMLElement;
      expect(within(row).getByText(where)).toBeVisible();
      expect(within(row).getByText('합성 작업자(900028)')).toBeVisible();
      await within(dialog).findByText(t.judgments.NORMAL);
      expect(confirmOf(dialog)).toBeDisabled();
      expect(confirmOf(dialog)).toHaveAccessibleDescription(t.sessions.blocked);
      expect(writes).toHaveLength(0);
    },
  );
});

describe('WorkOrderCloseAction — 실패 경로', () => {
  it.each([
    [
      '409',
      () =>
        jsonResponse(
          {
            code: 'OPEN_SESSION_EXISTS',
            message: '열린 작업 세션이 있어 마감할 수 없습니다(단말 POP-SYN-2·합성 작업자).',
          },
          { status: 409 },
        ),
      '열린 작업 세션이 있어 마감할 수 없습니다',
    ],
    [
      '400',
      () => stateLocked('마감할 수 없는 W/O 입니다 — 배포 상태입니다.'),
      '마감할 수 없는 W/O 입니다',
    ],
  ])(
    '세션을 끝낸 뒤 마감이 %s 로 거부되면 세션은 끝났고 마감은 안 됐다고 알리고, 다시 누르면 마감만 보낸다',
    async (_case, close, serverText) => {
      const writes: Recorded[] = [];
      const user = userEvent.setup();
      let ended = false;
      renderAction(
        routes(writes, {
          sessions: () => (ended ? [] : ownRunning()),
          end: () => {
            ended = true;
            return jsonResponse(session(55, TERMINAL_ID, 'ENDED'));
          },
          close: (attempt) => (attempt === 1 ? close() : jsonResponse(detail('NORMAL'))),
        }),
      );

      const dialog = await openDialog(user);
      await within(dialog).findByText(t.judgments.NORMAL);
      await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
      await user.click(confirmOf(dialog));

      expect(await within(dialog).findByText(t.endedButNotClosed)).toBeVisible();
      expect(within(dialog).getByText(new RegExp(serverText))).toBeVisible();
      expect(writes.map((write) => write.path)).toEqual([END, CLOSE]);

      await user.click(confirmOf(dialog));
      await waitFor(() => expect(writes).toHaveLength(3));
      expect(writes[2]?.path).toBe(CLOSE);
    },
  );

  it('세션 끝내기가 STATE_LOCKED 면 이미 끝난 것으로 보고 세션을 다시 읽은 뒤 마감한다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    let reads = 0;
    renderAction(
      routes(writes, {
        sessions: () => {
          reads += 1;
          return reads === 1 ? ownRunning() : [];
        },
        end: () => stateLocked('이미 종료된 작업 세션입니다(관리웹에서 종료됐을 수 있습니다).'),
      }),
    );

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
    await user.click(confirmOf(dialog));

    await waitFor(() => expect(writes.map((write) => write.path)).toEqual([END, CLOSE]));
    expect(reads).toBeGreaterThanOrEqual(2);
  });

  it('세션 끝내기를 다시 시도하면 같은 멱등 키와 같은 끝 시각을 보낸다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    renderAction(
      routes(writes, {
        sessions: ownRunning,
        end: (attempt) =>
          attempt === 1
            ? jsonResponse({ message: '합성 실패' }, { status: 500 })
            : jsonResponse(session(55, TERMINAL_ID, 'ENDED')),
      }),
    );

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
    await user.click(confirmOf(dialog));
    expect(await within(dialog).findByText(t.endFailed)).toBeVisible();

    await user.click(confirmOf(dialog));
    await waitFor(() => expect(writes.map((write) => write.path)).toEqual([END, END, CLOSE]));
    expect(writes[1]?.key).toBe(writes[0]?.key);
    expect(writes[1]?.body).toEqual(writes[0]?.body);
  });

  it.each([
    [403, t.endForbidden],
    [404, t.endNotFound],
  ])('세션 끝내기가 %s 면 그에 맞는 조치를 말하고 마감하지 않는다', async (status, text) => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    renderAction(
      routes(writes, {
        sessions: ownRunning,
        /* 권한·없음 응답도 계약의 오류 봉투로 온다. */
        end: () =>
          jsonResponse(
            { errors: [{ scope: 'screen', code: 'SYN_DENIED', message: '합성 거부' }] },
            { status },
          ),
      }),
    );

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
    await user.click(confirmOf(dialog));

    expect(await within(dialog).findByText(text)).toBeVisible();
    expect(writes.map((write) => write.path)).toEqual([END]);
  });

  it('세션 끝내기를 서버가 까닭과 함께 거부하면 그 문구를 보이고 마감하지 않는다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    const message = '세션 종료 시각이 시작보다 앞섭니다. 단말 시계를 확인하세요.';
    renderAction(
      routes(writes, {
        sessions: ownRunning,
        end: () =>
          jsonResponse(
            { errors: [{ scope: 'field', field: 'endedAt', code: 'INVALID', message }] },
            { status: 400 },
          ),
      }),
    );

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
    await user.click(confirmOf(dialog));

    expect(await within(dialog).findByText(message)).toBeVisible();
    expect(writes.map((write) => write.path)).toEqual([END]);
  });

  it.each([
    [
      '다른 단말 세션이 남아 있으면',
      () =>
        jsonResponse({
          items: [session(77, 11, 'RUNNING')],
          page: { page: 1, size: 50, total: 1 },
        }),
      t.sessions.blocked,
    ],
    [
      '다시 읽지 못하면',
      () => jsonResponse({ message: '합성 실패' }, { status: 500 }),
      t.sessions.loadFailed,
    ],
  ])(
    '이미 끝난 세션을 확인하려고 다시 읽었는데 %s 마감하지 않는다',
    async (_case, secondRead, reason) => {
      const writes: Recorded[] = [];
      const user = userEvent.setup();
      let reads = 0;
      const base = routes(writes, {
        sessions: ownRunning,
        end: () => stateLocked('이미 종료된 작업 세션입니다.'),
      });
      renderAction([
        {
          match: (request) =>
            request.method === 'GET' &&
            new URL(request.url).pathname === '/production/work-sessions',
          respond: () => {
            reads += 1;
            return reads === 1
              ? jsonResponse({ items: ownRunning(), page: { page: 1, size: 50, total: 1 } })
              : secondRead();
          },
        },
        ...base,
      ]);

      const dialog = await openDialog(user);
      await within(dialog).findByText(t.judgments.NORMAL);
      await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
      await user.click(confirmOf(dialog));

      await waitFor(() => expect(confirmOf(dialog)).toHaveAccessibleDescription(reason));
      expect(writes.map((write) => write.path)).toEqual([END]);
    },
  );

  it('창을 닫았다 다시 열면 앞 시도의 실패를 지우고 세션과 판정을 다시 읽는다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    let reads = 0;
    renderAction(
      routes(writes, {
        sessions: () => {
          reads += 1;
          return ownRunning();
        },
        end: () => jsonResponse({ message: '합성 실패' }, { status: 500 }),
      }),
    );

    let dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    await waitFor(() => expect(confirmOf(dialog)).toBeEnabled());
    await user.click(confirmOf(dialog));
    expect(await within(dialog).findByText(t.endFailed)).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: t.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const readsBefore = reads;
    dialog = await openDialog(user);

    await waitFor(() => expect(reads).toBeGreaterThan(readsBefore));
    expect(within(dialog).queryByText(t.endFailed)).toBeNull();
  });

  it('진행 중 LOT 을 확인하는 동안에는 마감을 막고 그 까닭을 단추에 잇는다', async () => {
    const user = userEvent.setup();
    renderAction(routes([], { lots: () => new Promise<Response>(() => undefined) }));

    const dialog = await openDialog(user);
    await within(dialog).findByText(t.judgments.NORMAL);
    await waitFor(() => expect(confirmOf(dialog)).toHaveAccessibleDescription(t.openLotsChecking));
    expect(confirmOf(dialog)).toBeDisabled();
  });

  it('판정이 없으면 그 까닭을 말하고 마감을 막는다', async () => {
    const writes: Recorded[] = [];
    const user = userEvent.setup();
    renderAction(routes(writes, { judgment: null }));

    const dialog = await openDialog(user);
    expect((await within(dialog).findAllByText(t.judgmentMissing))[0]).toBeVisible();
    expect(confirmOf(dialog)).toBeDisabled();
    expect(confirmOf(dialog)).toHaveAccessibleDescription(t.judgmentMissing);
  });

  it.each([
    ['조회 실패', () => jsonResponse({ message: '합성 실패' }, { status: 500 }), t.openLotsUnknown],
    [
      '한 쪽을 넘김',
      () =>
        jsonResponse({
          items: [{ lotId: 1, lotNo: 'LOT-SYN-ACTIVE', lifecycleStatusCode: 'ACTIVE' }],
          page: { page: 1, size: 100, total: 103 },
        }),
      t.uncheckedLots(102),
    ],
  ])('진행 중 LOT 을 다 알 수 없으면(%s) 그 사실을 말한다', async (_case, lots, text) => {
    const user = userEvent.setup();
    renderAction(routes([], { lots }));

    const dialog = await openDialog(user);
    expect(await within(dialog).findByText(text)).toBeVisible();
  });
});

describe('WorkOrderCloseAction — 단추를 막는 까닭', () => {
  it.each([
    [
      '권한이 꺼진 단말',
      { gate: 'denied' as const },
      t.blocked.denied(messages.workOrderClose.menuPath, messages.terminalProcessMap.menuPath),
    ],
    ['확인되지 않은 단말', { gate: 'unidentified' as const }, t.blocked.unidentified],
    ['오프라인', { isOnline: false }, t.blocked.offline],
    ['보내지 못한 실적', { pendingCount: 2 }, t.blocked.pending(2)],
    ['시작 전 작업지시', { statusCode: 'RELEASED' }, t.blocked.status],
    ['취소된 작업지시', { statusCode: 'CANCELLED' }, t.blocked.cancelled],
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

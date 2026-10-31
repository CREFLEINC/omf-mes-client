import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setWorkerSession } from '../../patterns/worker-session';
import { TERMINAL_ID, WORKER, WORK_ORDER, renderScreen } from './screen-harness';

const t = messages.workStart;
const c = t.coWorkers;

const SUB_A = { ...WORKER, workerId: 2102, workerNo: '3392', workerName: '합성 부작업자 A' };
const SUB_B = { ...WORKER, workerId: 2103, workerNo: '3393', workerName: '합성 부작업자 B' };
const SUB_C = { ...WORKER, workerId: 2104, workerNo: '3394', workerName: '합성 부작업자 C' };
const OTHER_PLANT = { ...WORKER, workerId: 2109, workerNo: '3399', plantId: 99 };
const WORKERS = [WORKER, SUB_A, SUB_B, SUB_C, OTHER_PLANT];

const OPEN_SESSION = {
  workSessionId: 9801,
  workOrderId: WORK_ORDER.workOrderId,
  sessionNo: 1,
  terminalId: TERMINAL_ID,
  startedAt: '2026-09-02T08:10:00+09:00',
  statusCode: 'SYN_RUNNING',
};
const sessionMember = (
  workSessionWorkerId: number,
  worker: typeof WORKER,
  workerRoleCode: string,
) => ({
  workSessionWorkerId,
  workerId: worker.workerId,
  workerNo: worker.workerNo,
  workerName: worker.workerName,
  workerRoleCode,
  joinedAt: '2026-09-02T08:10:00+09:00',
  participatedMinutes: 30,
});

const crewPanel = () => screen.getByRole('group', { name: c.title });
const nameOf = (worker: typeof WORKER) => c.name(worker.workerName, worker.workerNo);

const addByKeypad = async (user: ReturnType<typeof renderScreen>['user'], workerNo: string) => {
  await user.click(within(crewPanel()).getByRole('button', { name: c.add }));
  const dialog = await screen.findByRole('dialog', { name: c.dialogTitle });
  for (const digit of workerNo) {
    await user.click(within(dialog).getByRole('button', { name: digit }));
  }
  await user.click(within(dialog).getByRole('button', { name: c.confirm }));
};

const pick = async (user: ReturnType<typeof renderScreen>['user']) => {
  await user.click(
    await screen.findByRole('button', { name: t.list.select(WORK_ORDER.workOrderNo) }),
  );
};

beforeEach(() => {
  setWorkerSession({
    worker: WORKER,
    assignedAt: '2026-09-02 09:00',
    isOtherPlant: false,
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  setWorkerSession(null);
});

describe('P-02-01 작업자 — 시작 전', () => {
  it('사번을 확인한 사람이 정이고 뺄 수 없다', async () => {
    renderScreen({ workers: WORKERS });

    const panel = await screen.findByRole('group', { name: c.title });
    expect(within(panel).getByText(c.main)).toBeInTheDocument();
    expect(within(panel).getByText(nameOf(WORKER))).toBeInTheDocument();
    expect(within(panel).getByText(c.count(1, 4))).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: c.remove(nameOf(WORKER)) })).toBeNull();
  });

  it('부를 더하고 빼며, 시작하면 부만 workerIds 로 보낸다', async () => {
    const { user, recorded } = renderScreen({ workers: WORKERS });
    await screen.findByRole('group', { name: c.title });

    await addByKeypad(user, SUB_A.workerNo);
    await addByKeypad(user, SUB_B.workerNo);
    expect(within(crewPanel()).getByText(nameOf(SUB_A))).toBeInTheDocument();
    expect(within(crewPanel()).getByText(c.count(3, 4))).toBeInTheDocument();

    await user.click(within(crewPanel()).getByRole('button', { name: c.remove(nameOf(SUB_B)) }));
    expect(within(crewPanel()).queryByText(nameOf(SUB_B))).toBeNull();

    await pick(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.actions.start })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: t.actions.start }));

    await waitFor(() =>
      expect(
        recorded.bodies.filter((sent) => sent.url === '/production/work-sessions'),
      ).toHaveLength(1),
    );
    const body = recorded.bodies.find((sent) => sent.url === '/production/work-sessions')?.body;
    expect(body).toEqual(expect.objectContaining({ workerIds: [SUB_A.workerId] }));
  });

  it('부가 없으면 workerIds 를 싣지 않는다', async () => {
    const { user, recorded } = renderScreen({ workers: WORKERS });

    await pick(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.actions.start })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: t.actions.start }));

    await waitFor(() =>
      expect(recorded.bodies.some((sent) => sent.url === '/production/work-sessions')).toBe(true),
    );
    const body = recorded.bodies.find((sent) => sent.url === '/production/work-sessions')?.body;
    expect(body).not.toHaveProperty('workerIds');
  });

  it('정·중복·미등록·다른 공장 사번은 창 안에서 막는다', async () => {
    const { user } = renderScreen({ workers: WORKERS });
    await screen.findByRole('group', { name: c.title });

    await addByKeypad(user, WORKER.workerNo);
    const dialog = screen.getByRole('dialog', { name: c.dialogTitle });
    expect(within(dialog).getByText(c.duplicate)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: c.cancel }));
    await addByKeypad(user, '7777');
    expect(within(screen.getByRole('dialog')).getByText(t.worker.unknown)).toBeInTheDocument();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: c.cancel }));
    await addByKeypad(user, OTHER_PLANT.workerNo);
    expect(within(screen.getByRole('dialog')).getByText(c.otherPlant)).toBeInTheDocument();
  });

  it('4명이면 더하기를 막는다', async () => {
    const { user } = renderScreen({ workers: WORKERS });
    await screen.findByRole('group', { name: c.title });

    for (const worker of [SUB_A, SUB_B, SUB_C]) await addByKeypad(user, worker.workerNo);

    expect(within(crewPanel()).getByText(c.count(4, 4))).toBeInTheDocument();
    expect(within(crewPanel()).getByRole('button', { name: c.add })).toBeDisabled();
  });
});

describe('P-02-01 작업자 — 진행 중인 세션', () => {
  const sessionCrew = [sessionMember(8701, WORKER, 'MAIN'), sessionMember(8702, SUB_A, 'OPERATOR')];

  it('지금 참여자를 보이고, 더하면 바로 참여 요청을 보낸다', async () => {
    const { user, recorded } = renderScreen({
      workers: WORKERS,
      openSessions: [OPEN_SESSION],
      sessionWorkers: sessionCrew,
    });

    await pick(user);
    /* 옛 역할 값은 부로 읽고, 정에는 빼기 단추가 없다. */
    expect(await within(crewPanel()).findByText(nameOf(SUB_A))).toBeInTheDocument();
    expect(within(crewPanel()).getByText(c.count(2, 4))).toBeInTheDocument();
    expect(
      within(crewPanel()).getByRole('button', { name: c.remove(nameOf(SUB_A)) }),
    ).toBeInTheDocument();
    expect(
      within(crewPanel()).queryByRole('button', { name: c.remove(nameOf(WORKER)) }),
    ).toBeNull();

    await addByKeypad(user, SUB_B.workerNo);

    expect(await within(crewPanel()).findByText(nameOf(SUB_B))).toBeInTheDocument();
    const join = recorded.bodies.find(
      (sent) =>
        sent.url === `/production/work-sessions/${String(OPEN_SESSION.workSessionId)}/workers`,
    );
    expect(join?.body).toEqual(expect.objectContaining({ workerId: SUB_B.workerId }));
    expect(join?.headers['x-worker-no']).toBe(WORKER.workerNo);
  });

  it('빼면 바로 이탈 요청을 보낸다', async () => {
    const { user, recorded } = renderScreen({
      workers: WORKERS,
      openSessions: [OPEN_SESSION],
      sessionWorkers: sessionCrew,
    });

    await pick(user);
    await user.click(
      await within(crewPanel()).findByRole('button', { name: c.remove(nameOf(SUB_A)) }),
    );

    await waitFor(() => expect(within(crewPanel()).queryByText(nameOf(SUB_A))).toBeNull());
    const leave = recorded.bodies.find((sent) => decodeURIComponent(sent.url).endsWith(':leave'));
    expect(decodeURIComponent(leave?.url ?? '')).toBe(
      `/production/work-sessions/${String(OPEN_SESSION.workSessionId)}/workers/8702:leave`,
    );
    expect(leave?.body).toEqual({ leftAt: expect.any(String) });
    expect(leave?.headers['x-worker-no']).toBe(WORKER.workerNo);
  });

  it('서버가 거절하면 그 사유를 보인다', async () => {
    const message = '동시에 참여할 수 있는 작업자는 4명까지입니다.';
    const { user } = renderScreen({
      workers: WORKERS,
      openSessions: [OPEN_SESSION],
      sessionWorkers: sessionCrew,
      crewWriteError: {
        status: 400,
        body: { errors: [{ scope: 'field', field: 'workerId', code: 'INVALID', message }] },
      },
    });

    await pick(user);
    await within(crewPanel()).findByText(nameOf(SUB_A));
    await addByKeypad(user, SUB_B.workerNo);

    expect(await within(crewPanel()).findByText(message)).toBeInTheDocument();
  });

  it('실패하면 참여자를 다시 받고, 고른 것을 놓으면 실패 띠를 지운다', async () => {
    const message = '이미 참여 중인 작업자입니다.';
    const { user, recorded } = renderScreen({
      workers: WORKERS,
      openSessions: [OPEN_SESSION],
      sessionWorkers: sessionCrew,
      crewWriteError: {
        status: 400,
        body: { errors: [{ scope: 'field', field: 'workerId', code: 'STATE_LOCKED', message }] },
      },
    });
    const crewReads = () =>
      recorded.urls.filter((url) => url.startsWith('/production/work-sessions/9801/workers'))
        .length;

    await pick(user);
    await within(crewPanel()).findByText(nameOf(SUB_A));
    const before = crewReads();
    await addByKeypad(user, SUB_B.workerNo);

    expect(await within(crewPanel()).findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(crewReads()).toBeGreaterThan(before));

    await pick(user);
    expect(within(crewPanel()).queryByText(message)).toBeNull();
  });

  it('보내는 동안은 더하기·빼기를 잠근다', async () => {
    let release: (value: unknown) => void = () => undefined;
    const { user } = renderScreen({
      workers: WORKERS,
      openSessions: [OPEN_SESSION],
      sessionWorkers: sessionCrew,
      crewWriteGate: new Promise((resolve) => {
        release = resolve;
      }),
    });

    await pick(user);
    await within(crewPanel()).findByText(nameOf(SUB_A));
    await addByKeypad(user, SUB_B.workerNo);

    await waitFor(() =>
      expect(within(crewPanel()).getByRole('button', { name: c.add })).toBeDisabled(),
    );
    expect(
      within(crewPanel()).getByRole('button', { name: c.remove(nameOf(SUB_A)) }),
    ).toBeDisabled();

    release(null);
    await waitFor(() =>
      expect(within(crewPanel()).getByRole('button', { name: c.add })).toBeEnabled(),
    );
  });
});

describe('P-02-01 작업자 — 이름을 모를 때', () => {
  it('사번·이름이 없는 참여자는 내부 번호 대신 「알 수 없음」이다', async () => {
    const { user } = renderScreen({
      workers: WORKERS,
      openSessions: [OPEN_SESSION],
      sessionWorkers: [
        sessionMember(8701, WORKER, 'MAIN'),
        { ...sessionMember(8703, SUB_C, 'SUB'), workerNo: undefined, workerName: undefined },
      ],
    });

    await pick(user);
    expect(await within(crewPanel()).findByText(c.unknown)).toBeInTheDocument();
    expect(within(crewPanel()).queryByText(String(SUB_C.workerId))).toBeNull();
  });
});

describe('P-02-01 작업자 — 오프라인', () => {
  it('연결이 끊기면 더하기를 잠근다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderScreen({ workers: WORKERS });

    const panel = await screen.findByRole('group', { name: c.title });
    expect(within(panel).getByRole('button', { name: c.add })).toBeDisabled();
  });
});

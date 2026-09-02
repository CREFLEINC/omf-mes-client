import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EQUIPMENT_ID,
  PROCESS_ID,
  WORKER,
  WORK_ORDER,
  listUrls,
  renderScreen,
} from './screen-harness';

const t = messages.workStart;

/** 줄 전체가 누를 자리라, 카드의 이름으로 고른다. */
const selectName = (workOrderNo: string): string => `${t.list.select} ${workOrderNo}`;

/** 사번을 키패드로 넣고 확인까지 누른다 — 이 화면의 모든 쓰기가 이 앞에 선다. */
const enterWorkerNo = async (user: ReturnType<typeof renderScreen>['user'], workerNo: string) => {
  for (const digit of workerNo) {
    await user.click(screen.getByRole('button', { name: digit }));
  }

  await user.click(screen.getByRole('button', { name: t.worker.confirm }));
};

const startButton = () => screen.getByRole('button', { name: t.actions.start });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('P-02-01 작업 시작 — 단말 게이팅', () => {
  it('이 공정의 행이 없으면 닫고 푸는 곳을 말한다', async () => {
    renderScreen({ processes: [{ processId: PROCESS_ID + 1, canStartWork: true }] });

    expect(await screen.findByText(t.blocked.denied)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  /**
   * ⛔ **`flag !== false` 로 쓰면 통과하는 자리다.** 여덟 플래그는 `required` 가 아니라 값이
   * 없을 수 있고, 계약이 「기본은 닫힘」이라 적었다.
   */
  it('행은 있는데 canStartWork 가 응답에 없으면 닫는다', async () => {
    renderScreen({ processes: [{ processId: PROCESS_ID, processName: '합성 사출' }] });

    expect(await screen.findByText(t.blocked.denied)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('canStartWork 가 거짓이면 닫는다', async () => {
    renderScreen({ processes: [{ processId: PROCESS_ID, canStartWork: false }] });

    expect(await screen.findByText(t.blocked.denied)).toBeInTheDocument();
  });

  /** ⛔ 조회 실패를 통과로 처리하지 않는다(F-6). 「없습니다」와 다른 문장이다. */
  it('조회가 실패하면 「확인할 수 없다」로 닫고 다시 시도 경로를 준다', async () => {
    renderScreen({ processesStatus: 500 });

    expect(await screen.findByText(t.blocked.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.blocked.denied)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.blocked.retry })).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('단말·공정을 모르면 조회하지 않고 사유를 말한다', async () => {
    const { recorded } = renderScreen({
      identity: { terminalId: null, processId: null, workerNo: null },
    });

    expect(await screen.findByText(t.blocked.unidentified)).toBeInTheDocument();
    expect(recorded.urls.some((url) => url.includes('/processes'))).toBe(false);
  });
});

describe('P-02-01 작업 시작 — 목록 조회 축', () => {
  it('기본 목록은 이 설비와 open 축으로 선다', async () => {
    const { recorded } = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });

    const [first] = listUrls(recorded.urls);
    expect(first).toContain('open=true');
    expect(first).toContain(`plannedEquipmentId=${String(EQUIPMENT_ID)}`);
    /* ⛔ 확정된 적 없는 상태 문자열을 조회 조건으로 싣지 않는다. */
    expect(first).not.toContain('statusCode=');
  });

  it('「전체 보기」는 설비 축만 뺀다', async () => {
    const { user, recorded } = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await user.click(screen.getByRole('button', { name: t.list.showAll }));

    await waitFor(() => {
      expect(listUrls(recorded.urls).length).toBeGreaterThan(1);
    });

    const last = listUrls(recorded.urls).at(-1) ?? '';
    expect(last).toContain('open=true');
    expect(last).not.toContain('plannedEquipmentId');
  });

  /** ⚠ 설비를 모르는 것은 「지시가 없다」와 다른 사실이다. */
  it('설비를 못 받으면 기본 목록을 묻지 않고 사유를 보인다', async () => {
    const { recorded } = renderScreen({ terminalStatus: 500 });

    expect(await screen.findByText(t.list.equipmentUnknown)).toBeInTheDocument();
    expect(screen.queryByText(t.list.empty)).not.toBeInTheDocument();
    expect(listUrls(recorded.urls)).toHaveLength(0);
  });

  it('빈 목록은 오류가 아니라 다음 행동과 함께 보인다', async () => {
    renderScreen({ workOrders: [] });

    expect(await screen.findByText(t.list.empty)).toBeInTheDocument();
    expect(screen.queryByText(t.list.loadError)).not.toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 사번', () => {
  it('확인 전에는 고를 수 없고 푸는 방법을 말한다', async () => {
    const { user } = renderScreen();

    const card = await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    expect(screen.getByText(t.worker.required)).toBeInTheDocument();

    await user.click(card);

    expect(screen.getByText(t.selection.notSelected)).toBeInTheDocument();
  });

  it('미등록과 퇴사를 다른 문구로 가른다', async () => {
    const { user } = renderScreen({ workers: [] });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.unknown)).toBeInTheDocument();
  });

  it('퇴사한 사번은 「재직 중이 아니다」로 말한다', async () => {
    const { user } = renderScreen({ workers: [{ ...WORKER, isActive: false }] });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.inactive)).toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 세션 열기', () => {
  const openStart = async () => {
    const rendered = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    return rendered;
  };

  it('사번·지시·게이팅이 모두 서면 시작이 열린다', async () => {
    await openStart();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
  });

  /**
   * ⛔ 통지 #563 · omf-mes#271 — 단말·작업자·교대는 본문이 아니라 서버가 푼다. 선택으로도
   * 남기지 않는다.
   */
  it('본문에 단말·작업자·교대를 싣지 않고 사번은 헤더로 보낸다', async () => {
    const { user, recorded } = await openStart();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await user.click(startButton());

    await waitFor(() => {
      expect(recorded.bodies).toHaveLength(1);
    });

    const sent = recorded.bodies[0];
    if (sent === undefined) throw new Error('요청이 기록되지 않았습니다.');

    expect(sent.url).toBe('/production/work-sessions');

    const body = sent.body as Record<string, unknown>;
    expect(body.workOrderId).toBe(WORK_ORDER.workOrderId);
    expect(body.equipmentId).toBe(EQUIPMENT_ID);
    expect(body).not.toHaveProperty('terminalId');
    expect(body).not.toHaveProperty('workerId');
    expect(body).not.toHaveProperty('workerIds');
    expect(body).not.toHaveProperty('shiftId');

    expect(sent.headers['x-worker-no']).toBe(WORKER.workerNo);
    expect(sent.headers['idempotency-key']).toBeTruthy();
  });

  it('시작하면 그 사실을 작업지시 번호와 함께 알린다', async () => {
    const { user } = await openStart();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await user.click(startButton());

    expect(await screen.findByText(t.result.started(WORK_ORDER.workOrderNo))).toBeInTheDocument();
  });

  /** ⛔ §6 — 이미 진행 중인 세션이 있으면 새로 열지 않는다. 서버의 거절을 기다리지 않는다. */
  it('열린 세션이 이미 있으면 새로 시작하지 않는다', async () => {
    const rendered = renderScreen({
      openSessions: [
        {
          workSessionId: 9801,
          workOrderId: WORK_ORDER.workOrderId,
          sessionNo: 1,
          terminalId: 9101,
          startedAt: '2026-09-02T08:10:00+09:00',
          statusCode: 'SYN_RUNNING',
        },
      ],
    });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    expect(await screen.findByText(t.blocked.alreadyOpen)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });
});

describe('P-02-01 작업 시작 — 오프라인', () => {
  /**
   * ⛔ 이 화면은 오프라인에서 **거부한다**(§6-1 · 통지 #556) — 큐에 담지 않는다. 회색 버튼만
   * 두지 않고 사유와 다음 행동을 함께 보인다(G-3).
   */
  it('연결이 끊기면 거부하고 사유·다음 행동을 함께 보인다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const rendered = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);

    expect(await screen.findByText(t.blocked.offline)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });
});

describe('P-02-01 작업 시작 — 계획 밖 설비', () => {
  /** ⚠ §8 미결 5 — 경고만 하고 막지 않는다. 실제 설비는 세션에 남아 사후 추적된다. */
  it('계획 설비가 다르면 경고하되 시작을 막지 않는다', async () => {
    const rendered = renderScreen({
      workOrders: [{ ...WORK_ORDER, plannedEquipmentId: EQUIPMENT_ID + 7 }],
    });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    expect(
      await screen.findByText(t.selection.otherEquipment(`#${String(EQUIPMENT_ID + 7)}`)),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
  });

  /** ⛔ 계획 설비가 비어 있으면(긴급 W/O) 채울 값이 없으므로 경고하지 않는다. */
  it('계획 설비가 비어 있으면 경고하지 않는다', async () => {
    const { plannedEquipmentId: _ignored, ...withoutEquipment } = WORK_ORDER;
    const rendered = renderScreen({ workOrders: [withoutEquipment] });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    expect(
      screen.queryByText(t.selection.otherEquipment(t.selection.none)),
    ).not.toBeInTheDocument();
  });
});

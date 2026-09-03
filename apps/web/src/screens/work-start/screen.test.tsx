import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setWorkerSession } from '../../patterns/worker-session';
import {
  EQUIPMENT_ID,
  IDENTITY,
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

/* 단말이 들고 있는 사번은 화면 밖 «단일 자리»다 — 감지기가 서로의 상태 위에서 서지 않게 한다. */
beforeEach(() => {
  setWorkerSession(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  /* 단말이 들고 있는 사번은 화면 밖 «단일 자리»다 — 감지기 사이에 새면 다음 것이 이미 선 채로 시작한다. */
  setWorkerSession(null);
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

  /**
   * ⚠ **버튼 이름만으로는 무엇이 열리는지 읽히지 않는다**(사용자 확인 실측 · 2026-09-02).
   * 지금 목록이 어느 범위인지, 누르면 무엇이 늘어나는지를 화면이 말해야 한다.
   */
  it('지금 목록이 어느 범위인지 글로 말하고, 범위를 바꾸면 그 글도 바뀐다', async () => {
    const { user } = renderScreen();

    expect(await screen.findByText(t.list.scopeNoteEquipment)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.list.showAll }));

    expect(await screen.findByText(t.list.scopeNoteAll)).toBeInTheDocument();
    expect(screen.queryByText(t.list.scopeNoteEquipment)).not.toBeInTheDocument();
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

  /**
   * ⛔ **못 누르는 것이 컨트롤 «자신»에도 적혀 있어야 한다.** 사유 배너는 눈으로 보는
   * 사람에게만 닿는다 — 키보드·스크린리더로 이 줄에 닿은 사람은 「눌리는 버튼」으로
   * 읽고 눌러 본 뒤에야 아무 일도 없다는 것을 안다.
   */
  it('확인 전 목록 카드는 잠긴 상태로 읽힌다', async () => {
    renderScreen();

    const card = await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });

    /* ⚠ 디자인 시스템의 카드는 `div[role=button]` 이라 `toBeDisabled` 가 서지 않는다 — 속성으로 잰다. */
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card).toHaveAttribute('tabindex', '-1');
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

describe('P-02-01 작업 시작 — 사번 조회가 실패했을 때', () => {
  /**
   * ⛔ **「다시 시도해 주세요」라고 적었으면 수단이 있어야 한다.** 이 저장소는 자동 재조회를
   * 꺼 두었고, 같은 사번을 다시 제출해도 값이 같아 조회가 다시 일어나지 않는다 — 버튼이
   * 없으면 사번을 못 넣고, 사번이 없으면 이 화면의 모든 것이 막혀 단말을 새로 켜야 한다.
   */
  it('실패 문구와 함께 다시 시도할 경로를 준다', async () => {
    const { user } = renderScreen({ workersStatus: 500 });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.lookupFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.worker.retry })).toBeInTheDocument();
  });

  it('「다시 시도」가 실제로 다시 묻고, 이번에 성공하면 그 사번으로 선다', async () => {
    const { user } = renderScreen({ workersFailFirst: true });

    await enterWorkerNo(user, WORKER.workerNo);
    await user.click(await screen.findByRole('button', { name: t.worker.retry }));

    expect(await screen.findAllByText(t.header.workerLabel(WORKER.workerNo))).not.toHaveLength(0);
  });

  /** ⛔ 미등록·퇴사는 다시 물어도 답이 같다 — 없는 사람을 계속 찾게 하지 않는다. */
  it('미등록 사번에는 「다시 시도」를 주지 않는다', async () => {
    const { user } = renderScreen({ workers: [] });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.unknown)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.worker.retry })).not.toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 사번을 바꿀 수 있는 자리인가', () => {
  /**
   * ⛔ **눌러도 아무 일이 없는 버튼을 세우지 않는다.** 단말 토큰이 정한 사번(`pop-identity`)은
   * 이 화면이 비워도 그대로 돌아온다 — 「다시 입력」이 영구 무동작이 된다.
   */
  it('단말 토큰이 사번을 들고 있으면 「다시 입력」을 주지 않는다', async () => {
    renderScreen({ identity: { ...IDENTITY, workerNo: WORKER.workerNo } });

    expect(await screen.findAllByText(t.header.workerLabel(WORKER.workerNo))).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: t.worker.change })).not.toBeInTheDocument();
  });

  /** 화면에서 넣은 사번은 화면에서 바꿀 수 있다 — 교대할 때 필요하다. */
  it('여기서 확인한 사번에는 「다시 입력」을 준다', async () => {
    const { user } = renderScreen();

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByRole('button', { name: t.worker.change })).toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 사번은 단말이 들고 있는 자리를 쓴다', () => {
  /**
   * ⭐ **두 벌을 만들지 않는다.** 사번 경량 인증(`P-CO-01`)이 정한 값이 `worker-session` 에
   * 있고, 이 화면은 그 자리를 읽는다 — 지나온 작업자에게 같은 것을 두 번 묻지 않는다.
   */
  it('이미 지정된 사번이 있으면 키패드를 보이지 않고 그 사번으로 선다', async () => {
    setWorkerSession({
      worker: WORKER,
      assignedAt: '2026-09-02 09:00',
      isOtherPlant: false,
    } as never);

    renderScreen();

    /* 머리띠와 ① 구획 둘 다 사번을 말한다 — 「하나만 있어야 한다」가 아니라 「선다」를 잰다. */
    expect(await screen.findAllByText(t.header.workerLabel(WORKER.workerNo))).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: t.worker.confirm })).not.toBeInTheDocument();
  });

  /**
   * 이 화면에서 확인한 사번도 같은 자리에 넣는다 — 다음 화면이 이어받는다.
   *
   * ⭐ **화면을 지웠다 다시 세워 확인한다.** 값이 화면 «안»에 있으면 지우는 순간 사라진다 —
   * 다시 세운 화면이 그 사번으로 서면 그 자리는 화면 밖이라는 뜻이다.
   */
  it('여기서 확인한 사번을 단말이 들고 간다', async () => {
    const first = renderScreen();

    await enterWorkerNo(first.user, WORKER.workerNo);
    await screen.findAllByText(t.header.workerLabel(WORKER.workerNo));

    first.unmount();
    renderScreen();

    expect(await screen.findAllByText(t.header.workerLabel(WORKER.workerNo))).not.toHaveLength(0);
  });

  it('「다시 입력」은 단말이 들고 있던 사번을 비운다', async () => {
    const { user } = renderScreen();

    await enterWorkerNo(user, WORKER.workerNo);
    await user.click(await screen.findByRole('button', { name: t.worker.change }));

    expect(screen.getByText(t.header.workerUnset)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.worker.confirm })).toBeInTheDocument();
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

  /**
   * ⛔ **되돌릴 수 없는 쓰기라 재시도가 같은 키로 나가야 한다.** 멱등 키는 본문의 지문에
   * 매이는데, 시각을 누를 때마다 새로 만들면 **지문이 달라져 새 키가 발급된다** — 통신이
   * 끊긴 뒤 다시 누르면 서버가 다른 쓰기로 보고 세션을 두 번 연다.
   */
  it('실패한 뒤 다시 눌러도 같은 멱등 키로 나간다', async () => {
    /*
     * ⚠ **시계를 움직여야 재진다.** 단말 시각은 초 단위라, 두 번의 누름이 같은 초 안에 들면
     *    결함이 있어도 값이 우연히 같아진다 — 감지기가 조용히 통과한다(실측). 실제 재시도는
     *    사람이 오류를 읽고 누르는 것이라 초를 넘긴다.
     */
    let seconds = 1;
    vi.spyOn(Date.prototype, 'getSeconds').mockImplementation(() => seconds);

    const rendered = renderScreen({ startStatus: 500 });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });

    await rendered.user.click(startButton());
    await screen.findByText(t.result.startFailed);

    seconds = 9;
    await rendered.user.click(startButton());

    await waitFor(() => {
      expect(rendered.recorded.bodies).toHaveLength(2);
    });

    const [first, second] = rendered.recorded.bodies;
    if (first === undefined || second === undefined) throw new Error('두 번 나가지 않았습니다.');

    expect(second.headers['idempotency-key']).toBe(first.headers['idempotency-key']);
    /* 시각도 함께 얼어 있어야 한다 — 이것이 달라지면 지문이 달라진다. */
    expect((second.body as Record<string, unknown>).startedAt).toBe(
      (first.body as Record<string, unknown>).startedAt,
    );
  });

  /**
   * 다른 지시를 고르면 다른 쓰기다 — 붙들고 있던 시각과 키를 버린다.
   *
   * ⚠ **시계를 얼려 놓고 잰다.** 본문에는 `workOrderId` 도 실려 지시만 바꿔도 지문이 달라진다 —
   *    시각을 움직이게 두면 「시각을 버렸는가」를 재지 못하고 감지기가 조용히 통과한다(실측).
   */
  it('다른 작업지시를 고르면 새 멱등 키로 나가고 시각도 새로 잡는다', async () => {
    let seconds = 1;
    vi.spyOn(Date.prototype, 'getSeconds').mockImplementation(() => seconds);

    const other = {
      ...WORK_ORDER,
      workOrderId: WORK_ORDER.workOrderId + 1,
      workOrderNo: 'SYN-WO-0102',
    };
    const rendered = renderScreen({ startStatus: 500, workOrders: [WORK_ORDER, other] });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());
    await screen.findByText(t.result.startFailed);

    seconds = 9;
    await rendered.user.click(screen.getByRole('button', { name: selectName(other.workOrderNo) }));
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    await waitFor(() => {
      expect(rendered.recorded.bodies).toHaveLength(2);
    });

    const [first, second] = rendered.recorded.bodies;
    if (first === undefined || second === undefined) throw new Error('두 번 나가지 않았습니다.');

    expect(second.headers['idempotency-key']).not.toBe(first.headers['idempotency-key']);
    /* ⭐ 이 줄이 「시각을 버렸는가」를 잰다 — 위 키 비교만으로는 지시 번호 때문에 늘 통과한다. */
    expect((second.body as Record<string, unknown>).startedAt).not.toBe(
      (first.body as Record<string, unknown>).startedAt,
    );
  });

  /** 시작이 실패하면 그 사실을 말한다 — 조용히 아무 일도 없던 것처럼 두지 않는다. */
  it('시작이 실패하면 사유를 보인다', async () => {
    const rendered = renderScreen({ startStatus: 500 });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    expect(await screen.findByText(t.result.startFailed)).toBeInTheDocument();
  });

  /** ⛔ 409 를 「진행 중」으로 읽지 않는다 — 계약이 그 응답을 「충돌」로만 적었다. */
  it('충돌(409)은 상태가 바뀌었다고만 말한다', async () => {
    const rendered = renderScreen({ startStatus: 409 });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    expect(await screen.findByText(t.result.conflict)).toBeInTheDocument();
    expect(screen.queryByText(t.result.startFailed)).not.toBeInTheDocument();
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

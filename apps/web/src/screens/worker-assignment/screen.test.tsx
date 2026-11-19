import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { WorkerAssignmentScreen } from './screen';
import type { WorkerResponse } from './verify';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { PopRegistrationProvider } from '../../patterns/pop-registration';
import { setWorkerSession } from '../../patterns/worker-session';

const t = messages.workerAssignment;

/**
 * 현재 작업자는 **화면 밖 단일 자리**에 있다(§5-4). 시험 사이에 비우지 않으면 앞 시험이
 * 지정한 사람이 다음 시험에 남는다 — 실제로 새어 두 건이 깨졌다.
 */
afterEach(() => {
  setWorkerSession(null);
});

const workerOf = (over: Partial<WorkerResponse> = {}): WorkerResponse => ({
  workerId: 1001,
  workerNo: '900028',
  workerName: '김작업',
  businessUnitId: 1,
  plantId: 10,
  statusCode: 'ACTIVE',
  isActive: true,
  ...over,
});

/** 제품 버튼의 실제 이동 결과를 라우터 위치로 확인한다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output aria-label="현재 경로">{location.pathname}</output>;
};

const renderScreen = (items: WorkerResponse[] = [workerOf()]) => {
  const queries: URL[] = [];

  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/mdm/workers',
      respond: (request) => {
        queries.push(new URL(request.url));
        return jsonResponse({ items, page: { page: 1, size: 2, total: items.length } });
      },
    },
  ]);

  /*
   * ⭐ **등록 공급자를 함께 세운다**(#999). 이 화면은 재등록으로 들어가는 유일한 입구라
   *    등록 상태를 읽는다 — 셸에서는 언제나 그 안에 서므로, 시험도 같은 조합으로 잰다.
   *    공급자는 스스로 요청을 내지 않아 이 시험들이 보는 요청 수는 달라지지 않는다.
   */
  renderWithProviders(
    <PopRegistrationProvider>
      <WorkerAssignmentScreen />
      <LocationProbe />
    </PopRegistrationProvider>,
    { fetch, route: '/pop/worker-assignment' },
  );

  return { queries };
};

/** 키패드로 사번을 친다 — 이 화면에는 손으로 칠 수 있는 입력칸이 없다. */
const typeWorkerNo = async (digits: string) => {
  const keypad = screen.getByRole('group', { name: messages.popUniform.keypad.region });

  for (const digit of digits) {
    await userEvent.click(within(keypad).getByRole('button', { name: digit }));
  }
};

describe('WorkerAssignmentScreen — 인증이 아니라 귀속', () => {
  /*
   * ⛔ 비밀번호 칸이 없다. 그것이 이 화면의 요점이다(§5-1) — 있으면 「로그인 생략」 요구를
   * 우회로 되살리는 것이고 담을 자리도 없다.
   */
  it('비밀번호 칸을 두지 않는다', () => {
    renderScreen();

    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('사번을 치기 전에는 확인이 눌리지 않는다', () => {
    renderScreen();

    expect(screen.getByRole('button', { name: t.input.submit })).toBeDisabled();
  });

  /* 사용자 지시(2026-11-17 · omf-all-around#288) — 6자리 숫자가 아니면 [사번 확인]을 눌렀을 때 안내하고 조회하지 않는다. */
  it('6자리 숫자가 아니면 확인을 눌렀을 때 다시 입력하라고 안내한다', async () => {
    renderScreen();

    await typeWorkerNo('90028');
    expect(screen.queryByText(t.input.unusual)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText(t.input.unusual)).toBeInTheDocument();
    expect(screen.queryByText('김작업')).not.toBeInTheDocument();
  });
});

describe('WorkerAssignmentScreen — 확인', () => {
  /* ⭐ 정확 일치로 묻고, 퇴사자와 미등록을 가르려고 재직자만 받지 않는다. */
  it('사번 정확 일치로 묻고 비재직도 함께 받는다', async () => {
    const { queries } = renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    await waitFor(() => expect(queries).toHaveLength(1));

    expect(queries[0]?.searchParams.get('workerNo')).toBe('900028');
    expect(queries[0]?.searchParams.get('includeInactive')).toBe('true');
  });

  it('확인하면 현재 작업자로 지정한다', async () => {
    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText('김작업')).toBeInTheDocument();
  });

  /* ⛔ 입력값을 문구에 담는다 — 오타를 눈으로 확인할 수 있어야 한다. */
  it('미등록이면 입력한 사번을 문구에 담는다', async () => {
    renderScreen([]);

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText(t.error.unknown)).toBeInTheDocument();
  });

  /* 미등록과 비재직은 사용자가 할 일이 다르다 — 문구를 뭉치지 않는다. */
  it('비재직이면 거부하고 다른 문구를 낸다', async () => {
    renderScreen([workerOf({ isActive: false })]);

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText(t.error.inactive)).toBeInTheDocument();
    expect(screen.queryByText('김작업')).not.toBeInTheDocument();
  });
});

describe('WorkerAssignmentScreen — 현재 작업자', () => {
  /* 시안(omf-all-around#288) — 작업자가 없을 때는 단추 없이 안내만 선다. */
  it('작업자가 없으면 변경·이동 단추를 세우지 않는다', () => {
    renderScreen();

    expect(screen.queryByRole('button', { name: t.current.shift })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.current.toWork })).not.toBeInTheDocument();
    expect(screen.getByText(t.current.noneHelp)).toBeInTheDocument();
  });

  /* 시안(omf-all-around#288) — 확인 후에는 칸에 확인된 사번만 남고 키패드·확인 단추를 접는다. */
  it('확인 후에는 사번 칸만 남고 키패드를 접는다', async () => {
    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    expect(screen.getByLabelText(t.input.workerNo)).toHaveValue('900028');
    expect(screen.getByLabelText(t.input.workerNo)).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: t.input.submit })).not.toBeInTheDocument();
    expect(screen.getByText(t.current.confirmed)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.current.shift }));

    expect(screen.getByLabelText(t.input.workerNo)).toHaveValue('');
    expect(screen.getByRole('button', { name: t.input.submit })).toBeInTheDocument();
  });

  it('사번을 확인해도 홈으로 넘기지 않고 이 화면에서 확인 완료를 보인다(로그인 시안)', async () => {
    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText(t.current.confirmed)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent(
      '/pop/worker-assignment',
    );
  });

  it('다른 공장 소속이면 홈으로 넘기지 않고 경고를 보인다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/workers',
        respond: () =>
          jsonResponse({
            items: [workerOf({ plantId: 20 })],
            page: { page: 1, size: 2, total: 1 },
          }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/terminals/7',
        respond: () =>
          jsonResponse({
            terminalId: 7,
            terminalCode: 'POP-07',
            plantId: 10,
            terminalTypeCode: 'POP',
            equipmentId: null,
            equipmentCode: null,
            equipmentName: null,
            isActive: true,
          }),
      },
    ]);
    renderWithProviders(
      <PopRegistrationProvider>
        <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, terminalId: 7 }}>
          <WorkerAssignmentScreen />
          <LocationProbe />
        </PopIdentityProvider>
      </PopRegistrationProvider>,
      { fetch, route: '/pop/worker-assignment' },
    );

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText(t.current.otherPlant)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent(
      '/pop/worker-assignment',
    );
  });

  it('제품 모드에서 현재 작업자가 있으면 홈으로 이동한다(#291)', async () => {
    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    await userEvent.click(screen.getByRole('button', { name: t.current.toWork }));

    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent('/pop/home');
  });

  it('교대하면 현재 작업자가 비워진다', async () => {
    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    await userEvent.click(screen.getByRole('button', { name: t.current.shift }));

    expect(screen.queryByText('김작업')).not.toBeInTheDocument();
    expect(screen.getByText(t.current.none)).toBeInTheDocument();
  });
});

/**
 * 헤더 — 스펙 §3 도면이 세 조각을 세운다: 제품 이름 · 단말(코드·설치 위치) · 연결 상태.
 * 현장 단말은 이 화면 하나만 띄운 채 하루를 나므로 셋 다 이 줄에서만 알 수 있다.
 */
describe('헤더', () => {
  it('제품 이름·단말·연결 상태를 세운다', async () => {
    renderScreen();

    const header = await screen.findByRole('region', { name: t.header.label });

    expect(within(header).getByText(t.header.brand)).toBeInTheDocument();
    expect(within(header).getByText(t.header.online)).toBeInTheDocument();
    /*
     * ⚠ 단말을 지목할 값이 없어 코드가 서지 않는다 — 지어내지 않고 없음 표시를 낸다.
     *
     * ⛔ **`단말` 만으로 찾지 않는다.** 머리줄에는 [단말 재등록] 도 서 있어 「단말」 을
     *    품은 글이 둘이다 — 값까지 함께 재야 «단말 줄» 을 집는다.
     */
    expect(within(header).getByText(messages.popChrome.header.terminalUnknown)).toBeInTheDocument();
  });

  /* 사용자 지시(2026-11-19) — 본문 정보 띠 대신 맨 위 줄에 단말·설비 칩(다른 POP 화면과 같은 문구). */
  it('단말에 붙은 설비를 머리줄 칩으로 보이고, 설비가 없으면 세우지 않는다', async () => {
    renderWithProviders(
      <PopRegistrationProvider>
        <PopIdentityProvider
          value={{
            ...UNKNOWN_POP_IDENTITY,
            equipment: { equipmentId: 5, equipmentCode: 'EQ-05', equipmentName: '조립기 1호기' },
          }}
        >
          <WorkerAssignmentScreen />
        </PopIdentityProvider>
      </PopRegistrationProvider>,
      { fetch: createStubFetch([]), route: '/pop/worker-assignment' },
    );

    const header = await screen.findByRole('region', { name: t.header.label });

    expect(
      within(header).getByText(messages.popChrome.header.equipmentLabel('EQ-05', '조립기 1호기')),
    ).toBeInTheDocument();
  });

  it('설비가 없는 단말이면 설비 칩이 없다', async () => {
    renderScreen();

    const header = await screen.findByRole('region', { name: t.header.label });

    expect(within(header).queryByText(/^설비 /u)).not.toBeInTheDocument();
  });
});

/**
 * 지정 시각 — **현지 시간이어야 한다.** 세계 표준시로 내면 한국에서 오전 9시에 지정해도
 * 「00:00」으로 보여, 「언제부터 이 사번으로 남는가」를 알리는 칸이 아홉 시간 어긋난다.
 * 값을 되돌려도 우는 시험이 없던 자리다.
 */
describe('지정 시각', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('세계 표준시가 아니라 단말이 놓인 곳의 시간으로 낸다', async () => {
    /* 한국이면 이 순간이 09:00 이고, 세계 표준시로는 00:00 이다. */
    vi.useFakeTimers({ now: new Date('2026-09-01T00:00:00Z'), shouldAdvanceTime: true });

    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    const shown = screen.getByText(t.current.assignedAt).nextElementSibling?.textContent ?? '';
    const local = new Date('2026-09-01T00:00:00Z').toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    expect(shown).toContain(local);
  });
});

/**
 * 터치 규격 — 시안(#295 로그인)은 사번 키패드 키와 [사번 확인]을 공통 키(56)보다 큰 **64px** 로
 * 그렸다. 크기는 이 화면 모양(`uniform.css` 의 `.wa-pad`)이 주므로, jsdom 에서 픽셀 대신
 * **그 자리에 서는지**를 잰다 — 자리를 벗어나면 키가 공통 크기로 조용히 줄어든다.
 */
describe('터치 규격', () => {
  it('키패드 키와 확인 버튼이 큰 터치 자리에 선다', async () => {
    renderScreen();

    const keypad = await screen.findByRole('group', { name: messages.popUniform.keypad.region });
    const submit = screen.getByRole('button', { name: t.input.submit });

    expect(within(keypad).getByRole('button', { name: '1' }).closest('.wa-pad')).not.toBeNull();
    expect(submit.closest('.wa-pad')).not.toBeNull();
    expect(submit).toHaveClass('wa-submit');
  });
});

/**
 * 오프라인 갈래 — 스펙 §5-6·§6. **감지기가 없으면 이 갈래를 통째로 지워도 아무도 울지
 * 않는다.** 오프라인은 현장에서 실제로 일어나는 조건이고, 여기서 막히면 작업이 선다.
 */
describe('오프라인', () => {
  const goOffline = () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  };

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { pop?: unknown }).pop;
  });

  it('헤더가 오프라인이라고 밝힌다', async () => {
    goOffline();
    renderScreen();

    expect(await screen.findByText(t.header.offline)).toBeInTheDocument();
  });

  /** ⛔ C-11 — 확인할 근거가 없으면 통과시키지 않는다. */
  it('미리 받아 둔 목록이 없으면 확인이 서지 않는다', async () => {
    goOffline();
    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText(t.error.noDirectory)).toBeInTheDocument();
  });

  /**
   * ⛔ **확인 도중에 연결이 돌아와도 경로를 갈아타지 않는다.** 갈아타면 화면은 「미리 받아
   * 둔 목록으로 확인합니다」라고 말해 놓고 서버에서 답을 가져온다 — 실기에서 확인을 누른
   * 직후 연결이 돌아오는 순간 「등록되지 않은 사번입니다」가 뜨는 것을 잡았다.
   */
  it('확인 중에 연결이 돌아와도 미리 받아 둔 목록으로 끝낸다', async () => {
    goOffline();
    (globalThis as { pop?: unknown }).pop = {
      cache: {
        /* 캐시 응답을 늦춘다 — 확인이 끝나기 전에 연결이 돌아오는 상황이다. */
        get: () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(JSON.stringify([workerOf()]));
            }, 50);
          }),
        put: () => Promise.resolve(),
      },
      outbox: { size: () => Promise.resolve(0) },
    };

    /*
     * ⭐ **서버는 «다른» 사람을 돌려준다.** 캐시와 서버가 같은 답을 주면 경로를 갈아타도
     * 결과가 같아, 갈아탔다는 사실 자체를 잴 수 없다 — 실제로 그래서 감지기가 무효했다.
     */
    renderScreen([workerOf({ workerNo: '900777', workerName: '다른사람' })]);

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    /* 확인이 아직 진행 중일 때 연결이 돌아온다. */
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));

    expect(await screen.findByText('김작업')).toBeInTheDocument();
    expect(screen.queryByText(t.error.unknown)).not.toBeInTheDocument();
  });

  /** ⭐ 오프라인이어도 **막지 않는다** — 미리 받아 둔 목록으로 확인한다. */
  it('미리 받아 둔 목록으로 작업자를 지정한다', async () => {
    goOffline();
    (globalThis as { pop?: unknown }).pop = {
      cache: {
        get: () => Promise.resolve(JSON.stringify([workerOf()])),
        put: () => Promise.resolve(),
      },
      outbox: { size: () => Promise.resolve(0) },
    };

    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));

    expect(await screen.findByText('김작업')).toBeInTheDocument();
  });
});

/**
 * 귀속은 **화면을 벗어나도 남는다**(§5-4 「단말 재시작으로만 사라진다」). 화면 지역 상태에
 * 두면 다른 화면으로 넘어가는 순간 날아간다 — 그 회귀를 잡는 자리다.
 */
describe('귀속 보관', () => {
  afterEach(() => {
    setWorkerSession(null);
  });

  it('화면을 떠났다 돌아와도 현재 작업자가 남아 있다', async () => {
    setWorkerSession({
      worker: workerOf(),
      assignedAt: '2026-09-01 09:00',
      isOtherPlant: false,
    });

    renderScreen();

    expect(await screen.findByText('김작업')).toBeInTheDocument();
  });
});

/**
 * 셸 통로가 **실패할 때** — 아무도 받지 않는 오류로 새면 안 된다. 새면 다음 오프라인 확인이
 * 근거 없이 막히는데 그 이유가 어디에도 남지 않는다.
 */
describe('셸 통로 실패', () => {
  afterEach(() => {
    delete (globalThis as { pop?: unknown }).pop;
  });

  it('큐를 세지 못해도 교대가 막히지 않는다', async () => {
    (globalThis as { pop?: unknown }).pop = {
      cache: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.reject(new Error('실패')),
      },
      outbox: { size: () => Promise.reject(new Error('실패')) },
    };

    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    await userEvent.click(screen.getByRole('button', { name: t.current.shift }));

    /* 교대는 이루어지고, 세지 못했으니 경고는 내지 않는다. */
    expect(await screen.findByText(t.current.none)).toBeInTheDocument();
    expect(screen.queryByText(t.current.pendingQueue(3))).not.toBeInTheDocument();
  });
});

/** 교대 경고 — 스펙 §6. ⛔ 큐의 사번을 바꾸지 않고 **세어서 알리기만** 한다. */
describe('교대', () => {
  afterEach(() => {
    delete (globalThis as { pop?: unknown }).pop;
  });

  it('보내지 못한 기록이 있으면 교대할 때 알린다', async () => {
    (globalThis as { pop?: unknown }).pop = {
      cache: { get: () => Promise.resolve(undefined), put: () => Promise.resolve() },
      outbox: { size: () => Promise.resolve(3) },
    };

    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    await userEvent.click(screen.getByRole('button', { name: t.current.shift }));

    expect(await screen.findByText(t.current.pendingQueue(3))).toBeInTheDocument();
  });

  /** ⛔ 교대라는 «사건»에 붙는 경고다 — 새 사람 카드 아래에 이전 사람 이야기가 남으면 안 된다. */
  it('새 작업자가 정해지면 이전 큐 경고를 내린다', async () => {
    (globalThis as { pop?: unknown }).pop = {
      cache: { get: () => Promise.resolve(undefined), put: () => Promise.resolve() },
      outbox: { size: () => Promise.resolve(3) },
    };

    renderScreen();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    await userEvent.click(screen.getByRole('button', { name: t.current.shift }));
    await screen.findByText(t.current.pendingQueue(3));

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: t.input.submit }));
    await screen.findByText('김작업');

    expect(screen.queryByText(t.current.pendingQueue(3))).not.toBeInTheDocument();
  });
});

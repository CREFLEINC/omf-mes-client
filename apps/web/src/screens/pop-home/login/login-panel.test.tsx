import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PopLoginDialog } from './login-panel';
import type { WorkerResponse } from './verify';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../../patterns/pop-identity';
import { PopRegistrationProvider } from '../../../patterns/pop-registration';
import { setWorkerSession, useWorkerSession } from '../../../patterns/worker-session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../../test/api-harness';

/** 창을 닫은 횟수 — 확인이 끝나면 창이 닫힌다. */
const closed = vi.fn();

/*
 * 사번 입력 창(맨 위 줄 [로그인] · omf-all-around#334) — 옛 사번 입력 화면(P-CO-01)의 확인 방식을 그대로 옮겼다.
 * 확인이 끝나면 홈이 현재 작업자를 읽어 같은 자리에서 홈 내용으로 바뀐다 — 여기서는 단말의 현재 작업자
 * (`worker-session`)가 정해지는지를 본다.
 */

const t = messages.workerAssignment;

/** 현재 작업자는 화면 밖 단일 자리에 있다(§5-4) — 시험 사이에 비운다. */
afterEach(() => {
  setWorkerSession(null);
  closed.mockClear();
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

/** 단말의 현재 작업자와 주소 — 확인 결과를 화면 밖 자리에서 읽는다. */
const Probe = () => {
  const session = useWorkerSession();
  const location = useLocation();

  return (
    <>
      <output aria-label="현재 작업자">{session?.worker.workerName ?? ''}</output>
      <output aria-label="지정 시각">{session?.assignedAt ?? ''}</output>
      <output aria-label="다른 공장">{String(session?.isOtherPlant ?? '')}</output>
      <output aria-label="현재 경로">{location.pathname}</output>
    </>
  );
};

const workersRoute = (items: WorkerResponse[], queries: URL[] = []) => ({
  match: (request: Request) => new URL(request.url).pathname === '/mdm/workers',
  respond: (request: Request) => {
    queries.push(new URL(request.url));
    return jsonResponse({ items, page: { page: 1, size: 2, total: items.length } });
  },
});

const renderLogin = (items: WorkerResponse[] = [workerOf()]) => {
  const queries: URL[] = [];

  renderWithProviders(
    <PopRegistrationProvider>
      <PopLoginDialog onClose={closed} />
      <Probe />
    </PopRegistrationProvider>,
    { fetch: createStubFetch([workersRoute(items, queries)]), route: '/pop/home' },
  );

  return { queries };
};

const current = () => screen.getByRole('status', { name: '현재 작업자' });

/** 키패드로 사번을 친다. */
const typeWorkerNo = async (digits: string) => {
  const keypad = screen.getByRole('group', { name: messages.popUniform.keypad.region });

  for (const digit of digits) {
    await userEvent.click(within(keypad).getByRole('button', { name: digit }));
  }
};

const submit = () => userEvent.click(screen.getByRole('button', { name: t.input.submit }));

describe('홈 사번 입력 — 인증이 아니라 귀속', () => {
  it('비밀번호 칸을 두지 않는다', () => {
    renderLogin();

    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('사번 칸은 이름이 위에 서고 안내 글(placeholder)이 없다', () => {
    renderLogin();

    const input = screen.getByLabelText(t.input.workerNo);
    expect(input).not.toHaveAttribute('placeholder');
  });

  it('사번을 치기 전에는 확인이 눌리지 않는다', () => {
    renderLogin();

    expect(screen.getByRole('button', { name: t.input.submit })).toBeDisabled();
  });

  /* 사용자 지시(2026-11-17 · omf-all-around#288) — 6자리 숫자가 아니면 조회하지 않고 다시 입력하게 한다. */
  it('6자리 숫자가 아니면 확인을 눌렀을 때 다시 입력하라고 안내한다', async () => {
    const { queries } = renderLogin();

    await typeWorkerNo('90028');
    expect(screen.queryByText(t.input.unusual)).not.toBeInTheDocument();

    await submit();

    expect(await screen.findByText(t.input.unusual)).toBeInTheDocument();
    expect(queries).toHaveLength(0);
  });
});

describe('홈 사번 입력 — 확인', () => {
  /* ⭐ 정확 일치로 묻고, 퇴사자와 미등록을 가르려고 재직자만 받지 않는다. */
  it('사번 정확 일치로 묻고 비재직도 함께 받는다', async () => {
    const { queries } = renderLogin();

    await typeWorkerNo('900028');
    await submit();

    await waitFor(() => expect(queries).toHaveLength(1));
    expect(queries[0]?.searchParams.get('workerNo')).toBe('900028');
    expect(queries[0]?.searchParams.get('includeInactive')).toBe('true');
  });

  it('확인하면 단말의 현재 작업자로 정하고 창을 닫는다(주소는 그대로)', async () => {
    renderLogin();

    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    await typeWorkerNo('900028');
    await submit();

    await waitFor(() => expect(current()).toHaveTextContent('김작업'));
    expect(closed).toHaveBeenCalledOnce();
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent('/pop/home');
  });

  it('[닫기]는 정하지 않고 창을 닫는다', async () => {
    renderLogin();

    await typeWorkerNo('900028');
    await userEvent.click(screen.getByRole('button', { name: messages.common.close }));

    expect(closed).toHaveBeenCalledOnce();
    expect(current()).toHaveTextContent('');
  });

  it('미등록이면 거부하고 미등록 문구를 낸다', async () => {
    renderLogin([]);

    await typeWorkerNo('900028');
    await submit();

    expect(await screen.findByText(t.error.unknown)).toBeInTheDocument();
    expect(current()).toHaveTextContent('');
    /* 실패는 창 안에 남는다. */
    expect(closed).not.toHaveBeenCalled();
  });

  /* 미등록과 비재직은 사용자가 할 일이 다르다 — 문구를 뭉치지 않는다. */
  it('비재직이면 거부하고 다른 문구를 낸다', async () => {
    renderLogin([workerOf({ isActive: false })]);

    await typeWorkerNo('900028');
    await submit();

    expect(await screen.findByText(t.error.inactive)).toBeInTheDocument();
    expect(current()).toHaveTextContent('');
  });

  /* ⚠ 다른 공장 소속은 막지 않는다(§6) — 정하되 표시가 남는다. */
  it('다른 공장 소속이어도 막지 않고 그 사실을 남긴다', async () => {
    renderWithProviders(
      <PopRegistrationProvider>
        <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, terminalId: 7 }}>
          <PopLoginDialog onClose={closed} />
          <Probe />
        </PopIdentityProvider>
      </PopRegistrationProvider>,
      {
        fetch: createStubFetch([
          workersRoute([workerOf({ plantId: 20 })]),
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
        ]),
        route: '/pop/home',
      },
    );

    await screen.findByRole('button', { name: t.input.submit });
    /* 단말 공장을 받은 뒤에 확인해야 비교가 선다. */
    await new Promise((resolve) => setTimeout(resolve, 50));
    await typeWorkerNo('900028');
    await submit();

    await waitFor(() => expect(current()).toHaveTextContent('김작업'));
    expect(screen.getByRole('status', { name: '다른 공장' })).toHaveTextContent('true');
  });
});

/** 지정 시각 — 세계 표준시가 아니라 단말이 놓인 곳의 시간이어야 한다. */
describe('지정 시각', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('세계 표준시가 아니라 단말이 놓인 곳의 시간으로 낸다', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-01T00:00:00Z'), shouldAdvanceTime: true });

    renderLogin();

    await typeWorkerNo('900028');
    await submit();
    await waitFor(() => expect(current()).toHaveTextContent('김작업'));

    const local = new Date('2026-09-01T00:00:00Z').toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    expect(screen.getByRole('status', { name: '지정 시각' })).toHaveTextContent(local);
  });
});

/** 터치 규격 — 시안(#295 로그인)은 사번 키패드 키와 [사번 확인]을 큰 터치 자리(64px)로 그렸다. */
describe('터치 규격', () => {
  it('키패드 키와 확인 버튼이 큰 터치 자리에 선다', async () => {
    renderLogin();

    const keypad = await screen.findByRole('group', { name: messages.popUniform.keypad.region });
    const button = screen.getByRole('button', { name: t.input.submit });

    expect(within(keypad).getByRole('button', { name: '1' }).closest('.wa-pad')).not.toBeNull();
    expect(button.closest('.wa-pad')).not.toBeNull();
    expect(button).toHaveClass('wa-submit');
  });
});

/** 단말 재등록은 맨 위 줄 [종료] 왼쪽에 있다(사용자 지시 2026-11-20 · #334) — 사번 입력 창에는 없다. */
describe('단말 재등록', () => {
  it('사번 입력 창에 [단말 재등록]을 두지 않는다', () => {
    renderLogin();

    expect(screen.queryByRole('button', { name: t.registration.reRegister })).toBeNull();
  });
});

/** 오프라인 갈래 — 스펙 §5-6·§6. 오프라인은 현장에서 실제로 일어나는 조건이다. */
describe('오프라인', () => {
  const goOffline = () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  };

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { pop?: unknown }).pop;
  });

  it('오프라인이면 미리 받아 둔 목록으로 확인한다고 알린다', async () => {
    goOffline();
    renderLogin();

    expect(await screen.findByText(t.offline.note)).toBeInTheDocument();
  });

  /** ⛔ C-11 — 확인할 근거가 없으면 통과시키지 않는다. */
  it('미리 받아 둔 목록이 없으면 확인이 서지 않는다', async () => {
    goOffline();
    renderLogin();

    await typeWorkerNo('900028');
    await submit();

    expect(await screen.findByText(t.error.noDirectory)).toBeInTheDocument();
  });

  /** ⛔ 확인 도중에 연결이 돌아와도 경로를 갈아타지 않는다. */
  it('확인 중에 연결이 돌아와도 미리 받아 둔 목록으로 끝낸다', async () => {
    goOffline();
    (globalThis as { pop?: unknown }).pop = {
      cache: {
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

    /* 서버는 «다른» 사람을 돌려준다 — 갈아타면 결과가 달라진다. */
    renderLogin([workerOf({ workerNo: '900777', workerName: '다른사람' })]);

    await typeWorkerNo('900028');
    await submit();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(current()).toHaveTextContent('김작업'));
    expect(screen.queryByText(t.error.unknown)).not.toBeInTheDocument();
  });

  /** ⭐ 오프라인이어도 막지 않는다 — 미리 받아 둔 목록으로 확인한다. */
  it('미리 받아 둔 목록으로 작업자를 지정한다', async () => {
    goOffline();
    (globalThis as { pop?: unknown }).pop = {
      cache: {
        get: () => Promise.resolve(JSON.stringify([workerOf()])),
        put: () => Promise.resolve(),
      },
      outbox: { size: () => Promise.resolve(0) },
    };

    renderLogin();

    await typeWorkerNo('900028');
    await submit();

    await waitFor(() => expect(current()).toHaveTextContent('김작업'));
  });
});

/** 교대 알림 — 스펙 §6. ⛔ 큐의 사번을 바꾸지 않고 세어서 알리기만 한다. */
describe('보내지 못한 기록', () => {
  afterEach(() => {
    delete (globalThis as { pop?: unknown }).pop;
  });

  it('보내지 못한 기록이 있으면 사번 입력 아래에 알린다', async () => {
    (globalThis as { pop?: unknown }).pop = {
      cache: { get: () => Promise.resolve(undefined), put: () => Promise.resolve() },
      outbox: { size: () => Promise.resolve(3) },
    };

    renderLogin();

    expect(await screen.findByText(t.current.pendingQueue(3))).toBeInTheDocument();
  });

  it('큐를 세지 못해도 사번 확인이 막히지 않는다', async () => {
    (globalThis as { pop?: unknown }).pop = {
      cache: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.reject(new Error('실패')),
      },
      outbox: { size: () => Promise.reject(new Error('실패')) },
    };

    renderLogin();

    await typeWorkerNo('900028');
    await submit();

    await waitFor(() => expect(current()).toHaveTextContent('김작업'));
    expect(screen.queryByText(t.current.pendingQueue(3))).not.toBeInTheDocument();
  });
});

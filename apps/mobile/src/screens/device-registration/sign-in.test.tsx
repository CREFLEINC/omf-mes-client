import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceExpiredNotice } from '../../patterns/device-expired-notice';
import { forgetPlant, rememberPlant } from '../../patterns/plant';
import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { WorkerSignInScreen } from './sign-in';

const store = vi.hoisted(() => new Map<string, string>());

/** 등록을 푸는 것은 단말 토큰을 지우는 일이다. 보안 저장소는 시험 환경에 없어 여기서 본다. */
const token = vi.hoisted(() => ({ cleared: 0, refuse: false, value: 't' as string | null }));

/** 무엇이 먼저 일어났는가. 버리기와 토큰 지우기의 차례를 재려면 둘을 한 줄에 놓아야 한다. */
const steps = vi.hoisted(() => [] as string[]);

/** 보관소가 특정 자리의 저장을 거절하는 상황을 만든다. */
const refuse = vi.hoisted(() => ({ key: null as string | null, removeKey: null as string | null }));

vi.mock('../../patterns/device-token', () => ({
  readDeviceToken: () => Promise.resolve(token.value),
  writeDeviceToken: () => Promise.resolve(),
  /* 지운 뒤에도 살아 있다고 답하면 토큰 없이 나가는 갈래가 시험에서 사라진다. */
  currentDeviceToken: () => token.value,
  clearDeviceToken: () => {
    if (token.refuse) {
      return Promise.reject(new Error('보안 저장소가 거절했습니다'));
    }

    token.cleared += 1;
    token.value = null;
    steps.push('토큰 지움');
    return Promise.resolve();
  },
}));

/** 큐를 읽는 동안의 상태를 재려면 읽기를 붙잡을 수 있어야 한다. */
const reads = vi.hoisted(() => ({ gate: null as Promise<void> | null }));

vi.mock('../../patterns/local-store', () => ({
  readLocal: async (key: string) => {
    /* 큐만 붙잡는다. 전부 막으면 작업자 목록도 못 받아 사번 확인에 닿지 못한다. */
    if (reads.gate !== null && key === 'outbox') {
      await reads.gate;
    }

    return store.get(key) ?? null;
  },
  writeLocal: (key: string, value: string) => {
    if (key === refuse.key) {
      return Promise.reject(new Error('보관소가 거절했습니다'));
    }

    if (key === 'outbox' && value === '[]') {
      steps.push('큐 버림');
    }

    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    if (key === refuse.removeKey) {
      return Promise.reject(new Error('보관소가 거절했습니다'));
    }

    store.delete(key);
    return Promise.resolve();
  },
}));

const DIRECTORY = [
  { workerNo: '900028', workerName: '작업자 1' },
  { workerNo: '900029', workerName: '작업자 2' },
];

const mount = (routes: StubRoute[] = []) =>
  renderWithProviders(
    <MemoryRouter>
      <WorkerSignInScreen />
    </MemoryRouter>,
    { fetch: createStubFetch(routes) },
  );

/** 만료 문구는 셸이 화면 위에 띄운다. 그것까지 보려면 셸이 두는 알림을 함께 세운다. */
const mountGated = (routes: StubRoute[] = []) =>
  renderWithProviders(
    <MemoryRouter>
      <DeviceExpiredNotice />
      <WorkerSignInScreen />
    </MemoryRouter>,
    { fetch: createStubFetch(routes) },
  );

/** 토큰 확인은 등록 때와 같은 조회다 - 공장을 싣고 한 줄만 묻는다. */
const probe = (respond: StubRoute['respond']): StubRoute => ({
  match: (request) => {
    const url = new URL(request.url);
    return url.pathname === '/mdm/workers' && url.searchParams.get('plantId') === '7';
  },
  respond,
});

const EXPIRED = '등록 정보가 만료됐습니다. 관리자에게 새 QR을 요청하세요.';
const denied = { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '거절' }] };

const press = async (user: ReturnType<typeof userEvent.setup>, digits: string) => {
  for (const digit of digits) {
    await user.click(screen.getByRole('button', { name: digit }));
  }
};

/* 명부의 사번을 끝까지 누르면 「확인」 없이 들어간다. 이 시험들은 라우트를 두지 않아 화면이 남는다. */
const signedIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole('group', { name: '사번 입력' });
  await press(user, '900028');
  await screen.findByText('작업자 1 · 900028');
};

/* 들어간 뒤 어디로 가는지 보려면 작업 목록 자리를 함께 세운다. */
const mountWithHome = () =>
  renderWithProviders(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<WorkerSignInScreen />} />
        <Route path="/screens" element={<p>작업 목록 화면</p>} />
      </Routes>
    </MemoryRouter>,
    { fetch: createStubFetch([]) },
  );

beforeEach(async () => {
  reads.gate = null;
  refuse.key = null;
  refuse.removeKey = null;
  steps.length = 0;
  token.cleared = 0;
  token.refuse = false;
  token.value = 't';
  store.clear();
  store.set('worker-directory', JSON.stringify(DIRECTORY));
  /* 공장은 모듈에 남는다. 앞 시험이 남긴 공장이 있으면 토큰 확인이 스텁에 없는 요청을 낸다. */
  await forgetPlant();
});

describe('사번 확인 화면', () => {
  it('받아 둔 목록에 있는 사번이면 현재 작업자가 된다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByRole('group', { name: '사번 입력' });
    await press(user, '900028');

    expect(await screen.findByText('작업자 1 · 900028')).toBeInTheDocument();
    expect(screen.getByText('이 기기의 기록은 이 사번으로 남습니다.')).toBeInTheDocument();
  });

  /* 전에는 확인 · 확인 카드 · 「작업 목록으로」를 거쳤다. 누구로 기록되는지는 앱바가 보인다. */
  it('사번을 끝까지 누르면 확인 없이 작업 목록으로 간다', async () => {
    const user = userEvent.setup();
    mountWithHome();

    await screen.findByRole('group', { name: '사번 입력' });
    /* 안내 문장은 두지 않는다(사용자 지시 2026-10-21). */
    expect(screen.queryByText(/끝까지 누르면/)).not.toBeInTheDocument();

    await press(user, '900028');

    expect(await screen.findByText('작업 목록 화면')).toBeInTheDocument();
  });

  /* 더 긴 사번이 있으면 짧은 쪽에서 넘기지 않는다. 그 사람은 「확인」으로 들어간다. */
  it('더 쳐서 될 사번이 남아 있으면 기다렸다가 확인으로 들어간다', async () => {
    store.set(
      'worker-directory',
      JSON.stringify([...DIRECTORY, { workerNo: '9000', workerName: '짧은 사번' }]),
    );
    const user = userEvent.setup();
    mountWithHome();

    await screen.findByRole('group', { name: '사번 입력' });
    await press(user, '9000');

    expect(screen.queryByText('작업 목록 화면')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('작업 목록 화면')).toBeInTheDocument();
  });

  it('없는 사번은 그렇게 말하고 현재 작업자를 세우지 않는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByRole('group', { name: '사번 입력' });
    await press(user, '999999');
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(
      await screen.findByText('등록되지 않았거나 재직 중이 아닌 사번입니다'),
    ).toBeInTheDocument();
    expect(screen.queryByText('이 기기의 기록은 이 사번으로 남습니다.')).not.toBeInTheDocument();
  });

  /* 목록을 못 받은 것은 없는 사번과 달리 작업자가 다시 쳐서 풀 수 없다. */
  it('목록을 받지 못했으면 확인 자체를 막고 그 이유만 말한다', async () => {
    store.clear();
    const user = userEvent.setup();
    mount();

    expect(await screen.findByText('작업자 정보를 아직 받지 못했습니다')).toBeInTheDocument();

    await press(user, '900028');

    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
    // 같은 문장을 배너와 입력 칸에 두 번 두지 않는다.
    expect(screen.getAllByText('작업자 정보를 아직 받지 못했습니다')).toHaveLength(1);
    expect(
      screen.queryByText('등록되지 않았거나 재직 중이 아닌 사번입니다'),
    ).not.toBeInTheDocument();
  });

  /*
   * 기기 등록 해제는 설정 화면에 있다(사용자 지시 2026-10-21). 교대 때마다 눈에 걸리는데 쓰는
   * 일은 거의 없다. 끊긴 단말만 이 화면에 남긴다 - 아래 만료 시험.
   */
  it('사번 입력 화면에도 확인 뒤 화면에도 기기 등록 해제를 두지 않는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByRole('group', { name: '사번 입력' });
    expect(screen.queryByRole('button', { name: '기기 등록 해제' })).not.toBeInTheDocument();

    await signedIn(user);
    expect(screen.queryByRole('button', { name: '기기 등록 해제' })).not.toBeInTheDocument();
  });

  it('아무것도 안 눌렀으면 확인할 수 없다', async () => {
    mount();

    await screen.findByRole('group', { name: '사번 입력' });

    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
  });

  it('사번을 바꾸면 다시 입력을 받는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByRole('group', { name: '사번 입력' });
    await press(user, '900028');
    await screen.findByText('작업자 1 · 900028');

    await user.click(screen.getByRole('button', { name: '사번 바꾸기' }));

    expect(await screen.findByRole('group', { name: '사번 입력' })).toBeInTheDocument();
    expect(screen.queryByText('작업자 1 · 900028')).not.toBeInTheDocument();
  });
  /*
   * 계약이 사번 칸을 50 으로 두고 형식을 강제하지 않는다 - 786건 중 표본 2건만 확인했고,
   * 강제했다가 다른 형식이 하나라도 있으면 그 사람이 단말을 아예 못 쓴다는 것이 그 결정의
   * 근거다. 화면이 더 좁히면 그 결정을 화면에서 되돌리는 셈이 된다.
   */
  it('계약이 두는 길이까지 받는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByRole('group', { name: '사번 입력' });

    const long = '1234567890'.repeat(3) + '12345';
    await press(user, long);

    expect(screen.getByLabelText('사번')).toHaveValue(long);
  });
});

/*
 * 관리웹에서 QR 을 다시 발급하면 앞 기기의 토큰이 서버에서 즉시 죽는다. 명단은 기기에 남아
 * 사번 확인은 통과하고, 들어간 뒤에야 모든 조회가 막혔다(#1198 실기 실측).
 */
describe('등록이 서버에서 끊긴 기기', () => {
  it('토큰이 거절되면 사번 확인을 막고 새 QR 을 받으라고 한다', async () => {
    await rememberPlant(7);
    mountGated([probe(() => jsonResponse(denied, { status: 401 }))]);

    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    /* 셸이 띄운 것 하나뿐이다. 화면이 또 띄우면 두 번 뜬다(#1198 실기). */
    expect(screen.getAllByText(EXPIRED)).toHaveLength(1);

    /* 넣어도 들어갈 수 없는 입력은 두지 않는다(#1243). */
    expect(screen.queryByRole('group', { name: '사번 입력' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '확인' })).not.toBeInTheDocument();
    expect(screen.queryByText('작업자 1 · 900028')).not.toBeInTheDocument();
  });

  /*
   * 막기만 하면 갈 곳이 없다. 새 QR 로 다시 등록하려면 먼저 풀어야 한다. 그 길이 키패드 아래에
   * 밀려 단말에서 보이지 않았다(#1243 실기).
   */
  it('만료된 기기의 기기 등록 해제는 확인 창을 거쳐 등록을 푼다', async () => {
    await rememberPlant(7);
    const user = userEvent.setup();
    mountGated([probe(() => jsonResponse(denied, { status: 401 }))]);

    await screen.findByText(EXPIRED);
    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(token.cleared).toBe(0);

    await user.click(await dialog.findByRole('button', { name: '등록 해제' }));

    await waitFor(() => {
      expect(token.cleared).toBe(1);
    });
  });

  it('들어온 뒤에 끊겼으면 교대로 사번을 바꿀 때 막는다', async () => {
    await rememberPlant(7);
    let dead = false;
    const user = userEvent.setup();
    mountGated([
      probe(() =>
        dead
          ? jsonResponse(denied, { status: 401 })
          : jsonResponse({ items: [], page: { page: 1, size: 1, total: 0 } }),
      ),
    ]);

    await signedIn(user);
    dead = true;
    await user.click(screen.getByRole('button', { name: '사번 바꾸기' }));

    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '확인' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '기기 등록 해제' })).toBeInTheDocument();
  });

  it('토큰이 살아 있으면 지금처럼 들어간다', async () => {
    await rememberPlant(7);
    const user = userEvent.setup();
    mountGated([probe(() => jsonResponse({ items: [], page: { page: 1, size: 1, total: 0 } }))]);

    await signedIn(user);

    expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument();
  });

  /*
   * 망이 멈춘 사이 앞 토큰으로 보낸 확인이 답을 못 받은 채 다시 등록하면, 새로 선 화면이 그
   * 옛 요청의 401 을 받아 멀쩡한 단말을 막았다(#1198 독립 검증). 설 때마다 새로 묻는다.
   */
  it('다시 섰으면 앞서 보낸 확인의 답으로 막지 않는다', async () => {
    await rememberPlant(7);
    const queryClient = createTestQueryClient();
    const answers: ((response: Response) => void)[] = [];
    const fetch = createStubFetch([
      probe(
        () =>
          new Promise<Response>((resolve) => {
            answers.push(resolve);
          }),
      ),
    ]);
    const screenOf = () => (
      <MemoryRouter>
        <DeviceExpiredNotice />
        <WorkerSignInScreen />
      </MemoryRouter>
    );

    const first = renderWithProviders(screenOf(), { fetch, queryClient });
    await waitFor(() => {
      expect(answers).toHaveLength(1);
    });
    first.unmount();

    renderWithProviders(screenOf(), { fetch, queryClient });
    await waitFor(() => {
      expect(answers).toHaveLength(2);
    });

    answers[0]?.(jsonResponse(denied, { status: 401 }));
    answers[1]?.(jsonResponse({ items: [], page: { page: 1, size: 1, total: 0 } }));

    await screen.findByRole('group', { name: '사번 입력' });
    await waitFor(() => {
      expect(queryClient.getQueryData(['device-token-state'])).toBe('alive');
    });
    expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument();
  });

  /* 사번 확인은 오프라인에서도 되어야 한다(M-CO-01 §5-7). 못 물었으면 막지 않는다. */
  it('서버에 닿지 못하면 막지 않는다', async () => {
    await rememberPlant(7);
    const user = userEvent.setup();
    mountGated([probe(() => Promise.reject(new TypeError('Failed to fetch')))]);

    await signedIn(user);

    expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument();
  });
});

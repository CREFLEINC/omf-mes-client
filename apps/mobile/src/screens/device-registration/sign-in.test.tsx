import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceExpiredNotice } from '../../patterns/device-expired-notice';
import { OUTBOX_KEY, OUTBOX_REJECTED_KEY } from '../../patterns/outbox';
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

const queuedEntry = (id: string) => ({
  id,
  label: '입하 등록',
  idempotencyKey: id,
  method: 'POST',
  path: '/logistics/inbound-receipts',
  body: {},
  occurredAt: '2026-09-01T02:30:00.000Z',
  confirmation: 'pending',
});

const signedIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole('group', { name: '사번 입력' });
  await press(user, '900028');
  await user.click(screen.getByRole('button', { name: '확인' }));
  await screen.findByText('작업자 1 · 900028');
};

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
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('작업자 1 · 900028')).toBeInTheDocument();
    expect(screen.getByText('이 기기의 기록은 이 사번으로 남습니다.')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: '확인' }));
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
    const user = userEvent.setup();
    mountGated([probe(() => jsonResponse(denied, { status: 401 }))]);

    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    /* 셸이 띄운 것 하나뿐이다. 화면이 또 띄우면 두 번 뜬다(#1198 실기). */
    expect(screen.getAllByText(EXPIRED)).toHaveLength(1);

    await press(user, '900028');

    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
    expect(screen.queryByText('작업자 1 · 900028')).not.toBeInTheDocument();
  });

  /* 막기만 하면 갈 곳이 없다. 새 QR 로 다시 등록하려면 먼저 풀어야 한다. */
  it('사번을 넣기 전에도 등록을 풀 수 있다', async () => {
    await rememberPlant(7);
    const user = userEvent.setup();
    mountGated([probe(() => jsonResponse(denied, { status: 401 }))]);

    await screen.findByText(EXPIRED);
    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
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
    await press(user, '900028');

    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
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

describe('기기 등록 해제', () => {
  /*
   * 설계 M-CO-01 §5-5 - 누를 때 미동기 건수를 반드시 보인다. 그 수를 모르면 무엇을 잃는지
   * 모른 채 누르게 되고, 등록을 풀면 담아 둔 것이 함께 사라진다.
   */
  it('보내지 못한 기록이 있으면 건수를 보인다', async () => {
    store.set(OUTBOX_KEY, JSON.stringify([queuedEntry('a'), queuedEntry('b')]));
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    /* 닫힌 창의 본문도 DOM 에 남는다 - 창 안에서 재야 열렸는지가 갈린다. */
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText(/보내지 못한 기록 2건이 사라집니다/)).toBeInTheDocument();
  });

  /* 담아 둔 것이 없으면 잃을 것이 없다. 없는 위험을 지어 보이지 않는다. */
  it('보내지 못한 기록이 없으면 사라진다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    await screen.findByRole('button', { name: '등록 해제' });
    expect(screen.queryByText(/사라집니다/)).not.toBeInTheDocument();
  });

  /* 되돌릴 수 없다. 한 번 누름으로 풀리면 손이 스친 것과 뜻이 같아진다. */
  it('두 단계를 거쳐야 풀린다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    expect(screen.getByText('작업자 1 · 900028')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: '등록 해제' }));

    await waitFor(() => {
      expect(token.cleared).toBe(1);
    });
  });

  /* 닫으면 아무 일도 없어야 한다. 되돌릴 수 없는 것은 물러설 길을 함께 둔다. */
  it('닫으면 등록이 그대로 남는다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    await user.click(await screen.findByRole('button', { name: '돌아가기' }));

    expect(token.cleared).toBe(0);
    expect(screen.getByText('작업자 1 · 900028')).toBeInTheDocument();
    /* 창이 열린 채로도 앞 둘은 참이다. 닫혔는지는 역할로 재야 갈린다. */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * 큐를 읽기 전에는 몇 건을 잃는지 모른다. 그 사이 확인이 눌리면 설계가 건수를 먼저
   * 보이라고 정한 뜻이 사라진다.
   */
  it('큐를 읽기 전에는 확인을 막는다', async () => {
    let release = () => {
      /* 문을 여는 자리는 아래에서 채운다. */
    };
    reads.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    expect(await screen.findByText('보내지 못한 기록을 세는 중입니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등록 해제' })).toBeDisabled();

    release();
  });

  /*
   * 앱바가 둘로 가른 것을 창에서 합치지 않는다 - 기다리면 가는 것과 기다려도 가지 않는 것은
   * 다른 일이라, 합치면 앱바의 두 수와 창의 한 수가 어긋난다.
   */
  it('되돌아온 기록은 따로 센다', async () => {
    store.set(OUTBOX_KEY, JSON.stringify([queuedEntry('a')]));
    store.set(
      OUTBOX_REJECTED_KEY,
      JSON.stringify([
        {
          entry: queuedEntry('b'),
          error: { kind: 'http', status: 401 },
          cascaded: false,
          rejectedAt: '2026-09-01T03:00:00.000Z',
        },
      ]),
    );
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText(/보내지 못한 기록 1건이 사라집니다/)).toBeInTheDocument();
    expect(dialog.getByText(/전송 실패한 기록 1건도 사라집니다/)).toBeInTheDocument();
  });

  /*
   * 창이 사라진다고 말한 것은 실제로 사라져야 한다. 남겨 두면 토큰 없이 나가 401 로
   * 되돌아오고, 그 사유는 서버의 판정이 아니라 우리가 등록을 푼 결과다.
   */
  it('풀면 담아 둔 것도 함께 버린다', async () => {
    store.set(OUTBOX_KEY, JSON.stringify([queuedEntry('a')]));
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    await user.click(await screen.findByRole('button', { name: '등록 해제' }));

    await waitFor(() => {
      expect(store.get(OUTBOX_KEY)).toBe('[]');
    });
  });

  /*
   * 토큰을 먼저 지우면 그 틈에 셸이 큐를 보내 토큰 없는 요청이 나간다 - 401 로 되돌아오고,
   * 그 사유는 서버가 그 기록에 대해 내린 판정이 아니라 우리가 등록을 푼 결과가 된다.
   */
  it('토큰을 지우기 전에 담아 둔 것을 먼저 버린다', async () => {
    store.set(OUTBOX_KEY, JSON.stringify([queuedEntry('a')]));
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    await user.click(await screen.findByRole('button', { name: '등록 해제' }));

    await waitFor(() => {
      expect(token.cleared).toBe(1);
    });
    expect(steps).toEqual(['큐 버림', '토큰 지움']);
  });

  /*
   * 버리지 못했는데 등록을 풀면 남은 기록이 토큰 없이 나간다. 풀지 않는 것이 맞지만, 창은
   * 이미 닫혀 있어 가만히 있으면 된 줄 안다 - 청한 일이 일어나지 않았다고 말한다.
   */
  it('버리지 못하면 등록을 풀지 않고 그렇게 말한다', async () => {
    store.set(OUTBOX_KEY, JSON.stringify([queuedEntry('a')]));
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    refuse.key = OUTBOX_KEY;
    await user.click(await screen.findByRole('button', { name: '등록 해제' }));

    expect(
      await screen.findByText('등록을 해제하지 못했습니다. 다시 시도해 주십시오'),
    ).toBeInTheDocument();
    expect(token.cleared).toBe(0);
  });

  /*
   * 버리기와 토큰 지우기는 걸음이 둘이다. 뒤엣것만 걸리면 기록은 이미 사라졌는데 단말은
   * 그대로 등록돼 있고, 창은 닫혀 있어 아무 일도 없었던 것으로 읽힌다.
   */
  it('토큰을 지우지 못해도 그렇게 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    token.refuse = true;
    await user.click(await screen.findByRole('button', { name: '등록 해제' }));

    expect(
      await screen.findByText('등록을 해제하지 못했습니다. 다시 시도해 주십시오'),
    ).toBeInTheDocument();
    /* 창이 그대로 서 있으면 이 배너는 모달 뒤에 가려 읽히지 않는다. */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* 실패를 보고 물러섰는데 붉은 배너가 남으면, 다음에 들어온 사람이 방금 실패한 줄로 읽는다. */
  it('실패한 뒤 창을 다시 열면 앞 실패를 지운다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    token.refuse = true;
    await user.click(await screen.findByRole('button', { name: '등록 해제' }));
    await screen.findByText('등록을 해제하지 못했습니다. 다시 시도해 주십시오');

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    expect(
      screen.queryByText('등록을 해제하지 못했습니다. 다시 시도해 주십시오'),
    ).not.toBeInTheDocument();
  });

  /*
   * 등록 풀기가 도중에 걸리면 토큰만 사라질 수 있다. 셸은 등록 화면으로 갈아타지만 사번은
   * 셸 위에 있어 살아남아, 새 QR 로 재등록한 단말이 앞 작업자의 사번으로 기록을 쌓는다.
   */
  it('등록 풀기가 도중에 걸려도 사번은 끊는다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    refuse.removeKey = 'plant-id';
    await user.click(await screen.findByRole('button', { name: '등록 해제' }));

    expect(await screen.findByRole('group', { name: '사번 입력' })).toBeInTheDocument();
  });

  /* X·Esc 도 같은 자리로 온다. 이 길이 죽으면 되돌릴 수 없는 확인 창이 영영 안 닫힌다. */
  it('X 로도 창이 닫힌다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    await user.click(await screen.findByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(token.cleared).toBe(0);
  });

  /*
   * 되돌릴 수 없는 확인인데 창 단추가 화면에서 가장 작았다 - 크기를 주지 않아 기본값으로
   * 섰고, 같은 화면의 다른 단추와 이 앱의 다른 창 둘은 모두 xl 이다.
   */
  it('창 단추를 화면의 다른 단추와 같은 크기로 세운다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    const dialog = within(await screen.findByRole('dialog'));
    for (const name of ['돌아가기', '등록 해제']) {
      expect(dialog.getByRole('button', { name })).toHaveClass(/_xl_/);
    }
  });

  /*
   * 디자인 시스템의 창 본문은 자식 사이 간격을 주지 않고 이 화면은 문단 여백을 0 으로 둔다.
   * 감싸지 않으면 안내와 경고가 서로 붙는다.
   */
  it('창 본문을 한 상자에 담는다', async () => {
    store.set(OUTBOX_KEY, JSON.stringify([queuedEntry('a')]));
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));

    const dialog = await screen.findByRole('dialog');
    const notice = await within(dialog).findByText(/다시 사용하려면 관리자에게/);
    const box = notice.closest('.worker-sign-in__dialog-body');

    expect(box).not.toBeNull();
    expect(box?.contains(within(dialog).getByText(/보내지 못한 기록 1건이 사라집니다/))).toBe(true);
  });

  /*
   * 상자를 둔 까닭은 간격 하나다. 담기만 하고 간격이 사라지면 감싼 보람이 없는데 화면 시험은
   * 배치를 재지 못한다 - 선언이 살아 있는지를 원문에서 본다.
   */
  it('창 본문 상자가 간격을 준다', () => {
    const css = readFileSync(join(import.meta.dirname, 'sign-in.css'), 'utf-8');

    expect(css).toMatch(/\.worker-sign-in__dialog-body\s*\{[^}]*gap:/);
  });

  /* 사번이 남으면 새 QR 로 다시 등록했을 때 앞 작업자의 사번으로 기록이 쌓인다. */
  it('풀면 사번도 함께 끊는다', async () => {
    const user = userEvent.setup();
    mount();
    await signedIn(user);

    await user.click(screen.getByRole('button', { name: '기기 등록 해제' }));
    await user.click(await screen.findByRole('button', { name: '등록 해제' }));

    expect(await screen.findByRole('group', { name: '사번 입력' })).toBeInTheDocument();
  });
});

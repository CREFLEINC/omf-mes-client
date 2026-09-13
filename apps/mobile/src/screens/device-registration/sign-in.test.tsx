import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OUTBOX_KEY, OUTBOX_REJECTED_KEY } from '../../patterns/outbox';
import { createStubFetch, renderWithProviders } from '../../test/api-harness';
import { WorkerSignInScreen } from './sign-in';

const store = vi.hoisted(() => new Map<string, string>());

/** 등록을 푸는 것은 단말 토큰을 지우는 일이다. 보안 저장소는 시험 환경에 없어 여기서 본다. */
const token = vi.hoisted(() => ({ cleared: 0, value: 't' as string | null }));

vi.mock('../../patterns/device-token', () => ({
  readDeviceToken: () => Promise.resolve(token.value),
  writeDeviceToken: () => Promise.resolve(),
  /* 지운 뒤에도 살아 있다고 답하면 토큰 없이 나가는 갈래가 시험에서 사라진다. */
  currentDeviceToken: () => token.value,
  clearDeviceToken: () => {
    token.cleared += 1;
    token.value = null;
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
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const DIRECTORY = [
  { workerNo: '900028', workerName: '작업자 1' },
  { workerNo: '900029', workerName: '작업자 2' },
];

const mount = () =>
  renderWithProviders(
    <MemoryRouter>
      <WorkerSignInScreen />
    </MemoryRouter>,
    { fetch: createStubFetch([]) },
  );

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

beforeEach(() => {
  reads.gate = null;
  token.cleared = 0;
  token.value = 't';
  store.clear();
  store.set('worker-directory', JSON.stringify(DIRECTORY));
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

    expect(await screen.findByText(/보내지 못한 기록 2건이 사라집니다/)).toBeInTheDocument();
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
    await user.click(await screen.findByRole('button', { name: '그대로 두기' }));

    expect(token.cleared).toBe(0);
    expect(screen.getByText('작업자 1 · 900028')).toBeInTheDocument();
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

    expect(await screen.findByText(/보내지 못한 기록 1건이 사라집니다/)).toBeInTheDocument();
    expect(screen.getByText(/전송 실패한 기록 1건도 사라집니다/)).toBeInTheDocument();
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

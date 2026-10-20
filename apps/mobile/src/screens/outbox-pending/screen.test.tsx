import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { OUTBOX_KEY, type OutboxEntry } from '../../patterns/outbox';
import { OutboxPendingScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const entry = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 'e-1',
  label: '설비 고장 보고',
  idempotencyKey: 'key-1',
  method: 'POST',
  path: '/maintenance/breakdowns',
  body: {},
  occurredAt: '2026-09-01T02:30:00.000Z',
  confirmation: 'immediate',
  workerNo: '100027',
  ...overrides,
});

const seed = (entries: OutboxEntry[]) => {
  store.set(OUTBOX_KEY, JSON.stringify(entries));
};

/*
 * 셸은 큐를 읽자마자 한 번 보내 본다. 그때는 닿지 않게 두어야 목록이 남는다 - 받는 쪽이
 * 살아난 뒤에 사람이 「지금 보내기」를 누르는 자리를 잰다.
 */
const backend = () => {
  const state = { reachable: false, sent: 0 };
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/maintenance/breakdowns',
      respond: () => {
        if (!state.reachable) {
          throw new TypeError('Failed to fetch');
        }

        state.sent += 1;
        return jsonResponse({}, { status: 201 });
      },
    },
  ]);

  return { state, fetch };
};

const render = (fetch: ReturnType<typeof backend>['fetch']) =>
  renderWithProviders(
    <MemoryRouter>
      <OutboxPendingScreen />
    </MemoryRouter>,
    { fetch },
  );

beforeEach(() => {
  store.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('전송 대기 기록 화면', () => {
  it('무엇이 언제 누구 사번으로 묶여 있는지 보인다', async () => {
    seed([entry(), entry({ id: 'e-2', idempotencyKey: 'key-2', label: '입하 등록' })]);

    render(backend().fetch);

    expect(await screen.findByText('설비 고장 보고')).toBeInTheDocument();
    expect(screen.getByText('입하 등록')).toBeInTheDocument();
    expect(screen.getAllByText(/09-01 .*사번 100027/)).toHaveLength(2);
  });

  /* 무선은 붙어 있는데 받는 쪽만 살아나면 셸이 스스로 보낼 신호가 오지 않는다. */
  it('「지금 보내기」로 묶인 것을 보내고 몇 건이 갔는지 말한다', async () => {
    seed([entry(), entry({ id: 'e-2', idempotencyKey: 'key-2', label: '입하 등록' })]);
    const { state, fetch } = backend();
    const user = userEvent.setup();

    render(fetch);
    await screen.findByText('설비 고장 보고');

    state.reachable = true;
    await user.click(screen.getByRole('button', { name: '지금 보내기' }));

    expect(await screen.findByRole('status')).toHaveTextContent('2건을 보냈습니다');
    expect(state.sent).toBe(2);
    await waitFor(() => {
      expect(screen.getByText('전송 대기 중인 기록이 없습니다.')).toBeInTheDocument();
    });
  });

  it('보내지 못하면 그렇다고 말하고 목록을 남긴다', async () => {
    seed([entry()]);
    const user = userEvent.setup();

    render(backend().fetch);
    await screen.findByText('설비 고장 보고');

    await user.click(screen.getByRole('button', { name: '지금 보내기' }));

    expect(await screen.findByRole('status')).toHaveTextContent('보내지 못했습니다');
    expect(screen.getByText('설비 고장 보고')).toBeInTheDocument();
  });

  /* 공유계약 G-1 — 잠긴 단추는 이유를 함께 말한다. */
  it('망에 붙어 있지 않으면 보내기를 잠그고 이유를 말한다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    seed([entry()]);

    render(backend().fetch);
    await screen.findByText('설비 고장 보고');

    const button = screen.getByRole('button', { name: '지금 보내기' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('연결되면 보낼 수 있습니다');
  });

  it('묶인 것이 없으면 없다고 말하고 보내기 단추를 두지 않는다', async () => {
    render(backend().fetch);

    expect(await screen.findByText('전송 대기 중인 기록이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지금 보내기' })).toBeNull();
  });
});

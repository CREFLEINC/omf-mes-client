import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, renderWithProviders } from '../../test/api-harness';
import { OUTBOX_REJECTED_KEY, type RejectedRecord } from '../../patterns/outbox';
import { OutboxRejectionsScreen } from './screen';

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

const record = (overrides: Partial<RejectedRecord> = {}): RejectedRecord => ({
  entry: {
    id: 'e-1',
    label: '설비 고장 보고',
    idempotencyKey: 'key-1',
    method: 'POST',
    path: '/maintenance/breakdowns',
    body: {},
    occurredAt: '2026-09-01T02:30:00.000Z',
    confirmation: 'pending',
  },
  error: {
    kind: 'validation',
    errors: [{ scope: 'field', field: 'symptom', code: 'required', message: '증상을 적어 주세요' }],
  },
  cascaded: false,
  rejectedAt: '2026-09-01T03:00:00.000Z',
  ...overrides,
});

const seed = (records: RejectedRecord[]) => {
  store.set(OUTBOX_REJECTED_KEY, JSON.stringify(records));
};

/* 큐가 비어 있으므로 어떤 요청도 나가지 않는다. 나가면 그 자체가 결함이다. */
const render = () =>
  renderWithProviders(
    <MemoryRouter>
      <OutboxRejectionsScreen />
    </MemoryRouter>,
    { fetch: createStubFetch([]) },
  );

beforeEach(() => {
  store.clear();
});

describe('되돌아온 기록 화면', () => {
  it('무엇이 언제 왜 되돌아왔는지 보인다', async () => {
    seed([record()]);

    render();

    expect(await screen.findByText('설비 고장 보고')).toBeInTheDocument();
    expect(screen.getByText('증상을 적어 주세요')).toBeInTheDocument();
    expect(screen.getByText(/09-01/)).toBeInTheDocument();
  });

  /* 서버가 말한 것이 없으면 갈래만이라도 말한다. 아무 말도 없으면 왜인지 알 수 없다. */
  it('서버가 사유를 주지 않아도 되돌아왔다고 말한다', async () => {
    seed([record({ error: { kind: 'http', status: 500 } })]);

    render();

    expect(await screen.findByText(/서버가 받지 않았습니다/)).toBeInTheDocument();
  });

  it('앞 기록에 딸려 되돌아온 것임을 말한다', async () => {
    seed([record({ cascaded: true, error: { kind: 'http', status: 0 } })]);

    render();

    expect(await screen.findByText('앞 기록이 되돌아와 함께 되돌아왔습니다')).toBeInTheDocument();
    expect(screen.getByText('앞 기록이 가지 못해 붙을 곳이 없습니다.')).toBeInTheDocument();
  });

  /* 되돌아온 것은 다시 보내서 풀리지 않는다. 단추를 두면 눌러 보고 또 되돌아온다. */
  it('다시 보내는 단추를 두지 않는다', async () => {
    seed([record()]);

    render();

    expect(await screen.findByText('설비 고장 보고')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /다시 보내/ })).not.toBeInTheDocument();
  });

  it('내리면 목록에서도 보관소에서도 빠진다', async () => {
    seed([record(), record({ entry: { ...record().entry, id: 'e-2', label: '고장 사진' } })]);

    render();

    await userEvent.click((await screen.findAllByRole('button', { name: '목록에서 내리기' }))[0]!);

    await waitFor(() => {
      expect(screen.queryByText('고장 사진')).not.toBeInTheDocument();
    });
    expect(store.get(OUTBOX_REJECTED_KEY)).not.toContain('고장 사진');
    expect(screen.getByText('설비 고장 보고')).toBeInTheDocument();
  });

  it('되돌아온 것이 없으면 없다고 말한다', async () => {
    render();

    expect(await screen.findByText('되돌아온 기록이 없습니다.')).toBeInTheDocument();
  });
});

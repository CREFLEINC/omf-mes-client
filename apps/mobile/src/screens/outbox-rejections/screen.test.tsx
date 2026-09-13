import { screen, waitFor, within } from '@testing-library/react';
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

describe('전송 실패한 기록 화면', () => {
  it('무엇이 언제 왜 실패했는지 보인다', async () => {
    seed([record()]);

    render();

    expect(await screen.findByText('설비 고장 보고')).toBeInTheDocument();
    expect(screen.getByText('증상을 적어 주세요')).toBeInTheDocument();
    expect(screen.getByText(/09-01/)).toBeInTheDocument();
  });

  /* 서버가 말한 것이 없으면 갈래만이라도 말한다. 아무 말도 없으면 왜인지 알 수 없다. */
  it('서버가 사유를 주지 않아도 실패했다고 말한다', async () => {
    seed([record({ error: { kind: 'http', status: 500 } })]);

    render();

    expect(await screen.findByText(/보냈지만 등록되지 않았습니다/)).toBeInTheDocument();
  });

  it('앞 기록에 딸려 실패한 것임을 말한다', async () => {
    seed([record({ cascaded: true, error: { kind: 'http', status: 0 } })]);

    render();

    expect(
      await screen.findByText('앞 기록이 실패해 이 기록도 보내지 못했습니다'),
    ).toBeInTheDocument();
    expect(screen.getByText('앞 기록이 가지 못해 붙을 곳이 없습니다.')).toBeInTheDocument();
  });

  /* 실패한 것은 다시 보내서 풀리지 않는다. 단추를 두면 눌러 보고 또 실패한다. */
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

  it('실패한 것이 없으면 없다고 말한다', async () => {
    render();

    expect(await screen.findByText('전송 실패한 기록이 없습니다.')).toBeInTheDocument();
  });

  /*
   * 서버는 단말 토큰이 죽은 것과 권한이 없는 것을 같은 401 문구로 보내고, 그 문구는 현장
   * 단말에 있지도 않은 로그인을 찾으라고 한다. 사유 한 줄만 보이면 담당자에게 무엇을 물어야
   * 할지 정해지지 않아, 어디로 무엇을 보내 무엇이 돌아왔는지를 함께 낸다.
   */
  const failed = () =>
    record({
      entry: {
        ...record().entry,
        label: '입하 등록',
        method: 'POST',
        path: '/logistics/inbound-receipts',
        idempotencyKey: 'key-9',
      },
      error: {
        kind: 'http',
        status: 401,
        code: 'PERMISSION_DENIED',
        message: '로그인이 필요합니다.',
      },
    });

  it('상세를 열면 요청과 응답 코드와 돌아온 문구를 보인다', async () => {
    seed([failed()]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    /*
     * 사유 문단에도 같은 문구가 이미 떠 있다. 상세 안에서만 찾지 않으면 접힌 채로도
     * 걸려, 상세를 열었는지와 무관하게 통과한다.
     */
    const details = screen.getByRole('group', { name: '상세' });

    expect(within(details).getByText('POST /logistics/inbound-receipts')).toBeInTheDocument();
    expect(within(details).getByText('401')).toBeInTheDocument();
    expect(within(details).getByText('PERMISSION_DENIED')).toBeInTheDocument();
    expect(within(details).getByText('로그인이 필요합니다.')).toBeInTheDocument();
    expect(within(details).getByText('key-9')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '상세 닫기' }));

    expect(screen.queryByRole('group', { name: '상세' })).not.toBeInTheDocument();
  });

  /*
   * 서버가 문구 없이 충돌만 돌려주면 정규화가 빈 문자열을 넣는다. 그 빈 값을 그대로 내면
   * 다른 칸은 없음이라 적혀 있는데 이 칸만 비어, 읽는 사람이 잘린 화면으로 읽는다.
   */
  it('서버가 준 문구가 비어 있으면 없다고 적는다', async () => {
    seed([record({ error: { kind: 'conflict', cause: 'user', message: '' } })]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(within(details).getAllByText('없음').length).toBeGreaterThanOrEqual(3);
  });

  /* 세로 화면이라 여럿이 펼쳐지면 목록을 잃는다. 하나를 열면 앞엣것이 닫혀야 한다. */
  it('상세는 한 번에 하나만 펴진다', async () => {
    seed([failed(), record({ entry: { ...record().entry, id: 'e-2', label: '고장 사진' } })]);

    render();

    const open = await screen.findAllByRole('button', { name: '상세 보기' });

    await userEvent.click(open[0]!);
    expect(screen.getAllByRole('group', { name: '상세' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: '상세 보기' }));

    expect(screen.getAllByRole('group', { name: '상세' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '상세 닫기' })).toHaveLength(1);
  });
});

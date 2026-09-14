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

const valueOf = (scope: HTMLElement, label: string): string =>
  within(scope).getByText(label).parentElement?.querySelector('dd')?.textContent ?? '';

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
   * 서버가 상태와 코드를 주었는데 상세가 둘 다 없다고 적던 자리다. 계약 오류 봉투는
   * validation 으로 접히는데 그 갈래가 상태를 싣지 않았고, 코드를 읽는 자리도 http·conflict
   * 뿐이었다. 401 만 멀쩡했던 것은 그것이 봉투 모양과 무관하게 먼저 http 로 갈리기 때문이다.
   *
   * 봉투 모양은 서버가 갈래마다 다르게 싣는다 - 어느 칸이 걸렸는지가 field 에 오기도 하고
   * uniqueScope 에 오기도 한다.
   */
  it('중복으로 거절되면 상태와 코드와 걸린 범위를 보인다', async () => {
    seed([
      record({
        error: {
          kind: 'validation',
          status: 400,
          errors: [
            {
              scope: 'screen',
              code: 'UNIQUE_VIOLATION',
              message: '이미 있는 값입니다.',
              uniqueScope: ['plantId', 'lotNo'],
            },
          ],
        },
      }),
    ]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(valueOf(details, '응답 코드')).toBe('400');
    expect(valueOf(details, '오류 코드')).toBe('UNIQUE_VIOLATION');
    expect(valueOf(details, '걸린 칸')).toBe('plantId, lotNo');
  });

  it('칸을 짚어 거절되면 그 칸 이름을 보인다', async () => {
    seed([
      record({
        error: {
          kind: 'validation',
          status: 400,
          errors: [
            {
              scope: 'field',
              field: 'lines.0.receivedQty',
              code: 'QTY_EXCEEDS_ORDERED',
              message: '발주 수량과 허용치를 넘습니다.',
            },
          ],
        },
      }),
    ]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(valueOf(details, '응답 코드')).toBe('400');
    expect(valueOf(details, '오류 코드')).toBe('QTY_EXCEEDS_ORDERED');
    expect(valueOf(details, '걸린 칸')).toBe('lines.0.receivedQty');
  });

  /*
   * 코드와 걸린 칸은 같은 항목에서 와야 한다. 각각 따로 찾으면 항목이 섞여 올 때 서버가 한
   * 적 없는 짝이 서고, 담당자는 엉뚱한 칸 이름을 듣는다 - 빈 칸보다 나쁘다.
   */
  it('여러 항목이 와도 코드와 걸린 칸을 한 항목에서 뽑는다', async () => {
    seed([
      record({
        error: {
          kind: 'validation',
          status: 400,
          errors: [
            {
              scope: 'screen',
              code: 'UNIQUE_VIOLATION',
              message: '이미 있는 값입니다.',
              uniqueScope: ['plantId', 'lotNo'],
            },
            { scope: 'field', field: 'receivedQty', code: 'RANGE', message: '범위를 벗어납니다' },
          ],
        },
      }),
    ]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(valueOf(details, '오류 코드')).toBe('UNIQUE_VIOLATION');
    expect(valueOf(details, '걸린 칸')).toBe('plantId, lotNo');
  });

  /*
   * 코드 없는 항목이 앞에 올 수 있다. 그것을 대표로 삼으면 코드 칸이 비고, 걸린 칸도 그
   * 항목 것이 되어 둘 다 엉뚱해진다.
   */
  it('코드 없는 항목이 앞에 와도 코드를 가진 항목을 대표로 삼는다', async () => {
    seed([
      record({
        error: {
          kind: 'validation',
          status: 400,
          errors: [
            { scope: 'screen', code: '', message: '처리할 수 없습니다' },
            {
              scope: 'field',
              field: 'receivedQty',
              code: 'QTY_EXCEEDS_ORDERED',
              message: '발주 수량과 허용치를 넘습니다.',
            },
          ],
        },
      }),
    ]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(valueOf(details, '오류 코드')).toBe('QTY_EXCEEDS_ORDERED');
    expect(valueOf(details, '걸린 칸')).toBe('receivedQty');
  });

  /* 서버가 칸을 비우는 방식이 키를 빼는 것일 수도, 빈 문자열일 수도 있다. */
  it('걸린 칸이 빈 문자열로 오면 범위를 대신 보인다', async () => {
    seed([
      record({
        error: {
          kind: 'validation',
          status: 400,
          errors: [
            {
              scope: 'screen',
              field: '   ',
              code: 'UNIQUE_VIOLATION',
              message: '이미 있는 값입니다.',
              uniqueScope: ['plantId', 'lotNo'],
            },
          ],
        },
      }),
    ]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    expect(valueOf(screen.getByRole('group', { name: '상세' }), '걸린 칸')).toBe('plantId, lotNo');
  });

  /* 잠긴 상태도 같은 봉투로 온다. 다시 불러도 안 풀리는 갈래라 더 물어볼 일이 많다. */
  it('잠긴 상태도 상태와 코드와 걸린 칸을 보인다', async () => {
    seed([
      record({
        error: {
          kind: 'stateLocked',
          status: 422,
          errors: [
            {
              scope: 'field',
              field: 'statusCode',
              code: 'STATE_LOCKED',
              message: '확정된 뒤에는 고칠 수 없습니다',
            },
          ],
        },
      }),
    ]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(valueOf(details, '응답 코드')).toBe('422');
    expect(valueOf(details, '오류 코드')).toBe('STATE_LOCKED');
    expect(valueOf(details, '걸린 칸')).toBe('statusCode');
  });

  /* 화면이 스스로 만든 검증 오류에는 응답이 없다. 없는 상태를 지어내지 않는다. */
  it('서버가 아니라 화면이 만든 오류는 상태를 비운다', async () => {
    seed([
      record({
        error: {
          kind: 'validation',
          errors: [{ scope: 'screen', code: 'STALE_TOKEN', message: '다시 불러오세요' }],
        },
      }),
    ]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(valueOf(details, '응답 코드')).toBe('없음');
    expect(valueOf(details, '오류 코드')).toBe('STALE_TOKEN');
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

    expect(valueOf(details, '돌아온 문구')).toBe('없음');
  });

  /*
   * 401 은 이 화면을 만든 이유 그 자체다. 정규화가 빈 문구를 그대로 싣는 갈래라, 여기를
   * 재지 않으면 가장 자주 보는 자리가 무감지로 남는다.
   */
  it('오류 응답의 문구가 비어 있어도 없다고 적는다', async () => {
    seed([record({ error: { kind: 'http', status: 401, message: '' } })]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    const details = screen.getByRole('group', { name: '상세' });

    expect(valueOf(details, '응답 코드')).toBe('401');
    expect(valueOf(details, '돌아온 문구')).toBe('없음');
    /* 상세를 열기 전의 카드도 빈 줄이 되면 안 된다 - 같은 결함이 사유 쪽에도 있었다. */
    expect(screen.getByText(/보냈지만 등록되지 않았습니다/)).toBeInTheDocument();
  });

  /*
   * 항목마다 문구가 비어 있으면 이어 붙인 결과가 공백 한 칸이라 참으로 읽힌다. 그 값이
   * 그대로 나가면 칸도 카드도 빈 줄이 된다.
   */
  it('문구가 빈 항목만 오면 갈래별 문구로 대신한다', async () => {
    seed([
      record({
        error: {
          kind: 'validation',
          errors: [
            { scope: 'field', field: 'a', code: 'required', message: '' },
            { scope: 'field', field: 'b', code: 'required', message: '' },
          ],
        },
      }),
    ]);

    render();

    expect(await screen.findByText('적은 내용에 문제가 있습니다.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '상세 보기' }));

    expect(valueOf(screen.getByRole('group', { name: '상세' }), '돌아온 문구')).toBe('없음');
  });

  it('잠긴 상태의 문구가 전부 비어도 갈래별 문구로 대신한다', async () => {
    seed([
      record({
        error: {
          kind: 'stateLocked',
          errors: [
            { scope: 'field', field: 'a', code: 'locked', message: '' },
            { scope: 'field', field: 'b', code: 'locked', message: '' },
          ],
        },
      }),
    ]);

    render();

    expect(await screen.findByText('지금 상태에서는 할 수 없는 일입니다.')).toBeInTheDocument();
  });

  /* 코드 칸도 빈 문자열이 도달한다 - 계약이 문자열이기만 하면 싣는다. */
  it('오류 코드가 빈 문자열이면 없다고 적는다', async () => {
    seed([record({ error: { kind: 'http', status: 500, code: '', message: '멈췄습니다' } })]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    expect(valueOf(screen.getByRole('group', { name: '상세' }), '오류 코드')).toBe('없음');
  });

  /*
   * 앞 건이 못 가 붙을 곳이 없던 건은 상태 없는 오류를 달고 있다. 그 0 을 응답 코드로 내면
   * 담당자가 있지도 않은 코드를 찾는다.
   */
  it('앞 기록에 딸린 건은 없는 응답 코드를 지어 내지 않는다', async () => {
    seed([record({ cascaded: true, error: { kind: 'http', status: 0 } })]);

    render();

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }));

    expect(valueOf(screen.getByRole('group', { name: '상세' }), '응답 코드')).toBe('없음');
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

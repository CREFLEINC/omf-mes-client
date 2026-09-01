import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, renderWithProviders } from '../../test/api-harness';
import { WorkerSignInScreen } from './sign-in';

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

beforeEach(() => {
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
  it('목록을 받지 못했으면 없는 사번이라 하지 않는다', async () => {
    store.clear();
    const user = userEvent.setup();
    mount();

    await waitFor(() => {
      expect(screen.getAllByText('기준정보를 아직 받지 못했습니다').length).toBeGreaterThan(0);
    });

    await press(user, '900028');
    await user.click(screen.getByRole('button', { name: '확인' }));

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
});

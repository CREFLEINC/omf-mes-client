import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, renderWithProviders } from '../test/api-harness';
import { ShellGate } from './shell-gate';

const keystore = vi.hoisted(() => ({ token: null as string | null }));

vi.mock('../patterns/device-token', () => ({
  readDeviceToken: () => Promise.resolve(keystore.token),
  writeDeviceToken: (value: string) => {
    keystore.token = value;
    return Promise.resolve();
  },
  clearDeviceToken: () => {
    keystore.token = null;
    return Promise.resolve();
  },
  currentDeviceToken: () => keystore.token,
}));

afterEach(() => {
  keystore.token = null;
});

const renderGate = () => {
  renderWithProviders(
    <ShellGate>
      <p>작업 화면</p>
    </ShellGate>,
    { fetch: createStubFetch([]) },
  );
};

describe('셸 관문', () => {
  it('미등록이면 등록 화면만 보인다', async () => {
    renderGate();

    expect(await screen.findByText('이 기기는 아직 등록되지 않았습니다')).toBeInTheDocument();
    expect(screen.queryByText('작업 화면')).not.toBeInTheDocument();
  });

  it('등록됐으면 아래 화면을 그대로 통과시킨다', async () => {
    keystore.token = 'tok-1';

    renderGate();

    expect(await screen.findByText('작업 화면')).toBeInTheDocument();
  });

  it('판정 전에는 어느 쪽도 보이지 않는다', () => {
    renderGate();

    expect(screen.getByRole('status')).toHaveTextContent('등록 상태를 확인하는 중입니다');
    expect(screen.queryByText('작업 화면')).not.toBeInTheDocument();
  });
});

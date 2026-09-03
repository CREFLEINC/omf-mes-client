import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { createStubFetch, renderWithProviders } from '../../test/api-harness';
import { EQUIPMENT_ID, PROCESS_ID, TERMINAL_ID, WORKER_NO } from './fixtures';

/**
 * 큐가 멈춘 것을 **화면이 말하는가.** 훅 시험이 `isStalled` 를 세우는 것까지 보므로 여기서는
 * 그 값이 실제로 배너로 나오고 버튼이 큐를 깨우는지만 본다.
 *
 * ⚠ 큐를 실제로 6번 실패시켜 멈춤에 이르게 하려면 가짜 시계로 몇 분을 흘려야 한다 — 그것은
 * 훅 시험이 이미 한다. 여기서는 훅을 대신 세워 **배선**만 겨눈다.
 */
const retryNow = vi.fn();

vi.mock('./outbox', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./outbox')>()),
  useOutbox: () => ({
    pendingCount: 1,
    pendingCreates: [],
    isOnline: true,
    enqueueCreate: vi.fn(),
    enqueueClose: vi.fn(),
    accepted: [],
    rejections: [],
    clearRejections: vi.fn(),
    isStalled: true,
    retryNow,
  }),
}));

const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

describe('DowntimeRegisterScreen — 멈춤 배선', () => {
  it('큐가 멈추면 그 사실을 화면이 말하고, 눌러 깨울 수 있다', async () => {
    const user = userEvent.setup();
    const { DowntimeRegisterScreen } = await import('./screen');

    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <DowntimeRegisterScreen />
      </PopIdentityProvider>,
      { fetch: createStubFetch([]), route: `/pop/downtime?equipmentId=${String(EQUIPMENT_ID)}` },
    );

    expect(await screen.findByText(messages.common.connection.stalledTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.connection.stalledRetry }));

    expect(retryNow).toHaveBeenCalledTimes(1);
  });
});

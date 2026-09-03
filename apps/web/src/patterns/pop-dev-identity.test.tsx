import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { POP_DEV_TERMINAL_ID, POP_DEV_WORKER_NO, PopDevIdentityProvider } from './pop-dev-identity';
import { usePopIdentity } from './pop-identity';
import { setWorkerSession, type WorkerSession } from './worker-session';

/** 현재 작업자는 화면 밖 단일 자리에 있다 — 시험 사이에 비우지 않으면 다음 시험에 샌다. */
afterEach(() => {
  setWorkerSession(null);
});

const Probe = () => {
  const { terminalId, workerNo } = usePopIdentity();

  return <output>{`${String(terminalId)}/${String(workerNo)}`}</output>;
};

const sessionOf = (workerNo: string): WorkerSession => ({
  worker: {
    workerId: 1001,
    workerNo,
    workerName: '김작업',
    businessUnitId: 1,
    plantId: 10,
    statusCode: 'ACTIVE',
    isActive: true,
  },
  assignedAt: '2026-09-03 10:00',
  isOtherPlant: false,
});

describe('PopDevIdentityProvider — 개발 서버의 임시 단말 신원', () => {
  it('아무도 사번을 치지 않았으면 데모 사번으로 채운다', () => {
    render(
      <PopDevIdentityProvider>
        <Probe />
      </PopDevIdentityProvider>,
    );

    expect(screen.getByRole('status').textContent).toBe(
      `${String(POP_DEV_TERMINAL_ID)}/${POP_DEV_WORKER_NO}`,
    );
  });

  /* ⭐ 사람이 실제로 친 사번으로 기록되는 편이 시연에 정직하다 — 지어낸 값이 덮지 않는다. */
  it('진입 화면이 정한 사번을 데모 사번보다 앞세운다', () => {
    setWorkerSession(sessionOf('100027'));

    render(
      <PopDevIdentityProvider>
        <Probe />
      </PopDevIdentityProvider>,
    );

    expect(screen.getByRole('status').textContent).toBe(`${String(POP_DEV_TERMINAL_ID)}/100027`);
  });
});

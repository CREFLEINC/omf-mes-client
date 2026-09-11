import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { POP_DEV_TERMINAL_ID, PopDevIdentityProvider } from './pop-dev-identity';
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
  /*
   * ⛔ **데모 사번으로 메우지 않는다.** 메우면 새로고침 한 번에 남는 기록의 귀속이 조용히
   * 다른 사람으로 넘어갔다(#1041). 「모른다」를 그대로 내려보내야 화면이 막고 사람이 안다.
   */
  it('아무도 사번을 치지 않았으면 사번을 비운 채로 둔다', () => {
    render(
      <PopDevIdentityProvider>
        <Probe />
      </PopDevIdentityProvider>,
    );

    expect(screen.getByRole('status').textContent).toBe(`${String(POP_DEV_TERMINAL_ID)}/null`);
  });

  it('진입 화면이 정한 사번을 그대로 내려보낸다', () => {
    setWorkerSession(sessionOf('100027'));

    render(
      <PopDevIdentityProvider>
        <Probe />
      </PopDevIdentityProvider>,
    );

    expect(screen.getByRole('status').textContent).toBe(`${String(POP_DEV_TERMINAL_ID)}/100027`);
  });
});

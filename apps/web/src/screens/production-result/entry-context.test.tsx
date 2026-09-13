import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';
import { setWorkerSession } from '../../patterns/worker-session';
import { renderWithProviders } from '../../test/api-harness';

import { canWrite, useResultEntry } from './entry-context';

/**
 * **개발 셸이 사번을 지어내지 않는지** 재는 자리(#1041).
 *
 * ⭐ **왜 셸 공급자까지 끼워서 재는가.** 사번은 메모리에만 있어(스펙 §5-4) 주소로 다시 열거나
 * 새로고침하면 세션이 빈다. 그때 셸이 데모 사번으로 메우면, 100027 을 친 사람의 실적이
 * **아무 말 없이** 100029 앞으로 저장된다(88단계 시험 결함 2). 훅만 따로 재면 그 메움이
 * 보이지 않으므로, 화면이 실제로 서는 조합 그대로 잰다.
 *
 * ⚠ 공급자는 이제 등록 흐름이 세운다(`patterns/pop-registration`) — 여기서는 그것이 사번에
 * 대해 하는 일과 **같은 배선**을 세워 둔다(세션에 있으면 그 값, 없으면 `null`).
 */
const Probe = () => {
  const entry = useResultEntry();

  return <output>{`${String(entry.workerNo)}/${String(canWrite(entry))}`}</output>;
};

/** 등록 흐름이 사번에 대해 하는 일과 같다 — 세션에 있으면 그 값, 없으면 `null`. */
const ShellIdentity = ({ children }: { children: React.ReactNode }) => {
  const session = useWorkerSession();

  return (
    <PopIdentityProvider
      value={{
        terminalId: 1001,
        processes: [{ processId: 1001 }],
        equipment: null,
        workerNo: session?.worker.workerNo ?? null,
      }}
    >
      {children}
    </PopIdentityProvider>
  );
};

const renderProbe = (route: string) =>
  renderWithProviders(
    <ShellIdentity>
      <Probe />
    </ShellIdentity>,
    { route },
  );

const reading = (): string | null => screen.getByRole('status').textContent;

describe('useResultEntry — 개발 셸 아래의 귀속 사번', () => {
  /** 현재 작업자는 화면 밖 단일 자리에 있다 — 비우지 않으면 다음 시험에 샌다. */
  afterEach(() => {
    setWorkerSession(null);
  });

  it('⛔ 세션 없이 주소로 열면 사번이 비고 저장이 막힌다 — 데모 사번으로 메우지 않는다', () => {
    renderProbe('/pop/production-result?workOrderId=11002');

    expect(reading()).toBe('null/false');
  });

  it('진입 화면이 지정한 작업자를 그대로 이어받는다', () => {
    setWorkerSession({
      worker: {
        workerId: 1001,
        workerNo: '100027',
        workerName: '김작업',
        businessUnitId: 1,
        plantId: 10,
        statusCode: 'ACTIVE',
        isActive: true,
      },
      assignedAt: '2026-09-11T08:00:00+09:00',
      isOtherPlant: false,
    });

    renderProbe('/pop/production-result?workOrderId=11002');

    expect(reading()).toBe('100027/true');
  });
});

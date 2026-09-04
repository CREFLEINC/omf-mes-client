import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { setWorkerSession } from '../../patterns/worker-session';
import {
  parseWorkerNo,
  parseWorkOrderId,
  useWorkHoldEntry,
  type WorkHoldEntry,
} from './entry-context';

describe('진입 컨텍스트 읽기', () => {
  it('양의 정수만 작업지시로 읽는다', () => {
    expect(parseWorkOrderId('4013')).toBe(4013);
  });

  it.each(['', ' ', '0', '-3', '1.5', 'abc', '4013a'])('%o 는 작업지시가 아니다', (raw) => {
    expect(parseWorkOrderId(raw)).toBeNull();
  });

  it('없으면 null 이다 — 없는 값을 지어내지 않는다', () => {
    expect(parseWorkOrderId(null)).toBeNull();
    expect(parseWorkerNo(null)).toBeNull();
  });

  it('사번의 앞뒤 공백은 턴다', () => {
    expect(parseWorkerNo('  20260901 ')).toBe('20260901');
    expect(parseWorkerNo('   ')).toBeNull();
  });
});

/**
 * ⭐ **사번은 한 자리에서 읽는다** — 셸의 `pop-identity` 가 정본이고, 비어 있을 때만 뒤를 본다.
 * 순서가 뒤집히면 셸이 아는 사람과 다른 사람으로 기록되는데, 화면은 멀쩡히 뜬다.
 */
describe('사번 출처의 우선순위', () => {
  afterEach(() => {
    setWorkerSession(null);
  });

  const entryAt = (route: string, identityWorkerNo: string | null): WorkHoldEntry =>
    renderHook(() => useWorkHoldEntry(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[route]}>
          <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, workerNo: identityWorkerNo }}>
            {children}
          </PopIdentityProvider>
        </MemoryRouter>
      ),
    }).result.current;

  const assignWorkerSession = (workerNo: string): void => {
    setWorkerSession({
      worker: {
        workerId: 1001,
        workerNo,
        workerName: '김작업',
        businessUnitId: 1,
        plantId: 10,
        statusCode: 'ACTIVE',
        isActive: true,
      },
      assignedAt: '2026-09-02 08:00',
      isOtherPlant: false,
    });
  };

  it('셸이 사번을 알면 그것이 먼저다', () => {
    assignWorkerSession('900044');

    expect(entryAt('/pop/work-hold?workerNo=900099', '900028').workerNo).toBe('900028');
  });

  it('셸이 비어 있으면 지정된 작업자가 주소보다 먼저다', () => {
    assignWorkerSession('900044');

    expect(entryAt('/pop/work-hold?workerNo=900099', null).workerNo).toBe('900044');
  });

  it('둘 다 비어 있을 때만 주소를 쓴다', () => {
    expect(entryAt('/pop/work-hold?workerNo=900099', null).workerNo).toBe('900099');
  });

  it('아무 데도 없으면 지어내지 않는다', () => {
    expect(entryAt('/pop/work-hold', null).workerNo).toBeNull();
  });
});

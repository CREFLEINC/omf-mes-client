import { afterEach, describe, expect, it } from 'vitest';

import { UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { setWorkerSession } from '../../patterns/worker-session';
import { renderHookWithProviders } from '../../test/api-harness';

import { mergeIdentity, usePackingIdentity } from './entry-context';

describe('usePackingIdentity', () => {
  afterEach(() => {
    setWorkerSession(null);
  });

  const assignWorker = (workerNo: string): void => {
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
      assignedAt: '2026-09-09T08:00:00+09:00',
      isOtherPlant: false,
    });
  };

  it('셸이 모를 때 단말 번호·사번은 주소에서 받는다 — 개발 확인용 임시 통로다', () => {
    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing?terminalId=101&workerNo=3391',
    });

    expect(result.current).toEqual({ terminalId: 101, processes: null, workerNo: '3391' });
  });

  /**
   * ⛔ **공정 구성은 주소로 열 수 없다**(#999 · 공유계약 F-4). 등록 때 서버에서 받은 목록이
   * 정본이라, 주소로 덮을 수 있으면 게이팅이 「주소를 고치는 것」으로 열린다.
   */
  it('⛔ 주소의 processId 는 공정 구성을 만들지 않는다', () => {
    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing?terminalId=101&processId=301',
    });

    expect(result.current.processes).toBeNull();
  });

  it('⭐ 셸이 채운 값이 «주소보다» 이긴다 — 단말이 자기에 대해 아는 것이 옳다', () => {
    const merged = mergeIdentity(
      { terminalId: 101, processes: [{ processId: 301 }], workerNo: '3391' },
      new URLSearchParams('terminalId=999&processId=999&workerNo=9999'),
    );

    expect(merged).toEqual({ terminalId: 101, processes: [{ processId: 301 }], workerNo: '3391' });
  });

  it('셸이 아무것도 모르면 주소가 단말 번호·사번을 메운다 — 공정은 메우지 않는다', () => {
    const merged = mergeIdentity(
      UNKNOWN_POP_IDENTITY,
      new URLSearchParams('terminalId=101&processId=301&workerNo=3391'),
    );

    expect(merged).toEqual({ terminalId: 101, processes: null, workerNo: '3391' });
  });

  it('P-CO-01이 지정한 작업자를 주소 없이 이어받는다', () => {
    assignWorker('900044');

    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing?terminalId=101',
    });

    expect(result.current).toEqual({ terminalId: 101, processes: null, workerNo: '900044' });
  });

  it('셸이 사번을 알면 현재 작업자 세션과 주소보다 먼저 쓴다', () => {
    expect(
      mergeIdentity(
        { terminalId: 101, processes: [{ processId: 301 }], workerNo: '900028' },
        new URLSearchParams('workerNo=900099'),
        '900044',
      ).workerNo,
    ).toBe('900028');
  });

  it('셸이 비어 있으면 현재 작업자 세션을 주소보다 먼저 쓴다', () => {
    expect(
      mergeIdentity(UNKNOWN_POP_IDENTITY, new URLSearchParams('workerNo=900099'), '900044')
        .workerNo,
    ).toBe('900044');
  });

  it('⛔ 없는 값을 지어내지 않는다 — 빈 주소는 «모른다»로 남는다', () => {
    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing',
    });

    expect(result.current).toEqual({ terminalId: null, processes: null, workerNo: null });
  });

  it('숫자가 아니거나 0 이하인 단말 번호는 «모른다»로 다룬다', () => {
    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing?terminalId=abc&processId=0&workerNo=%20%20',
    });

    expect(result.current).toEqual({ terminalId: null, processes: null, workerNo: null });
  });
});

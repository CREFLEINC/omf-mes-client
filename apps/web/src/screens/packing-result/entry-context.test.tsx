import { describe, expect, it } from 'vitest';

import { UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { renderHookWithProviders } from '../../test/api-harness';

import { mergeIdentity, usePackingIdentity } from './entry-context';

describe('usePackingIdentity', () => {
  it('셸이 모를 때 주소에서 받는다 — 단말·인증이 서기 전의 임시 통로다', () => {
    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing?terminalId=101&processId=301&workerNo=3391',
    });

    expect(result.current).toEqual({ terminalId: 101, processId: 301, workerNo: '3391' });
  });

  it('⭐ 셸이 채운 값이 «주소보다» 이긴다 — 단말이 자기에 대해 아는 것이 옳다', () => {
    const merged = mergeIdentity(
      { terminalId: 101, processId: 301, workerNo: '3391' },
      new URLSearchParams('terminalId=999&processId=999&workerNo=9999'),
    );

    expect(merged).toEqual({ terminalId: 101, processId: 301, workerNo: '3391' });
  });

  it('셸이 아무것도 모르면 주소가 그 자리를 메운다', () => {
    const merged = mergeIdentity(
      UNKNOWN_POP_IDENTITY,
      new URLSearchParams('terminalId=101&processId=301&workerNo=3391'),
    );

    expect(merged).toEqual({ terminalId: 101, processId: 301, workerNo: '3391' });
  });

  it('⛔ 없는 값을 지어내지 않는다 — 빈 주소는 «모른다»로 남는다', () => {
    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing',
    });

    expect(result.current).toEqual({ terminalId: null, processId: null, workerNo: null });
  });

  it('숫자가 아니거나 0 이하인 단말 번호는 «모른다»로 다룬다', () => {
    const { result } = renderHookWithProviders(() => usePackingIdentity(), {
      route: '/pop/packing?terminalId=abc&processId=0&workerNo=%20%20',
    });

    expect(result.current).toEqual({ terminalId: null, processId: null, workerNo: null });
  });
});

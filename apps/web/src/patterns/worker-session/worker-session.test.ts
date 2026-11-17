import { afterEach, describe, expect, it, vi } from 'vitest';

const SESSION = {
  worker: { workerId: 1, workerNo: '2048', workerName: '합성 작업자' },
  assignedAt: '2026-11-17T09:00:00+09:00',
  isOtherPlant: false,
};

const load = async () => {
  vi.resetModules();
  return import('./worker-session');
};

afterEach(() => {
  window.sessionStorage.clear();
});

describe('worker-session — 새로 고침에도 사번 유지(#291)', () => {
  it('지정한 사번은 창 세션에 남아, 다시 불러도(새로 고침) 되찾는다', async () => {
    const first = await load();
    first.setWorkerSession(SESSION as never);

    const second = await load();
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => second.useWorkerSession());
    expect(result.current?.worker.workerNo).toBe('2048');
  });

  it('[사용자 전환]으로 지우면 창 세션에서도 지운다', async () => {
    const first = await load();
    first.setWorkerSession(SESSION as never);
    first.setWorkerSession(null);

    expect(window.sessionStorage.length).toBe(0);
  });

  it('모양이 다른 값은 되찾지 않는다', async () => {
    window.sessionStorage.setItem('omf.pop.workerSession', '{"worker":{}}');
    const second = await load();
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => second.useWorkerSession());
    expect(result.current).toBeNull();
  });
});

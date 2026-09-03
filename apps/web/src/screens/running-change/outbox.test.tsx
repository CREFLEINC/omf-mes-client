import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { makeConsumption, WORKER_NO } from './fixtures';
import { useOutbox } from './outbox';

/**
 * 큐의 규율을 잰다 — **공유계약 C-1·C-2**. 화면 시험이 닿지 못하는 자리다: 재전송 키의
 * 수명과 거부 건의 격리는 한 번의 조작으로는 드러나지 않는다.
 */

const BODY = {
  workOrderId: 1001,
  itemId: 2002,
  lotId: 90202,
  replacedConsumptionId: 55001,
  inputQty: 120,
  uomId: 11,
  occurredAt: '2026-09-02T09:12:00+09:00',
};

const secondBody = { ...BODY, lotId: 90203 };

interface Attempt {
  key: string | null;
  workerNo: string | null;
  lotId: number;
}

/** 시도를 전부 담고, `failFirst`면 첫 시도만 통신 실패로 만든다. */
const routes = (
  attempts: Attempt[],
  behave: (attempt: number) => Response | 'network',
): StubRoute[] => [
  {
    match: (request) =>
      request.method === 'POST' &&
      new URL(request.url).pathname === '/production/material-consumptions',
    respond: (request) => {
      const index = attempts.length;
      const outcome = behave(index);

      /* 본문을 읽으려면 복제해야 한다 — 스텁이 소비하면 클라이언트가 못 읽는다. */
      const clone = request.clone();
      void clone.json().then((body: { lotId: number }) => {
        const attempt = attempts[index];
        if (attempt !== undefined) attempt.lotId = body.lotId;
      });

      attempts.push({
        key: request.headers.get('Idempotency-Key'),
        workerNo: request.headers.get('X-Worker-No'),
        lotId: 0,
      });

      if (outcome === 'network') throw new TypeError('연결 끊김');

      return outcome;
    },
  },
];

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('교체 등록 큐', () => {
  it('담자마자 미전송 건수가 오르고 사번·멱등 키를 실어 보낸다', async () => {
    const attempts: Attempt[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(
        routes(attempts, () => jsonResponse(makeConsumption(), { status: 201 })),
      ),
    });

    act(() => {
      result.current.enqueue(WORKER_NO, BODY);
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(1);
    });

    expect(attempts[0]?.workerNo).toBe(WORKER_NO);
    expect(attempts[0]?.key).toBeTruthy();

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });
    expect(result.current.accepted).toHaveLength(1);
  });

  /*
   * ⛔ C-1 #5 — 재전송은 **같은 키로** 나간다. 시도마다 새로 만들면 서버가 흡수하지 못해
   * **재전송이 새 전표가 되고**, 교체는 지우지 않고 잇는 것이라 되돌릴 방법이 없다.
   */
  it('통신 실패 뒤 다시 보낼 때 같은 멱등 키를 쓴다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const attempts: Attempt[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(
        routes(attempts, (index) =>
          index === 0 ? 'network' : jsonResponse(makeConsumption(), { status: 201 }),
        ),
      ),
    });

    act(() => {
      result.current.enqueue(WORKER_NO, BODY);
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(1);
    });
    /* 통신 실패는 큐에 남는다 — 기다리면 풀린다. */
    expect(result.current.pendingCount).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(2);
    });
    expect(attempts[1]?.key).toBe(attempts[0]?.key);
  });

  /*
   * ⛔ C-2 — 전체 롤백을 하지 않는다. 40건 중 1건 때문에 39건을 버리면 현장이 마비된다.
   */
  it('서버가 거부하면 그 건만 내리고 뒤엣것은 그대로 보낸다', async () => {
    const attempts: Attempt[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(
        routes(attempts, (index) =>
          index === 0
            ? jsonResponse({ code: 'INVALID_STATE', message: '거부' }, { status: 400 })
            : jsonResponse(makeConsumption(), { status: 201 }),
        ),
      ),
    });

    act(() => {
      result.current.enqueue(WORKER_NO, BODY);
      result.current.enqueue(WORKER_NO, secondBody);
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(2);
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });
    expect(result.current.rejections).toHaveLength(1);
    /* 뒤엣것은 살아서 받아졌다 — 앞 건의 거부가 뒤를 끌고 내려가지 않는다. */
    expect(result.current.accepted).toHaveLength(1);
  });

  /*
   * ⛔ 모양이 깨진 항목을 그대로 보내면 서버가 무엇을 기록할지 화면이 알 수 없다. 특히
   * `replacedConsumptionId` 가 빠지면 **평범한 투입**으로 기록되어 조용히 어긋난다.
   */
  it('저장소에 남은 항목 중 교체 축이 빠진 것은 보내지 않는다', async () => {
    globalThis.localStorage.setItem(
      'omf-mes.running-change.outbox',
      JSON.stringify([
        { idempotencyKey: 'a', workerNo: WORKER_NO, body: BODY },
        {
          idempotencyKey: 'b',
          workerNo: WORKER_NO,
          body: { ...BODY, replacedConsumptionId: undefined },
        },
      ]),
    );

    const attempts: Attempt[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(
        routes(attempts, () => jsonResponse(makeConsumption(), { status: 201 })),
      ),
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.key).toBe('a');
  });
});

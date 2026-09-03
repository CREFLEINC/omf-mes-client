import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { MAX_AUTO_ATTEMPTS, retryDelayOf } from '../../patterns/outbox-policy';

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
  /*
   * ⛔ **서버 오류를 거부로 읽지 않는다**(#772 전례). 502·503·504 는 서버가 「지금은 못
   * 받는다」고 말한 것이지 「이것은 안 된다」고 판정한 것이 아니다. 여기서 큐에서 내리면 화면은
   * 이미 「담았습니다」를 띄우고 입력을 비운 뒤라 **작업자가 친 교체를 되돌릴 방법이 없다.**
   */
  it('서버 오류(503)에서는 큐에 남아 같은 멱등 키로 다시 나간다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const attempts: Attempt[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(
        routes(attempts, (index) =>
          index === 0
            ? jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 })
            : jsonResponse(makeConsumption(), { status: 201 }),
        ),
      ),
    });

    act(() => {
      result.current.enqueue(WORKER_NO, BODY);
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(1);
    });
    /* 남아 있어야 한다 — 내려갔다면 그 순간 값이 사라진 것이다. */
    expect(result.current.pendingCount).toBe(1);
    /* 「멈췄다」도 「거부됐다」도 아니다 — 기다리는 중이다. */
    expect(result.current.rejections).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayOf(1) + 1_000);
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(2);
    });
    expect(attempts[1]?.key).toBe(attempts[0]?.key);

    await waitFor(() => {
      expect(result.current.accepted).toHaveLength(1);
    });
  });

  /*
   * ⛔ **상한에 닿아도 큐에서 내리지 않는다.** 자동 재전송만 멈추고, 멈췄다는 사실을 화면이
   * 말한다(`isStalled` → `OutboxStallBanner`). 건수만으로는 「밀리는 중」과 구분되지 않는다.
   */
  it('서버 오류가 이어지면 자동 재전송만 멈추고 항목은 남는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const attempts: Attempt[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(
        routes(attempts, () => jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 })),
      ),
    });

    act(() => {
      result.current.enqueue(WORKER_NO, BODY);
    });

    for (let tried = 1; tried < MAX_AUTO_ATTEMPTS; tried += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(retryDelayOf(tried) + 1_000);
      });
    }

    await waitFor(() => {
      expect(result.current.isStalled).toBe(true);
    });
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.rejections).toHaveLength(0);

    /* 멈춘 뒤에는 더 던지지 않는다. */
    const sentSoFar = attempts.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayOf(MAX_AUTO_ATTEMPTS) * 3);
    });
    expect(attempts).toHaveLength(sentSoFar);

    /* 사람이 누르면 **같은 키로** 다시 나간다. */
    await act(async () => {
      result.current.retryNow();
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(attempts.length).toBeGreaterThan(sentSoFar);
    });
    expect(result.current.isStalled).toBe(false);
    expect(attempts.at(-1)?.key).toBe(attempts[0]?.key);
  });
});

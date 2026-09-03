import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_AUTO_ATTEMPTS, retryDelayOf } from '../../patterns/outbox-policy';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useOutbox } from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 쓰기**다 — 투입은 재고를 움직인다.
 *
 * ⚠ 실패 판정·백오프 자체는 화면 밖 공용물이라 `patterns/outbox-policy.test.ts` 가 본다.
 * 여기서는 **이 화면의 큐가 그 판정대로 움직이는가**만 겨눈다.
 */

const BODY = {
  workOrderId: 1001,
  itemId: 1001,
  lotId: 1001,
  inputQty: 30,
  uomId: 1001,
  occurredAt: '2026-09-03T09:12:00+09:00',
};

describe('useOutbox — 끝나지 않는 장애에서 멈추되 담긴 것은 남긴다', () => {
  /** 언제 물어도 「지금은 못 받는다」고 답하는 서버. */
  const unavailable = (sent?: Request[]) => [
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/production/material-consumptions',
      respond: (request: Request) => {
        sent?.push(request);

        return jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 });
      },
    },
  ];

  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.localStorage.clear();
  });

  /** 상한에 닿을 때까지 기다림을 흘려보낸다 — 간격이 시도마다 늘어난다. */
  const runOutRetries = async (): Promise<void> => {
    for (let tried = 1; tried < MAX_AUTO_ATTEMPTS; tried += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(retryDelayOf(tried) + 1_000);
      });
    }
  };

  /*
   * ⛔ **멈출 때도 큐에서 내리지 않는다.** 내리면 작업자가 스캔한 것이 사라지고, 그것이 이
   * 큐가 막으려는 바로 그 일이다.
   */
  it('자동 재전송을 멈춰도 담긴 것은 큐에 남는다', async () => {
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(unavailable()),
    });

    act(() => {
      result.current.enqueue('900123', BODY);
    });

    await runOutRetries();

    expect(result.current.isStalled).toBe(true);
    expect(result.current.pendingCount).toBe(1);
    /* 거부가 아니므로 되돌아온 목록에 넣지 않는다 — 「멈췄다」와 「거부됐다」는 다른 말이다. */
    expect(result.current.rejections).toHaveLength(0);
  });

  it('멈춘 뒤에는 더 던지지 않고, 사람이 누르면 같은 멱등 키로 다시 나간다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(unavailable(sent)),
    });

    act(() => {
      result.current.enqueue('900123', BODY);
    });

    await runOutRetries();
    const sentSoFar = sent.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayOf(MAX_AUTO_ATTEMPTS) * 3);
    });
    expect(sent).toHaveLength(sentSoFar);

    await act(async () => {
      result.current.retryNow();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isStalled).toBe(false);
    expect(sent.length).toBeGreaterThan(sentSoFar);
    /* ⛔ 다시 보내도 **같은 멱등 키**다 — 새 투입이 되면 재고가 두 번 움직인다. */
    expect(sent.at(-1)?.headers.get('Idempotency-Key')).toBe(
      sent[0]?.headers.get('Idempotency-Key'),
    );
  });
});

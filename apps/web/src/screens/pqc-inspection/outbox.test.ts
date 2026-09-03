import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_AUTO_ATTEMPTS, retryDelayOf } from '../../patterns/outbox-policy';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { isSendableEntry, useOutbox } from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 쓰기**다. 화면 시험이 「끊긴 채 저장」과 「새로고침을
 * 넘는 멱등 키」를 덮으므로, 여기서는 화면을 세우지 않고 **갈래 판정** 둘을 직접 겨눈다.
 */

describe('isSendableEntry — 저장소에서 읽은 값을 믿지 않는다', () => {
  const body = {
    inspectionRequestId: 1001,
    inspectedQty: 30,
    acceptedQty: 28,
    rejectedQty: 2,
    heldQty: 0,
    uomId: 10,
    inspectedAt: '2026-09-02T10:00:00+09:00',
    statusCode: '작성중',
  };

  it('계약이 필수로 둔 것이 갖춰지면 보낼 수 있다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1', body })).toBe(true);
  });

  /* ⛔ 키가 없으면 재전송이 **새 검사 결과**가 된다 — 보내지 않는 편이 낫다. */
  it('멱등 키가 없으면 보내지 않는다', () => {
    expect(isSendableEntry({ body })).toBe(false);
    expect(isSendableEntry({ idempotencyKey: '', body })).toBe(false);
  });

  it('본문이 없거나 객체가 아니면 보내지 않는다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1' })).toBe(false);
    expect(isSendableEntry({ idempotencyKey: 'k-1', body: 'x' })).toBe(false);
  });

  /* 수량이 문자열로 굳어 있는 판이 저장소에 남아 있을 수 있다 — 그대로 보내면 서버가
   * 무엇을 기록할지 화면이 알 수 없다. */
  it('수량이 수치가 아니면 보내지 않는다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1', body: { ...body, acceptedQty: '28' } })).toBe(
      false,
    );
  });

  it('검사 시각이 없으면 보내지 않는다 — 언제 잰 것인지 모르는 판정은 기록이 아니다', () => {
    const { inspectedAt: _dropped, ...withoutTime } = body;

    expect(isSendableEntry({ idempotencyKey: 'k-1', body: withoutTime })).toBe(false);
  });

  it('객체가 아닌 것은 전부 걸러 낸다', () => {
    expect(isSendableEntry(null)).toBe(false);
    expect(isSendableEntry('k-1')).toBe(false);
    expect(isSendableEntry(undefined)).toBe(false);
  });
});

describe('useOutbox — 끝나지 않는 장애에서 멈추되 담긴 것은 남긴다', () => {
  /** 언제 물어도 「지금은 못 받는다」고 답하는 서버. */
  const unavailable = (sent?: Request[]) => [
    {
      match: (request: Request) => new URL(request.url).pathname === '/quality/inspection-results',
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
   * ⛔ **멈출 때도 큐에서 내리지 않는다.** 내리면 작업자가 남긴 것이 사라지고, 그것이 이 큐가
   * 막으려는 바로 그 일이다.
   */
  it('자동 재전송을 멈춰도 담긴 것은 큐에 남는다', async () => {
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(unavailable()),
    });

    act(() => {
      result.current.enqueue({
        inspectionRequestId: 1001,
        inspectedQty: 30,
        acceptedQty: 28,
        rejectedQty: 2,
        heldQty: 0,
        uomId: 10,
        inspectedAt: '2026-09-02T10:00:00+09:00',
        statusCode: '작성중',
      });
    });

    await runOutRetries();

    expect(result.current.isStalled).toBe(true);
    expect(result.current.pendingCount).toBe(1);
  });

  it('멈춘 뒤에는 더 던지지 않고, 사람이 누르면 같은 멱등 키로 다시 나간다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(unavailable(sent)),
    });

    act(() => {
      result.current.enqueue({
        inspectionRequestId: 1001,
        inspectedQty: 30,
        acceptedQty: 28,
        rejectedQty: 2,
        heldQty: 0,
        uomId: 10,
        inspectedAt: '2026-09-02T10:00:00+09:00',
        statusCode: '작성중',
      });
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
    expect(sent.at(-1)?.headers.get('Idempotency-Key')).toBe(
      sent[0]?.headers.get('Idempotency-Key'),
    );
  });
});

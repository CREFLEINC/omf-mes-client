import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_AUTO_ATTEMPTS, retryDelayOf } from '../../patterns/outbox-policy';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { isSendableEntry, useOutbox, type OutboxEntry } from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 쓰기**다 — 실적은 정정 실적을 새로 만들어야 지워진다.
 *
 * ⚠ 실패 판정·백오프는 화면 밖 공용물이라 `patterns/outbox-policy.test.ts` 가 본다. 여기서는
 * **이 화면의 큐**만 겨눈다.
 */

describe('isSendableEntry — 저장소에서 읽은 값을 믿지 않는다', () => {
  const body = {
    workOrderId: 1001,
    goodQty: 120,
    uomId: 10,
    resultSourceCode: 'MANUAL',
    occurredAt: '2026-09-02T09:12:00+09:00',
  };

  const entry = { idempotencyKey: 'key-1', workerNo: '900123', body };

  it('갖출 것을 갖춘 항목은 보낼 수 있다', () => {
    expect(isSendableEntry(entry)).toBe(true);
  });

  it('멱등 키가 비면 보내지 않는다 — 재전송이 새 실적이 된다', () => {
    expect(isSendableEntry({ ...entry, idempotencyKey: '' })).toBe(false);
  });

  /*
   * ⭐ **사번은 헤더로만 나가므로 본문 검사로는 걸러지지 않는다.** 없으면 서버가 그대로
   * 거부하고, 그 거부는 화면이 이미 성공을 말한 뒤에 온다.
   */
  it('사번이 없으면 보내지 않는다 — 없으면 서버가 거부한다', () => {
    expect(isSendableEntry({ idempotencyKey: 'key-1', body })).toBe(false);
    expect(isSendableEntry({ ...entry, workerNo: '' })).toBe(false);
  });

  it('계약이 필수로 둔 칸이 빠지면 보내지 않는다', () => {
    const required = ['workOrderId', 'goodQty', 'uomId', 'resultSourceCode', 'occurredAt'];

    for (const field of required) {
      const broken: Record<string, unknown> = { ...body };
      delete broken[field];

      expect(isSendableEntry({ ...entry, body: broken })).toBe(false);
    }
  });

  it('객체가 아닌 값은 보내지 않는다', () => {
    expect(isSendableEntry(null)).toBe(false);
    expect(isSendableEntry('key-1')).toBe(false);
    expect(isSendableEntry({ ...entry, body: null })).toBe(false);
  });
});

describe('useOutbox — 끝나지 않는 장애에서 멈추되 실적은 남긴다', () => {
  const body = {
    workOrderId: 1001,
    goodQty: 120,
    uomId: 1001,
    resultSourceCode: 'MANUAL',
    occurredAt: '2026-09-02T09:12:00+09:00',
  } satisfies OutboxEntry['body'];

  /** 언제 물어도 「지금은 못 받는다」고 답하는 서버. */
  const alwaysUnavailable = [
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/production/production-results',
      respond: () => jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 }),
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
   * ⛔ **멈출 때도 큐에서 내리지 않는다.** 내리면 작업자가 친 실적이 사라지고, 그것이 이 큐가
   * 막으려는 바로 그 일이다.
   */
  it('자동 재전송을 멈춰도 실적은 큐에 남는다', async () => {
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(alwaysUnavailable),
    });

    act(() => {
      result.current.enqueue('900123', body);
    });

    await runOutRetries();

    expect(result.current.isStalled).toBe(true);
    expect(result.current.pendingCount).toBe(1);
    /* 거부가 아니므로 배너용 오류는 세우지 않는다 — 「멈췄다」와 「거부됐다」는 다른 말이다. */
    expect(result.current.rejection).toBeNull();
  });

  it('멈춘 뒤에는 더 던지지 않는다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch([
        {
          match: (request: Request) =>
            new URL(request.url).pathname === '/production/production-results',
          respond: (request: Request) => {
            sent.push(request);

            return jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 });
          },
        },
      ]),
    });

    act(() => {
      result.current.enqueue('900123', body);
    });

    await runOutRetries();
    const sentSoFar = sent.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayOf(MAX_AUTO_ATTEMPTS) * 3);
    });

    expect(sent).toHaveLength(sentSoFar);
  });

  it('사람이 다시 보내라고 하면 멈춤이 풀리고 다시 나간다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch([
        {
          match: (request: Request) =>
            new URL(request.url).pathname === '/production/production-results',
          respond: (request: Request) => {
            sent.push(request);

            return jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 });
          },
        },
      ]),
    });

    act(() => {
      result.current.enqueue('900123', body);
    });

    await runOutRetries();
    const sentSoFar = sent.length;

    await act(async () => {
      result.current.retryNow();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isStalled).toBe(false);
    expect(sent.length).toBeGreaterThan(sentSoFar);
    /* 다시 보내도 **같은 멱등 키**다 — 새 실적이 되면 안 된다. */
    expect(sent.at(-1)?.headers.get('Idempotency-Key')).toBe(
      sent[0]?.headers.get('Idempotency-Key'),
    );
  });
});

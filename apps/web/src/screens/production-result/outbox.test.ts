import { NETWORK_ERROR } from '@omf-mes/api-client';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import {
  MAX_AUTO_ATTEMPTS,
  isRejected,
  isSendableEntry,
  retryDelayOf,
  useOutbox,
  type OutboxEntry,
} from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 쓰기**다 — 실적은 정정 실적을 새로 만들어야 지워진다.
 * 여기서는 화면을 세우지 않고 **갈래 판정** 둘을 직접 겨눈다.
 */

describe('isRejected — 기다리면 풀리는가, 아닌가', () => {
  /*
   * ⭐ **이 판정이 큐의 심장이다.** 통신 실패를 거부로 오판하면 **실적이 조용히 사라지고**,
   * 거부를 통신 실패로 오판하면 큐가 영원히 비지 않아 그 뒤에 쌓인 정상 건까지 막힌다.
   */
  it('통신이 끊긴 것은 거부가 아니다 — 기다리면 풀린다', () => {
    expect(isRejected(new ApiRequestError(NETWORK_ERROR))).toBe(false);
  });

  it('서버가 값을 되돌린 것은 거부다 — 기다려도 풀리지 않는다', () => {
    const rejection = new ApiRequestError({
      kind: 'validation',
      errors: [{ scope: 'field', field: 'goodQty', code: 'RANGE', message: '범위를 벗어났다' }],
    });

    expect(isRejected(rejection)).toBe(true);
  });

  it('단말 게이팅 거부(403)도 거부다 — 다시 보내도 같은 답이 온다', () => {
    expect(isRejected(new ApiRequestError({ kind: 'http', status: 403 }))).toBe(true);
  });

  it('요청 경로 밖의 예외는 거부로 다룬다 — 재시도로 큐를 막지 않는다', () => {
    expect(isRejected(new Error('알 수 없음'))).toBe(true);
  });

  /*
   * ⛔ **서버가 「지금은 못 받는다」고 한 것을 「이 실적은 안 된다」로 읽지 않는다.** 거부로
   * 읽으면 항목이 큐에서 내려가는데, 그 시점의 화면은 이미 성공을 말하고 초안을 비운 뒤라
   * 작업자가 친 값을 되돌릴 방법이 없다.
   */
  it('서버 재기동·과부하는 거부가 아니다 — 기다리면 풀린다', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(isRejected(new ApiRequestError({ kind: 'http', status }))).toBe(false);
    }
  });

  it('값이 틀렸다는 4xx 는 그대로 거부다 — 기다려도 같은 답이 온다', () => {
    for (const status of [400, 401, 404, 409, 422]) {
      expect(isRejected(new ApiRequestError({ kind: 'http', status }))).toBe(true);
    }
  });

  /* 무엇이 잘못됐는지 말해 주지 못하는 실패를 무한히 재전송하면 큐가 그 한 건에 막힌다. */
  it('상태 코드를 모르는 실패는 거부로 다룬다', () => {
    expect(isRejected(new ApiRequestError({ kind: 'http', status: 0 }))).toBe(true);
  });
});

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

describe('retryDelayOf — 기다림은 늘리되 상한을 둔다', () => {
  /*
   * ⚠ **간격이 고정이면 장애가 길어질수록 손해가 커진다.** 밤새 켜 둔 단말이 5초마다 던지면
   * 장애 중인 서버가 그 폭주를 함께 받는다.
   */
  it('시도마다 두 배로 늘린다', () => {
    expect(retryDelayOf(1)).toBe(5_000);
    expect(retryDelayOf(2)).toBe(10_000);
    expect(retryDelayOf(3)).toBe(20_000);
  });

  it('아무리 늘어도 1분을 넘지 않는다', () => {
    expect(retryDelayOf(10)).toBe(60_000);
    expect(retryDelayOf(100)).toBe(60_000);
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

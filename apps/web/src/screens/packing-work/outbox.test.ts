import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_AUTO_ATTEMPTS, retryDelayOf } from '../../patterns/outbox-policy';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { HANDLING_UNIT_ID, ITEM_ID, LOT_A_ID, UOM_ID, WORKER_NO } from './fixtures';
import { STORAGE_KEY, isSendableEntry, usePackingWorkOutbox, type OutboxEntry } from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 확정**이다(스펙 §8-4 — 포장 해체 화면이 없다).
 * 잃으면 작업자가 담은 것을 다시 만들 수 없다.
 *
 * ⚠ 실패 판정·백오프는 화면 밖 공용물이라 `patterns/outbox-policy.test.ts` 가 본다. 여기서는
 * **이 화면의 큐**만 겨눈다.
 */

const PACK_PATH = `/inventory/handling-units/${String(HANDLING_UNIT_ID)}:pack`;

const body = {
  contents: [{ lotId: LOT_A_ID, itemId: ITEM_ID, uomId: UOM_ID, qty: 100 }],
  businessDate: '2026-09-04',
  occurredAt: '2026-09-04T10:30:00+09:00',
} satisfies OutboxEntry['body'];

describe('isSendableEntry — 저장소에서 읽은 값을 믿지 않는다', () => {
  const entry = {
    idempotencyKey: 'key-1',
    handlingUnitId: HANDLING_UNIT_ID,
    workerNo: WORKER_NO,
    body,
  };

  it('갖출 것을 갖춘 항목은 보낼 수 있다', () => {
    expect(isSendableEntry(entry)).toBe(true);
  });

  it('멱등 키가 비면 보내지 않는다 — 재전송이 새 확정이 된다', () => {
    expect(isSendableEntry({ ...entry, idempotencyKey: '' })).toBe(false);
  });

  /*
   * ⭐ **포장 번호는 경로에 실린다.** 없으면 보낼 주소가 없고, 재전송 시점에 「지금 담고 있는
   * 포장」으로 대신하면 엉뚱한 포장이 확정된다.
   */
  it('포장 단위가 없으면 보내지 않는다', () => {
    expect(isSendableEntry({ idempotencyKey: 'key-1', workerNo: WORKER_NO, body })).toBe(false);
  });

  it('사번이 없으면 보내지 않는다 — 없으면 서버가 거부한다', () => {
    expect(isSendableEntry({ ...entry, workerNo: '' })).toBe(false);
  });

  /* ⛔ 내용물이 비면 서버가 400 이다(계약) — 큐 맨 앞에서 매번 거부돼 뒤엣것까지 막는다. */
  it('내용물이 빈 확정은 보내지 않는다', () => {
    expect(isSendableEntry({ ...entry, body: { ...body, contents: [] } })).toBe(false);
  });

  it('계약이 필수로 둔 칸이 빠지면 보내지 않는다', () => {
    for (const field of ['businessDate', 'occurredAt']) {
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

describe('usePackingWorkOutbox', () => {
  const alwaysUnavailable = [
    {
      match: (request: Request) => new URL(request.url).pathname === PACK_PATH,
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

  const enqueueOne = (result: { current: ReturnType<typeof usePackingWorkOutbox> }): void => {
    act(() => {
      result.current.enqueue({ handlingUnitId: HANDLING_UNIT_ID, workerNo: WORKER_NO, body });
    });
  };

  it('담은 확정은 포장 경로로 멱등 키·사번과 함께 나간다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => usePackingWorkOutbox(), {
      fetch: createStubFetch([
        {
          match: (request: Request) => new URL(request.url).pathname === PACK_PATH,
          respond: (request: Request) => {
            sent.push(request);

            return jsonResponse({}, { status: 200 });
          },
        },
      ]),
    });

    enqueueOne(result);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(sent[0]!.headers.get('Idempotency-Key')).not.toBeNull();
    /* ⛔ 큐에 쌓인 요청은 낙관적 잠금 토큰을 싣지 않는다(C-9). */
    expect(sent[0]!.headers.get('If-Match')).toBeNull();
    expect(result.current.pendingCount).toBe(0);
    /* 확정이 닿으면 그 포장이 상위 포장 후보가 된다 — 화면이 다시 읽을 계기다. */
    expect(result.current.sentCount).toBe(1);
  });

  /* ⛔ **재전송이 새 확정이 되면 안 된다** — 같은 포장이 두 번 만들어진다(C-1 #5). */
  it('다시 보낼 때도 멱등 키가 같다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => usePackingWorkOutbox(), {
      fetch: createStubFetch([
        {
          match: (request: Request) => new URL(request.url).pathname === PACK_PATH,
          respond: (request: Request) => {
            sent.push(request);

            return jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 });
          },
        },
      ]),
    });

    enqueueOne(result);
    await runOutRetries();

    const keys = new Set(sent.map((request) => request.headers.get('Idempotency-Key')));

    expect(sent.length).toBeGreaterThan(1);
    expect(keys.size).toBe(1);
  });

  /*
   * ⛔ **5xx 를 거부로 읽으면 안 된다.** 서버 재기동 중에 확정이 큐에서 내려가면, 화면은 이미
   * 「확정했습니다」를 띄운 뒤라 작업자가 담은 것을 되돌릴 방법이 없다(#772).
   */
  it('자동 재전송을 멈춰도 확정은 큐에 남는다', async () => {
    const { result } = renderHookWithProviders(() => usePackingWorkOutbox(), {
      fetch: createStubFetch(alwaysUnavailable),
    });

    enqueueOne(result);
    await runOutRetries();

    expect(result.current.isStalled).toBe(true);
    expect(result.current.pendingCount).toBe(1);
    /* 「멈췄다」와 「거부됐다」는 다른 말이다 — 거부 배너를 세우지 않는다. */
    expect(result.current.rejection).toBeNull();

    /*
     * ⭐ **멈춘 뒤에도 계속 남아 있어야 한다.** 상한에 닿은 그 회차에서 항목을 내려 버리면
     * 이 순간에야 큐가 빈다 — 앞의 단언만으로는 그 회차를 지나치는지 알 수 없다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayOf(MAX_AUTO_ATTEMPTS) * 2);
    });

    expect(result.current.pendingCount).toBe(1);
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain(String(HANDLING_UNIT_ID));
  });

  it('사람이 다시 보내라고 하면 멈춤이 풀린다', async () => {
    const { result } = renderHookWithProviders(() => usePackingWorkOutbox(), {
      fetch: createStubFetch(alwaysUnavailable),
    });

    enqueueOne(result);
    await runOutRetries();

    await act(async () => {
      result.current.retryNow();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isStalled).toBe(false);
    expect(result.current.pendingCount).toBe(1);
  });

  /*
   * ⭐ **서버가 받지 않기로 한 것만 큐에서 내린다.** 포장은 서로 다른 취급 단위라 앞 건의
   * 거부가 뒤 건의 뜻을 바꾸지 않는다 — 다만 거부 사실은 사람이 봐야 한다.
   */
  it('거부된 확정은 큐에서 내려가고 그 사실이 남는다', async () => {
    const { result } = renderHookWithProviders(() => usePackingWorkOutbox(), {
      fetch: createStubFetch([
        {
          match: (request: Request) => new URL(request.url).pathname === PACK_PATH,
          respond: () => jsonResponse({ message: '이미 확정된 포장입니다' }, { status: 409 }),
        },
      ]),
    });

    enqueueOne(result);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.rejection).not.toBeNull();
    expect(result.current.sentCount).toBe(0);
  });
});

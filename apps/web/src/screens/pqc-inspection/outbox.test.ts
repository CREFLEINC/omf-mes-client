import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_AUTO_ATTEMPTS, retryDelayOf } from '../../patterns/outbox-policy';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { STORAGE_KEY, isSendableEntry, useOutbox } from './outbox';

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
    statusCode: 'DRAFT',
  };

  it('계약이 필수로 둔 것이 갖춰지면 보낼 수 있다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1', workerNo: '900028', body })).toBe(true);
  });

  /* ⛔ 키가 없으면 재전송이 **새 검사 결과**가 된다 — 보내지 않는 편이 낫다. */
  it('멱등 키가 없으면 보내지 않는다', () => {
    expect(isSendableEntry({ workerNo: '900028', body })).toBe(false);
    expect(isSendableEntry({ idempotencyKey: '', workerNo: '900028', body })).toBe(false);
  });

  it('본문이 없거나 객체가 아니면 보내지 않는다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1' })).toBe(false);
    expect(isSendableEntry({ idempotencyKey: 'k-1', body: 'x' })).toBe(false);
  });

  /* 수량이 문자열로 굳어 있는 판이 저장소에 남아 있을 수 있다 — 그대로 보내면 서버가
   * 무엇을 기록할지 화면이 알 수 없다. */
  it('수량이 수치가 아니면 보내지 않는다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1', workerNo: '900028', body: { ...body, acceptedQty: '28' } })).toBe(
      false,
    );
  });

  it('검사 시각이 없으면 보내지 않는다 — 언제 잰 것인지 모르는 판정은 기록이 아니다', () => {
    const { inspectedAt: _dropped, ...withoutTime } = body;

    expect(isSendableEntry({ idempotencyKey: 'k-1', workerNo: '900028', body: withoutTime })).toBe(false);
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
      result.current.enqueue('900028', {
        inspectionRequestId: 1001,
        inspectedQty: 30,
        acceptedQty: 28,
        rejectedQty: 2,
        heldQty: 0,
        uomId: 10,
        inspectedAt: '2026-09-02T10:00:00+09:00',
        statusCode: 'DRAFT',
      });
    });

    await runOutRetries();

    expect(result.current.isStalled).toBe(true);
    expect(result.current.pendingCount).toBe(1);
    /* 거부가 아니므로 배너용 오류를 세우지 않는다 — 「멈췄다」와 「거부됐다」는 다른 말이다. */
    expect(result.current.rejection).toBeNull();
  });

  it('멈춘 뒤에는 더 던지지 않고, 사람이 누르면 같은 멱등 키로 다시 나간다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(unavailable(sent)),
    });

    act(() => {
      result.current.enqueue('900028', {
        inspectionRequestId: 1001,
        inspectedQty: 30,
        acceptedQty: 28,
        rejectedQty: 2,
        heldQty: 0,
        uomId: 10,
        inspectedAt: '2026-09-02T10:00:00+09:00',
        statusCode: 'DRAFT',
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

/*
 * ⛔ **잠금의 수명이 잠글 대상의 수명보다 짧으면 안 된다**(#1091 리뷰). 확정은 저장소에 남아
 * 새로고침과 화면 이동을 넘기는데, 「방금 확정했다」는 화면 상태 하나로 잠그면 화면을 다시
 * 세우는 순간 잠금만 사라진다 — 그 틈에 같은 검사가 두 건이 된다.
 */
describe('useOutbox — 큐가 「이 의뢰의 확정이 아직 남았는가」를 답한다', () => {
  const bodyOf = (inspectionRequestId: number, statusCode: string) => ({
    inspectionRequestId,
    inspectedQty: 30,
    acceptedQty: 28,
    rejectedQty: 2,
    heldQty: 0,
    uomId: 10,
    inspectedAt: '2026-09-02T10:00:00+09:00',
    statusCode,
  });

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  /** 아무 답도 하지 않아 큐가 비워지지 않는 서버 — 「아직 남아 있다」를 재는 자리다. */
  const silent = [
    {
      match: (request: Request) => new URL(request.url).pathname === '/quality/inspection-results',
      respond: () => new Promise<Response>(() => undefined),
    },
  ];

  it('저장소에 남은 확정을 새로 뜬 훅이 그대로 읽는다', () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ idempotencyKey: 'k-1', workerNo: '900028', body: bodyOf(1001, 'CONFIRMED') }]),
    );

    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(silent),
    });

    expect(result.current.hasPendingConfirm(1001)).toBe(true);
  });

  /* ⛔ **다른 의뢰의 확정으로 이 화면을 잠그지 않는다** — 큐는 의뢰를 가리지 않고 담는다. */
  it('다른 의뢰의 확정은 이 의뢰를 잠그지 않는다', () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ idempotencyKey: 'k-1', workerNo: '900028', body: bodyOf(1002, 'CONFIRMED') }]),
    );

    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(silent),
    });

    expect(result.current.hasPendingConfirm(1001)).toBe(false);
  });

  /* 임시 저장은 회차를 확정하지 않는다 — 그것으로 화면을 잠그면 검사자가 이어 쓰지 못한다. */
  it('임시 저장만 남아 있으면 잠그지 않는다', () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ idempotencyKey: 'k-1', workerNo: '900028', body: bodyOf(1001, 'DRAFT') }]),
    );

    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(silent),
    });

    expect(result.current.hasPendingConfirm(1001)).toBe(false);
  });
});

/*
 * ⛔ **「거부가 섰다」만으로는 무엇이 거부됐는지 알 수 없다**(#1091 리뷰). 큐는 밀릴 수 있어
 * 임시 저장과 확정이 함께 서 있을 수 있고, 앞의 임시 저장이 거부됐다고 확정에 걸린 잠금을
 * 풀면 아직 큐에 살아 있는 확정 위에 두 번째 확정이 얹힌다.
 */
describe('useOutbox — 거부된 것이 무엇이었는지 함께 낸다', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  const refuses = [
    {
      match: (request: Request) => new URL(request.url).pathname === '/quality/inspection-results',
      respond: () =>
        jsonResponse({ errors: [{ scope: 'screen', code: 'FORBIDDEN' }] }, { status: 403 }),
    },
  ];

  it('거부된 항목의 상태값을 함께 낸다', async () => {
    const { result } = renderHookWithProviders(() => useOutbox(), {
      fetch: createStubFetch(refuses),
    });

    await act(async () => {
      result.current.enqueue('900028', {
        inspectionRequestId: 1001,
        inspectedQty: 30,
        acceptedQty: 28,
        rejectedQty: 2,
        heldQty: 0,
        uomId: 10,
        inspectedAt: '2026-09-02T10:00:00+09:00',
        statusCode: 'DRAFT',
      });
    });

    await vi.waitFor(() => {
      expect(result.current.rejection).not.toBeNull();
    });
    expect(result.current.rejectedStatusCode).toBe('DRAFT');

    /* 거부 표시를 지우면 «무엇이었는지»도 함께 내려간다 — 둘이 어긋나면 판정이 흔들린다. */
    act(() => {
      result.current.clearRejection();
    });
    expect(result.current.rejectedStatusCode).toBeNull();
  });
});

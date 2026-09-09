import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_AUTO_ATTEMPTS, retryDelayOf } from '../../patterns/outbox-policy';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { WORK_ORDER_ID, WORK_SESSION_ID, WORKER_NO } from './fixtures';
import {
  STORAGE_KEY,
  normalizeEntry,
  useWorkHoldOutbox,
  type OutboxDraft,
  type OutboxEntry,
} from './outbox';

/**
 * 이 큐가 지키는 것은 **정정 경로가 없는 기록**이다(스펙 §6) — 잃으면 다시 만들 수 없다.
 *
 * ⚠ 실패 판정·백오프는 화면 밖 공용물이라 `patterns/outbox-policy.test.ts` 가 본다. 여기서는
 * **이 화면의 큐**만 겨눈다.
 */

const EVENTS_PATH = `/production/work-sessions/${String(WORK_SESSION_ID)}/events`;
const HOLD_PATH = `/production/work-orders/${String(WORK_ORDER_ID)}:hold`;
const RESUME_PATH = `/production/work-orders/${String(WORK_ORDER_ID)}:resume`;
const END_PATH = `/production/work-sessions/${String(WORK_SESSION_ID)}:end`;

const OCCURRED_AT = '2026-09-03T10:30:00+09:00';

const eventBody = {
  eventTypeCode: 'STOP',
  occurredAt: OCCURRED_AT,
  reasonCode: 'MOLD_CHANGE',
} satisfies OutboxEntry['body'];

const target = {
  workOrderId: WORK_ORDER_ID,
  workSessionId: WORK_SESSION_ID,
  workerNo: WORKER_NO,
} as const;

/** 중단 한 조작이 담는 두 건 — W/O 층이 먼저다. */
const stopPair: OutboxDraft[] = [
  {
    kind: 'work-order-hold',
    direction: 'STOP',
    ...target,
    body: { reasonCode: 'MOLD_CHANGE', occurredAt: OCCURRED_AT, note: '금형 교체' },
  },
  { kind: 'session-event', direction: 'STOP', ...target, body: eventBody },
];

describe('normalizeEntry — 저장소에서 읽은 값을 믿지 않는다', () => {
  const entry = {
    idempotencyKey: 'key-1',
    kind: 'session-event',
    groupId: 'group-1',
    direction: 'STOP',
    workSessionId: WORK_SESSION_ID,
    workOrderId: WORK_ORDER_ID,
    workerNo: WORKER_NO,
    body: eventBody,
  };

  it('갖출 것을 갖춘 항목은 보낼 수 있다', () => {
    expect(normalizeEntry(entry)).not.toBeNull();
  });

  it('멱등 키가 비면 보내지 않는다 — 재전송이 새 사건이 된다', () => {
    expect(normalizeEntry({ ...entry, idempotencyKey: '' })).toBeNull();
  });

  /*
   * ⭐ **세션 번호는 경로에 실린다.** 없으면 보낼 주소가 없고, 재전송 시점에 「지금 열린 세션」
   * 으로 대신하면 중단이 엉뚱한 세션에 붙는다.
   */
  it('세션 번호가 없으면 보내지 않는다', () => {
    const { workSessionId: _omitted, ...rest } = entry;

    expect(normalizeEntry(rest)).toBeNull();
  });

  /* W/O 층 호출은 작업지시 번호가 경로다 — 없으면 주소가 없다. */
  it('W/O 층 호출인데 작업지시 번호가 없으면 보내지 않는다', () => {
    const { workOrderId: _omitted, ...rest } = entry;

    expect(normalizeEntry({ ...rest, kind: 'work-order-hold' })).toBeNull();
  });

  it('사번이 없으면 보내지 않는다 — 없으면 서버가 거부한다', () => {
    expect(normalizeEntry({ ...entry, workerNo: '' })).toBeNull();
  });

  it('계약이 필수로 둔 칸이 빠지면 보내지 않는다', () => {
    for (const field of ['eventTypeCode', 'occurredAt']) {
      const broken: Record<string, unknown> = { ...eventBody };
      delete broken[field];

      expect(normalizeEntry({ ...entry, body: broken })).toBeNull();
    }

    expect(normalizeEntry({ ...entry, kind: 'session-end', body: {} })).toBeNull();
  });

  /*
   * ⛔ **중단 사유는 계약 필수다.** 빠진 채로 나가면 400 을 받고, 이 큐는 거부에서 전체를
   * 멈추므로 뒤에 쌓인 정상 건까지 함께 막힌다.
   */
  it('W/O 중단인데 사유가 없으면 보내지 않는다', () => {
    const hold = {
      ...entry,
      kind: 'work-order-hold',
      body: { occurredAt: OCCURRED_AT },
    };

    expect(normalizeEntry(hold)).toBeNull();
    expect(normalizeEntry({ ...hold, body: { occurredAt: OCCURRED_AT, reasonCode: '' } })).toBeNull();
    expect(
      normalizeEntry({ ...hold, body: { occurredAt: OCCURRED_AT, reasonCode: 'MOLD_CHANGE' } }),
    ).not.toBeNull();
  });

  /*
   * ⛔ **방향과 본문이 어긋나면 보내지 않는다.** 방향은 버튼 활성 판정이 읽는 값이라, 손상된
   * 값이 통과하면 중단 중인데 [중단]이 열리는 식으로 반대 방향이 한 번 더 나간다.
   */
  it('방향과 본문 유형이 어긋나면 보내지 않는다', () => {
    expect(normalizeEntry({ ...entry, direction: 'RESUME' })).toBeNull();
    expect(
      normalizeEntry({
        ...entry,
        kind: 'session-end',
        direction: 'STOP',
        body: { endedAt: OCCURRED_AT },
      }),
    ).toBeNull();
    expect(
      normalizeEntry({
        ...entry,
        kind: 'work-order-resume',
        direction: 'STOP',
        body: { occurredAt: OCCURRED_AT },
      }),
    ).toBeNull();
  });

  it('객체가 아닌 값은 보내지 않는다', () => {
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry('key-1')).toBeNull();
    expect(normalizeEntry({ ...entry, body: null })).toBeNull();
  });

  /*
   * ⛔ **지난 판이 담은 것을 버리지 않는다.** 호출이 하나였던 판의 항목에는 `kind`·`groupId`·
   * `direction`·`workOrderId` 가 없다 — 버리면 작업자가 남긴 중단 기록이 조용히 사라진다.
   */
  describe('지난 판(세션 사건 단건) 항목', () => {
    const legacy = {
      idempotencyKey: 'legacy-1',
      workSessionId: WORK_SESSION_ID,
      workerNo: WORKER_NO,
      body: eventBody,
    };

    it('세션 사건 한 건으로 읽어 그대로 보낸다', () => {
      expect(normalizeEntry(legacy)).toMatchObject({
        kind: 'session-event',
        direction: 'STOP',
        /* 짝이 없으므로 자기 자신이 묶음이다 — 함께 내릴 것이 없다. */
        groupId: 'legacy-1',
      });
    });

    /*
     * ⛔ **지난 판이라는 이유로 검사를 건너뛰지 않는다.** 이 갈래에는 `kind` 가 없어 위쪽
     * 검사가 걸리지 않는다 — 여기서 막지 못하면 깨진 값이 `/events` 로 나가 400 을 받고,
     * 그 거부가 큐를 멈춰 **뒤에 쌓인 정상 건까지 함께 막는다.**
     */
    it('계약이 필수로 둔 칸이 빠진 지난 판 항목은 보내지 않는다', () => {
      expect(normalizeEntry({ ...legacy, body: {} })).toBeNull();
      expect(
        normalizeEntry({ ...legacy, body: { eventTypeCode: 'STOP' } }),
      ).toBeNull();
      expect(normalizeEntry({ ...legacy, body: { occurredAt: OCCURRED_AT } })).toBeNull();
    });

    /*
     * ⛔ **모르는 유형을 중단으로 접지 않는다.** 지난 판이 담던 것은 둘뿐이라 그 밖의 값은
     * 손상된 저장값이다 — 방향을 지어내면 돌고 있는 세션에 중단이 기록된다.
     */
    it('지난 판이 담은 적 없는 유형은 보내지 않는다', () => {
      for (const eventTypeCode of ['END', 'START', 'CONTROL_OVERRIDE', 'stop']) {
        expect(
          normalizeEntry({ ...legacy, body: { eventTypeCode, occurredAt: OCCURRED_AT } }),
        ).toBeNull();
      }
    });

    it('재개였던 항목은 재개 방향으로 읽는다', () => {
      expect(
        normalizeEntry({
          ...legacy,
          body: { eventTypeCode: 'RESUME', occurredAt: OCCURRED_AT },
        }),
      ).toMatchObject({ direction: 'RESUME' });
    });
  });
});

describe('useWorkHoldOutbox', () => {
  const alwaysUnavailable = [
    {
      match: () => true,
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

  const enqueueStop = (result: { current: ReturnType<typeof useWorkHoldOutbox> }): void => {
    act(() => {
      result.current.enqueueGroup(stopPair);
    });
  };

  /** 요청을 받아 적고 원하는 응답을 내는 스텁 한 벌. */
  const recording = (sent: Request[], status = 201) => [
    {
      match: () => true,
      respond: (request: Request) => {
        sent.push(request);

        return jsonResponse({}, { status });
      },
    },
  ];

  /*
   * ⭐ **여기가 이번 개정의 핵심이다** — 한 조작이 두 층을 부르고, **W/O 층이 먼저** 나간다.
   * 순서가 뒤집히면 중단된 적 없는 W/O 에 중단 사건이 먼저 붙는다.
   */
  it('중단 한 번이 W/O 층·세션 사건 순서로 나간다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent)),
    });

    enqueueStop(result);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(sent.map((request) => new URL(request.url).pathname)).toEqual([HOLD_PATH, EVENTS_PATH]);
    for (const request of sent) {
      expect(request.headers.get('X-Worker-No')).toBe(WORKER_NO);
      expect(request.headers.get('Idempotency-Key')).not.toBeNull();
      /* ⛔ 큐에 쌓인 요청은 낙관적 잠금 토큰을 싣지 않는다(C-9). */
      expect(request.headers.get('If-Match')).toBeNull();
    }
    expect(result.current.pendingCount).toBe(0);
    /* 서버가 받았다는 사실을 화면이 알아야 세션을 다시 읽는다. */
    expect(result.current.sentCount).toBe(2);
  });

  /* ⛔ **한 쌍의 두 건이 같은 키를 쓰면 안 된다** — 서로 다른 자원의 서로 다른 쓰기다. */
  it('한 쌍의 두 건은 멱등 키가 서로 다르다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent)),
    });

    enqueueStop(result);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const keys = sent.map((request) => request.headers.get('Idempotency-Key'));

    expect(new Set(keys).size).toBe(2);
  });

  it('비고는 W/O 중단 본문에 실린다 — 세션 사건에는 실리지 않는다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent)),
    });

    enqueueStop(result);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    /* 본문은 한 번만 읽을 수 있다 — 응답을 만들 때 읽지 않고 여기서 읽는다. */
    const holdBody: unknown = await sent[0]!.json();
    const eventBodySent: unknown = await sent[1]!.json();

    expect(holdBody).toMatchObject({ note: '금형 교체', reasonCode: 'MOLD_CHANGE' });
    expect(eventBodySent).not.toHaveProperty('note');
  });

  it('재개와 종료도 각자의 경로로 나간다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent)),
    });

    act(() => {
      result.current.enqueueGroup([
        { kind: 'work-order-resume', direction: 'RESUME', ...target, body: { occurredAt: OCCURRED_AT } },
        {
          kind: 'session-event',
          direction: 'RESUME',
          ...target,
          body: { eventTypeCode: 'RESUME', occurredAt: OCCURRED_AT },
        },
      ]);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      result.current.enqueueGroup([
        { kind: 'session-end', direction: 'END', ...target, body: { endedAt: OCCURRED_AT } },
      ]);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(sent.map((request) => new URL(request.url).pathname)).toEqual([
      RESUME_PATH,
      EVENTS_PATH,
      END_PATH,
    ]);
  });

  /* ⛔ **`stopReasonCode` 를 싣지 않는다** — 계약이 「비우기로 정했다」로 못박았다(A-21). */
  it('세션 종료 본문에는 끝 시각만 실린다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent)),
    });

    act(() => {
      result.current.enqueueGroup([
        { kind: 'session-end', direction: 'END', ...target, body: { endedAt: OCCURRED_AT } },
      ]);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(await sent[0]!.json()).toEqual({ endedAt: OCCURRED_AT });
  });

  /* ⛔ **재전송이 새 사건이 되면 안 된다** — 같은 중단이 이력에 두 번 남는다(C-1 #5). */
  it('다시 보낼 때도 멱등 키가 같다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent, 503)),
    });

    enqueueStop(result);
    await runOutRetries();

    const keys = new Set(sent.map((request) => request.headers.get('Idempotency-Key')));

    expect(sent.length).toBeGreaterThan(1);
    expect(keys.size).toBe(1);
  });

  /*
   * ⛔ **멈출 때도 큐에서 내리지 않는다.** 내리면 작업자가 등록한 중단이 사라지고, 그것이 이
   * 큐가 막으려는 바로 그 일이다.
   */
  it('자동 재전송을 멈춰도 두 건이 큐에 남는다', async () => {
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(alwaysUnavailable),
    });

    enqueueStop(result);
    await runOutRetries();

    expect(result.current.isStalled).toBe(true);
    expect(result.current.pendingCount).toBe(2);
    /* 「멈췄다」와 「거부됐다」는 다른 말이다 — 거부 배너를 세우지 않는다. */
    expect(result.current.rejection).toBeNull();

    /*
     * ⭐ **멈춘 뒤에도 계속 남아 있어야 한다.** 상한에 닿은 그 회차에서 항목을 내려 버리면
     * 이 순간에야 큐가 빈다 — 앞의 단언만으로는 그 회차를 지나치는지 알 수 없다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayOf(MAX_AUTO_ATTEMPTS) * 2);
    });

    expect(result.current.pendingCount).toBe(2);
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain('STOP');
  });

  it('사람이 다시 보내라고 하면 멈춤이 풀린다', async () => {
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(alwaysUnavailable),
    });

    enqueueStop(result);
    await runOutRetries();

    await act(async () => {
      result.current.retryNow();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isStalled).toBe(false);
    expect(result.current.pendingCount).toBe(2);
  });

  /*
   * ⛔ **거부 뒤에 뒤엣것을 계속 보내지 않는다.** 이 큐는 순서가 곧 뜻이다 — 중단이 거부됐는데
   * 재개가 그대로 나가면 멈춘 적 없는 세션에 재개가 기록된다.
   */
  it('거부가 나면 뒤에 담긴 다른 조작을 보내지 않고 멈춘다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent, 409)),
    });

    act(() => {
      result.current.enqueueGroup(stopPair);
      result.current.enqueueGroup([
        {
          kind: 'session-event',
          direction: 'RESUME',
          ...target,
          body: { eventTypeCode: 'RESUME', occurredAt: '2026-09-03T10:40:00+09:00' },
        },
      ]);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayOf(MAX_AUTO_ATTEMPTS) * 2);
    });

    /* 거부된 첫 건만 나갔고, 뒤따르던 조작은 큐에 남아 있다. */
    expect(sent).toHaveLength(1);
    expect(result.current.isStalled).toBe(true);
    expect(result.current.pendingCount).toBe(1);
  });

  /*
   * ⛔ **앞건이 거부되면 그 조작의 남은 짝을 내린다.** 남겨 두면 사람이 [다시 보내기]를 눌렀을
   * 때 뒷건만 홀로 나가고, W/O 는 그대로인 채 세션 사건만 남아 두 층이 어긋난다 — 정정 경로가
   * 없는 기록이다.
   */
  it('W/O 층이 거부되면 같은 조작의 세션 사건도 함께 내린다', async () => {
    const sent: Request[] = [];
    const { result } = renderHookWithProviders(() => useWorkHoldOutbox(), {
      fetch: createStubFetch(recording(sent, 409)),
    });

    enqueueStop(result);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(sent).toHaveLength(1);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.rejection).not.toBeNull();

    /* 사람이 깨워도 홀로 남은 짝이 나가지 않는다 — 큐에 없기 때문이다. */
    await act(async () => {
      result.current.retryNow();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(sent).toHaveLength(1);
  });
});

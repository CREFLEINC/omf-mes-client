import type { components } from '@omf-mes/api-client';
import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { downtime, EQUIPMENT_ID, WORKER_NO } from './fixtures';
import { RETRY_DELAY_MS, useOutbox } from './outbox';

/**
 * outbox 감지기 — **큐가 지키는 성질을 각각 잰다.**
 *
 * 구현이 규칙을 옮겨 적는 것만으로는 지켜지지 않는다. 재전송이 새 기록이 되는 결함이나 거부
 * 한 건 때문에 큐를 통째로 비우는 결함은 **화면 시험에서는 보이지 않는다** — 그때 화면은
 * 이미 「성공」을 보인 뒤이기 때문이다.
 */

type DowntimeCreate = components['schemas']['DowntimeCreate'];

const STORAGE_KEY = 'omf-mes.downtime-register.outbox';
const DOWNTIMES_PATH = '/maintenance/downtimes';

const body = (overrides: Partial<DowntimeCreate> = {}): DowntimeCreate => ({
  equipmentId: EQUIPMENT_ID,
  reasonCode: 'MOLD_CHANGE',
  startedAt: '2026-08-11T14:20:00+09:00',
  ...overrides,
});

interface Attempt {
  idempotencyKey: string | null;
  workerNo: string | null;
  path: string;
}

/**
 * 등록 요청을 세면서 지정한 횟수만큼 **연결 실패**로 되돌린다.
 *
 * ⚠ 연결 실패는 응답이 아니라 예외다 — 상태 코드로 돌려주면 「서버가 거부했다」가 되어
 * 큐가 그 건을 내려 버린다. 이 감지기가 재려는 것은 **기다렸다 다시 보내는** 경로다.
 */
const flakyCreateRoute = (
  attempts: Attempt[],
  failCount: number,
): StubRoute & { fetch?: never } => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === DOWNTIMES_PATH,
  respond: (request) => {
    attempts.push({
      idempotencyKey: request.headers.get('Idempotency-Key'),
      workerNo: request.headers.get('X-Worker-No'),
      path: new URL(request.url).pathname,
    });

    if (attempts.length <= failCount) throw new TypeError('Failed to fetch');

    return jsonResponse(downtime(), { status: 201 });
  },
});

const rejectingCreateRoute = (attempts: Attempt[]): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === DOWNTIMES_PATH,
  respond: (request) => {
    attempts.push({
      idempotencyKey: request.headers.get('Idempotency-Key'),
      workerNo: request.headers.get('X-Worker-No'),
      path: new URL(request.url).pathname,
    });

    return jsonResponse(
      { errors: [{ scope: 'screen', code: 'SAMPLE_REJECT', message: '합성 거부' }] },
      { status: 422 },
    );
  },
});

const renderOutbox = (routes: StubRoute[]) =>
  renderHookWithProviders(() => useOutbox(), { fetch: createStubFetch(routes) });

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.localStorage.clear();
  vi.useRealTimers();
});

describe('useOutbox', () => {
  it('재전송해도 **같은 멱등키**로 나간다 — 키가 바뀌면 한 번의 정지가 여러 건이 된다', async () => {
    const attempts: Attempt[] = [];
    const { result } = renderOutbox([flakyCreateRoute(attempts, 1)]);

    act(() => {
      result.current.enqueueCreate(WORKER_NO, body());
    });

    /* 첫 시도는 연결 실패로 되돌아온다. 그래도 큐에 남는다 — 기다리면 풀리는 실패다. */
    await waitFor(() => {
      expect(attempts).toHaveLength(1);
    });
    expect(result.current.pendingCount).toBe(1);

    /*
     * 연결이 살아난 것으로 깨운다. **스스로 깨는 타이머도 있지만 그것을 기다리지 않는다** —
     * 이 감지기가 재려는 것은 「다시 보낼 때 키가 그대로인가」이고, 재시도 간격은 별개다.
     */
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(2);
    });

    expect(attempts[0]?.idempotencyKey).toBeTruthy();
    expect(attempts[1]?.idempotencyKey).toBe(attempts[0]?.idempotencyKey);
    expect(attempts[1]?.workerNo).toBe(WORKER_NO);
  });

  it('서버가 거부하면 **그 건만** 내리고 뒤에 쌓인 건은 그대로 보낸다', async () => {
    const attempts: Attempt[] = [];
    const { result } = renderOutbox([rejectingCreateRoute(attempts)]);

    act(() => {
      result.current.enqueueCreate(WORKER_NO, body({ startedAt: '2026-08-11T09:00:00+09:00' }));
      result.current.enqueueCreate(WORKER_NO, body({ startedAt: '2026-08-11T10:00:00+09:00' }));
    });

    await waitFor(() => {
      expect(result.current.rejections).toHaveLength(2);
    });

    /* 둘 다 «각각» 시도됐다 — 앞 건이 거부됐다고 뒤 건을 버리면 현장이 마비된다. */
    expect(attempts).toHaveLength(2);
    expect(result.current.pendingCount).toBe(0);
  });

  it('아직 나가지 않은 건은 새로고침을 넘긴다 — 저장소에 남는다', () => {
    const { result, unmount } = renderOutbox([]);

    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });

    act(() => {
      result.current.enqueueCreate(WORKER_NO, body());
    });

    unmount();

    const stored: unknown = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(Array.isArray(stored) && stored.length === 1).toBe(true);
  });

  it('저장소에 담긴 **모양이 깨진 항목은 보내지 않는다**', async () => {
    /*
     * 지난 판의 화면이 썼거나 손으로 고쳐진 값이 그대로 나가면 서버가 무엇을 기록할지
     * 화면이 알 수 없다. 큐 맨 앞에서 매번 거부되면 뒤에 쌓인 정상 건까지 막힌다.
     */
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { kind: 'create', idempotencyKey: 'k1', workerNo: WORKER_NO, body: { equipmentId: 1 } },
        { kind: 'create', idempotencyKey: '', workerNo: WORKER_NO, body: body() },
        { kind: 'close', idempotencyKey: 'k3', workerNo: WORKER_NO },
      ]),
    );

    const attempts: Attempt[] = [];
    const { result } = renderOutbox([flakyCreateRoute(attempts, 0)]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.pendingCount).toBe(0);
    expect(attempts).toHaveLength(0);
  });

  it('담은 **순서대로** 보낸다 — 종료가 등록을 앞지르면 없는 구간을 닫으려 든다', async () => {
    const attempts: Attempt[] = [];
    const { result } = renderOutbox([
      flakyCreateRoute(attempts, 0),
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname.endsWith(':close'),
        respond: (request) => {
          attempts.push({
            idempotencyKey: request.headers.get('Idempotency-Key'),
            workerNo: request.headers.get('X-Worker-No'),
            path: new URL(request.url).pathname,
          });

          return jsonResponse(downtime());
        },
      },
    ]);

    act(() => {
      result.current.enqueueCreate(WORKER_NO, body());
      result.current.enqueueClose(WORKER_NO, 5201);
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(2);
    });

    /* 오프라인에서 「등록 → 지금 종료」를 연달아 하는 경로가 실제로 있는 화면이다. */
    expect(attempts[0]?.path).toBe(DOWNTIMES_PATH);
    expect(attempts[1]?.path).toContain(':close');
  });

  it('연결 이벤트가 오지 않아도 **스스로 깨어** 다시 보낸다', async () => {
    /*
     * 「끊긴 적 없이 실패한」 요청이 있다. 연결 이벤트만 믿으면 그 건이 큐를 영원히 막고,
     * 작업자는 이미 성공을 보았으므로 멈춘 줄 모른다.
     */
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const attempts: Attempt[] = [];
    const { result } = renderOutbox([flakyCreateRoute(attempts, 1)]);

    act(() => {
      result.current.enqueueCreate(WORKER_NO, body());
    });

    await waitFor(() => {
      expect(attempts).toHaveLength(1);
    });

    /* 연결 이벤트를 쏘지 «않는다» — 오직 자체 타이머만으로 다시 서야 한다. */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100);
    });

    expect(attempts).toHaveLength(2);
    expect(attempts[1]?.idempotencyKey).toBe(attempts[0]?.idempotencyKey);
  });

  it('아직 나가지 않은 등록 건을 멱등키와 함께 낸다 — 오프라인 목록의 이름이 된다', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });

    const { result } = renderOutbox([]);

    act(() => {
      result.current.enqueueCreate(WORKER_NO, body());
    });

    expect(result.current.pendingCreates).toHaveLength(1);
    expect(result.current.pendingCreates[0]?.idempotencyKey).toBeTruthy();
    expect(result.current.pendingCount).toBe(1);
  });
});

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { toResumeBody, useResumeWork } from './mutations';

const WORK_SESSION_ID = 9801;
const WORKER_NO = '3391';
const OCCURRED_AT = '2026-09-02T11:20:00+09:00';

/**
 * 재개는 **화면으로는 아직 닿지 않는다** — [재개] 를 세우는 근거인 작업지시 상태 문자열이
 * 확정되지 않았기 때문이다(`work-order-status.ts`). 그래서 경로·헤더·본문을 **훅 자리에서**
 * 잰다. 값이 확정돼 화면이 열릴 때, 이 감지기가 이미 서 있어야 그 순간의 회귀를 잡는다.
 */
describe('재개 — 세션 사건 적재', () => {
  /** ⛔ 새 세션을 열지 않는다. `work-orders/{id}:resume` 도 부르지 않는다(§5-4 · 통지 #556). */
  it('열려 있는 세션의 사건 경로로 간다', async () => {
    const seen: { url: string; method: string; body: unknown; workerNo: string | null }[] = [];

    const { result } = renderHookWithProviders(
      () =>
        useResumeWork({ workSessionId: WORK_SESSION_ID, workerNo: WORKER_NO, onSuccess: vi.fn() }),
      {
        fetch: async (request) => {
          seen.push({
            url: new URL(request.url).pathname,
            method: request.method,
            body: await request.clone().json(),
            workerNo: request.headers.get('X-Worker-No'),
          });

          return jsonResponse({ workSessionEventId: 1 }, { status: 201 });
        },
      },
    );

    act(() => {
      result.current.write(toResumeBody(OCCURRED_AT));
    });

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const sent = seen[0];
    if (sent === undefined) throw new Error('요청이 기록되지 않았습니다.');

    expect(sent.method).toBe('POST');
    expect(sent.url).toBe(`/production/work-sessions/${String(WORK_SESSION_ID)}/events`);
    expect(sent.url).not.toContain(':resume');
    expect(sent.workerNo).toBe(WORKER_NO);
  });

  /**
   * ⛔ **모르는 세션을 0 으로 채우지 않는다.** 채우면 `/production/work-sessions/0/events` 로
   * 나가고, 서버가 그 경로를 어떻게 읽든 이쪽이 지어낸 값이다 — 요청 본문에서 세운 원칙과
   * 같은 자리다(`session-request.ts`).
   */
  it('재개할 세션을 모르면 아무 요청도 내보내지 않는다', async () => {
    const seen: string[] = [];

    const { result } = renderHookWithProviders(
      () => useResumeWork({ workSessionId: null, workerNo: WORKER_NO, onSuccess: vi.fn() }),
      {
        fetch: async (request) => {
          seen.push(new URL(request.url).pathname);

          return jsonResponse({ workSessionEventId: 1 }, { status: 201 });
        },
      },
    );

    act(() => {
      result.current.write(toResumeBody(OCCURRED_AT));
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(seen).toHaveLength(0);
  });

  /** ⭐ 사유는 비운다 — 중단 사유는 중단할 때 남았고, 재개에 다시 실을 값이 아니다. */
  it('RESUME 을 사유 없이 싣는다', () => {
    const body = toResumeBody(OCCURRED_AT);

    expect(body.eventTypeCode).toBe('RESUME');
    expect(body.occurredAt).toBe(OCCURRED_AT);
    expect(body).not.toHaveProperty('reasonCode');
  });
});

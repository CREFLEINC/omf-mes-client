import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LABEL_RENDITION_NOT_READY_REASON } from '../../patterns/pop-label-rendition';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { WORKER_NO } from './fixtures';
import { usePrintRunner } from './use-print';

/**
 * 인쇄 «배선»을 지나가게 한다.
 *
 * ⛔ **화면 시험으로는 이 자리가 검사되지 않는다.** jsdom 에는 셸 통로(`window.pop`)가 없어
 * 화면은 언제나 「여기서는 인쇄할 수 없다」로 빠진다 — 경로·본문·헤더를 뒤바꿔도 조용하다.
 * 그래서 통로를 세워 두고 훅만 따로 돌린다.
 */

const stubShell = (save: (bytes: Uint8Array, label: string) => Promise<string>): void => {
  Object.defineProperty(window, 'pop', {
    value: { rendition: { save } },
    configurable: true,
  });
};

afterEach(() => {
  Reflect.deleteProperty(window, 'pop');
});

const pathOf = (request: Request): string => new URL(request.url).pathname;

const renderRunner = (requests: Request[], failReport = false) =>
  renderHookWithProviders(() => usePrintRunner(WORKER_NO), {
    fetch: createStubFetch([
      {
        match: (request) => request.method === 'GET' && pathOf(request).endsWith('/rendition'),
        respond: (request) => {
          requests.push(request.clone());

          return new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          });
        },
      },
      {
        match: (request) => request.method === 'POST' && pathOf(request).includes(':report-print'),
        respond: (request) => {
          requests.push(request.clone());

          return failReport
            ? jsonResponse({ message: '이미 보고됨' }, { status: 422 })
            : jsonResponse({ documentIssueLogId: 44001 });
        },
      },
    ]),
  });

const TARGETS = [{ documentIssueLogId: 44001, label: 'LOT-SAMPLE-0031' }];

describe('usePrintRunner — 인쇄 배선', () => {
  /*
   * ⛔⛔ **서버에 이 경로가 없다**(`patterns/pop-label-rendition` 머리말 · 대응표 P1 「미구현
   * 5건」: `GET /app/document-issues/{id}/rendition`). 원래 이 시험은 그림을 실제로 받아 셸에
   * 넘기는 정상 경로를 쟀다 — 이제 그 요청 자체가 나가지 않는다. 셸을 세워 두어도(«셸 탓»이
   * 아님을 보이려고) 그림을 받으러 가지 않고 곧바로 실패로 보고하는 지금의 동작을 잰다.
   */
  it('그림을 받으러 네트워크 요청을 보내지 않고 곧바로 실패로 보고한다', async () => {
    const requests: Request[] = [];
    const save = vi.fn<(bytes: Uint8Array, label: string) => Promise<string>>(
      async () => '/tmp/label.png',
    );
    stubShell(save);

    const { result } = renderRunner(requests);

    await act(async () => {
      await result.current.run(TARGETS);
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('failed');
    });

    /* 서버에 없는 경로다 — GET 요청 자체가 한 번도 나가지 않는다. */
    expect(requests.some((request) => request.method === 'GET')).toBe(false);
    expect(save).not.toHaveBeenCalled();

    const report = requests.find((request) => request.method === 'POST');
    expect(new URL(report?.url ?? '').pathname).toBe('/app/document-issues/44001:report-print');
    expect(report?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(report?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(await report?.json()).toEqual({
      outcome: 'FAILED',
      failureReason: LABEL_RENDITION_NOT_READY_REASON,
    });
    expect(result.current.state.reason).toBe(LABEL_RENDITION_NOT_READY_REASON);
    expect(result.current.state.printed).toBe(0);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 «셸이 거부한» 실패를 쟀다 —
   * 그림을 받는 걸음이 셸을 부르기 «전»에 이미 막혀 있어 셸의 거부 자체를 더는 관찰할 수
   * 없다. 대신 셸이 아예 없을 때도 **같은 이유(그림을 받지 못함)로 네트워크를 부르지
   * 않는지**를 잰다 — 셸 유무와 무관하게 막힌 자리가 앞쪽(그림 취득)이라는 성질을 지킨다.
   */
  it('셸이 없어도 그림을 받으러 가지 않는다 — shellUnavailable 판정이 먼저 선다', async () => {
    const requests: Request[] = [];

    const { result } = renderRunner(requests);

    await act(async () => {
      await result.current.run(TARGETS);
    });

    expect(result.current.state.phase).toBe('shellUnavailable');
    expect(requests).toHaveLength(0);
  });

  it('같은 보고를 다시 보낼 때 멱등 키가 바뀌지 않는다 — 「이미 보고됨」을 새 쓰기로 만들지 않는다', async () => {
    const requests: Request[] = [];
    stubShell(async () => '/tmp/label.png');

    const { result } = renderRunner(requests, true);

    await act(async () => {
      await result.current.run(TARGETS);
    });
    await act(async () => {
      await result.current.run(TARGETS);
    });

    const reports = requests.filter((request) => request.method === 'POST');
    expect(reports).toHaveLength(2);
    expect(reports[0]?.headers.get('Idempotency-Key')).toBe(
      reports[1]?.headers.get('Idempotency-Key'),
    );
  });

  it('사번이 없으면 인쇄를 시작하지 않는다 — 결과 보고가 사번을 요구한다', async () => {
    const requests: Request[] = [];
    stubShell(async () => '/tmp/label.png');

    const { result } = renderHookWithProviders(() => usePrintRunner(null), {
      fetch: createStubFetch([]),
    });

    await act(async () => {
      await result.current.run(TARGETS);
    });

    expect(result.current.state.phase).toBe('shellUnavailable');
    expect(requests).toHaveLength(0);
  });
});

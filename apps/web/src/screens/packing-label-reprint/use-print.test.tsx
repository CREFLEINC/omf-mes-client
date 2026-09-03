import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  it('그린 것을 png 로 받아 셸에 넘기고 성공을 보고한다', async () => {
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
      expect(result.current.state.phase).toBe('succeeded');
    });

    const rendition = requests.find((request) => request.method === 'GET');
    expect(new URL(rendition?.url ?? '').pathname).toBe('/app/document-issues/44001/rendition');
    expect(new URL(rendition?.url ?? '').searchParams.get('format')).toBe('png');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[1]).toBe('LOT-SAMPLE-0031');

    const report = requests.find((request) => request.method === 'POST');
    expect(new URL(report?.url ?? '').pathname).toBe('/app/document-issues/44001:report-print');
    expect(report?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(report?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(await report?.json()).toEqual({ outcome: 'SUCCEEDED' });
    expect(result.current.state.printed).toBe(1);
  });

  it('셸이 거부하면 실패 사유를 실어 보고한다 — 발행 기록은 그대로 둔다', async () => {
    const requests: Request[] = [];
    stubShell(async () => {
      throw new Error('프린터 오프라인');
    });

    const { result } = renderRunner(requests);

    await act(async () => {
      await result.current.run(TARGETS);
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('failed');
    });

    const report = requests.find((request) => request.method === 'POST');
    expect(await report?.json()).toEqual({
      outcome: 'FAILED',
      failureReason: '프린터 오프라인',
    });
    expect(result.current.state.reason).toBe('프린터 오프라인');
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

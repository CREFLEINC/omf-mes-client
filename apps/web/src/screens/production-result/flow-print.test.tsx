import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useLabelPrintRunner, type PrintTarget } from './flow-print';

const TARGET: PrintTarget = { documentIssueLogId: 44001, label: 'LOT-SYN-0001' };
const NEXT_TARGET: PrintTarget = { documentIssueLogId: 44002, label: 'LOT-SYN-0002' };
const OVERLAPPING_TARGET: PrintTarget = { documentIssueLogId: 44003, label: 'LOT-SYN-0003' };
const WORKER_NO = '100029';

interface ReportCall {
  idempotencyKey: string;
  outcome: string;
  failureReason?: string;
}

interface SetupOptions {
  renditionFails?: boolean;
  save?: () => Promise<string>;
  reportFailures?: number;
  reportResponse?: (attempt: number) => Response | Promise<Response>;
}

const pathOf = (request: Request): string => new URL(request.url).pathname;

const setup = (options: SetupOptions = {}) => {
  const save = vi.fn(options.save ?? (async () => '/tmp/lot.prn'));
  const reports: ReportCall[] = [];
  let renditionCalls = 0;

  Object.defineProperty(window, 'pop', {
    configurable: true,
    value: { rendition: { save } },
  });

  const fetch = createStubFetch([
    {
      match: (request) => pathOf(request).endsWith('/rendition'),
      respond: () => {
        renditionCalls += 1;
        return options.renditionFails === true
          ? jsonResponse({ errors: [{ message: '렌디션 실패' }] }, { status: 500 })
          : new Response(new Uint8Array([1, 2, 3]));
      },
    },
    {
      match: (request) => pathOf(request).endsWith(':report-print'),
      respond: () =>
        reports.length <= (options.reportFailures ?? 0)
          ? jsonResponse({ errors: [{ message: '보고 실패' }] }, { status: 500 })
          : new Response(null, { status: 204 }),
    },
  ]);

  const observedFetch = async (request: Request): Promise<Response> => {
    if (pathOf(request).endsWith(':report-print')) {
      const body = (await request.clone().json()) as {
        outcome: string;
        failureReason?: string;
      };
      reports.push({
        idempotencyKey: request.headers.get('Idempotency-Key') ?? '',
        outcome: body.outcome,
        ...(body.failureReason === undefined ? {} : { failureReason: body.failureReason }),
      });

      if (options.reportResponse !== undefined) {
        return options.reportResponse(reports.length);
      }
    }

    return fetch(request);
  };

  const rendered = renderHookWithProviders(() => useLabelPrintRunner(WORKER_NO), {
    fetch: observedFetch,
  });

  return { ...rendered, renditionCalls: () => renditionCalls, reports, save };
};

afterEach(() => {
  Reflect.deleteProperty(window, 'pop');
  vi.restoreAllMocks();
});

describe('생산 라벨 인쇄 절차', () => {
  it('물리 인쇄 뒤 보고만 실패하면 같은 발행 기록의 보고만 재시도한다', async () => {
    const { result, renditionCalls, reports, save } = setup({ reportFailures: 1 });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(result.current.state).toMatchObject({ phase: 'reportFailed', printed: 1 });
    expect(renditionCalls()).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(window, 'pop');

    await act(async () => {
      await result.current.retryReport();
    });

    expect(result.current.state).toEqual({ phase: 'succeeded', printed: 1, reason: null });
    expect(renditionCalls()).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.outcome)).toEqual(['SUCCEEDED', 'SUCCEEDED']);
    expect(reports[0]?.idempotencyKey).toBe(reports[1]?.idempotencyKey);
    expect(reports[0]?.idempotencyKey).not.toBe('');
  });

  it('보고 재시도 연타와 겹친 run에도 보고와 남은 라벨 인쇄를 한 흐름만 실행한다', async () => {
    let resolveRetry: ((response: Response) => void) | null = null;
    const pendingRetry = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    const { result, renditionCalls, reports, save } = setup({
      reportResponse: (attempt) => {
        if (attempt === 1) {
          return jsonResponse({ errors: [{ message: '보고 실패' }] }, { status: 500 });
        }
        if (attempt === 2) return pendingRetry;

        return new Response(null, { status: 204 });
      },
    });

    await act(async () => {
      await result.current.run([TARGET, NEXT_TARGET]);
    });
    expect(result.current.state.phase).toBe('reportFailed');

    await act(async () => {
      const firstRetry = result.current.retryReport();
      const secondRetry = result.current.retryReport();
      const overlappingRun = result.current.run([OVERLAPPING_TARGET]);
      resolveRetry?.(new Response(null, { status: 204 }));
      await Promise.all([firstRetry, secondRetry, overlappingRun]);
    });

    expect(result.current.state).toEqual({ phase: 'succeeded', printed: 2, reason: null });
    expect(renditionCalls()).toBe(2);
    expect(save).toHaveBeenCalledTimes(2);
    expect(reports.map((report) => report.outcome)).toEqual([
      'SUCCEEDED',
      'SUCCEEDED',
      'SUCCEEDED',
    ]);
    expect(reports[0]?.idempotencyKey).toBe(reports[1]?.idempotencyKey);
  });

  it('보고 재시도 실패 뒤 잠금을 풀어 다음 보고 재시도를 허용한다', async () => {
    const { result, reports, save } = setup({ reportFailures: 2 });

    await act(async () => {
      await result.current.run([TARGET]);
    });
    await act(async () => {
      await result.current.retryReport();
    });
    expect(result.current.state.phase).toBe('reportFailed');

    await act(async () => {
      await result.current.retryReport();
    });

    expect(result.current.state.phase).toBe('succeeded');
    expect(save).toHaveBeenCalledTimes(1);
    expect(reports).toHaveLength(3);
  });

  it('성공한 실행 뒤 잠금을 풀어 다음 명시적 실행을 허용한다', async () => {
    const { result, reports, save } = setup();

    await act(async () => {
      await result.current.run([TARGET]);
    });
    await act(async () => {
      await result.current.run([NEXT_TARGET]);
    });

    expect(result.current.state.phase).toBe('succeeded');
    expect(save).toHaveBeenCalledTimes(2);
    expect(reports).toHaveLength(2);
  });

  it('렌디션 수신 실패는 물리 인쇄 실패와 구분하고 실패를 보고한다', async () => {
    const { result, reports, save } = setup({ renditionFails: true });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(save).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ outcome: 'FAILED' }]);
  });

  it('물리 인쇄 실패는 결과 보고 실패와 구분하고 실패를 보고한다', async () => {
    let saveAttempts = 0;
    const { result, reports, save } = setup({
      save: async () => {
        saveAttempts += 1;
        if (saveAttempts === 1) throw new Error('용지 걸림');

        return '/tmp/lot.prn';
      },
    });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(result.current.state).toMatchObject({ phase: 'printFailed', printed: 0 });
    expect(reports).toMatchObject([{ outcome: 'FAILED', failureReason: '용지 걸림' }]);

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(result.current.state.phase).toBe('succeeded');
    expect(save).toHaveBeenCalledTimes(2);
  });
});

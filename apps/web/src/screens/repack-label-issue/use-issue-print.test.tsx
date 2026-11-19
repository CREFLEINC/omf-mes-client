import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { DOCUMENT_ISSUE_LOG_ID, HANDLING_UNIT_ID, HANDLING_UNIT_NO, WORKER_NO } from './fixtures';
import type { RenditionShell } from '../../patterns/pop-print';
import type { PackingLabelDraw } from './packing-label';
import { useIssuePrintRunner } from './use-issue-print';

const TARGET = {
  documentIssueLogId: DOCUMENT_ISSUE_LOG_ID,
  targetId: HANDLING_UNIT_ID,
  issueSeq: 2,
  label: HANDLING_UNIT_NO,
};

const PNG = new Uint8Array([137, 80, 78, 71]);
const COMMAND = 'SIZE 80 mm,30 mm\r\nPRINT 1\r\n';

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface ReportCall {
  outcome: string;
  failureReason?: string | null;
  idempotencyKey: string;
}

interface Options {
  /** 결과 보고가 실패한다 */
  reportFails?: boolean;
  /** 라벨을 그리지 못한다(그릴 값을 못 받았다) */
  drawFails?: boolean;
}

/*
 * ⛔ **`/rendition` 스텁을 등록해 둔다** — 부르면 안 되는 자리다(포장 라벨은 POP 이 그린다 ·
 * omf-all-around#327). 각 시험이 `renditionCalls()` 로 호출 수가 **0** 인지 잰다.
 */
const setup = (options: Options = {}) => {
  const reports: ReportCall[] = [];
  let renditionCalls = 0;
  const draw = vi.fn<PackingLabelDraw>(async () => {
    if (options.drawFails === true) throw new Error('LOT 을 불러오지 못했습니다.');

    return { png: new Uint8Array(PNG), command: COMMAND };
  });

  const fetch = createStubFetch([
    {
      match: (request) => pathOf(request).endsWith('/rendition'),
      respond: () => {
        renditionCalls += 1;

        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
    },
    {
      match: (request) => pathOf(request).includes(':report-print'),
      respond: (request) => {
        const key = request.headers.get('Idempotency-Key') ?? '';

        return options.reportFails === true
          ? jsonResponse({ message: '보고 실패' }, { status: 500 })
          : jsonResponse({ ok: true }, { headers: { 'X-Recorded-Key': key } });
      },
    },
  ]);

  const observedFetch = async (request: Request): Promise<Response> => {
    if (pathOf(request).includes(':report-print')) {
      const body = (await request.clone().json()) as {
        outcome: string;
        failureReason?: string | null;
      };

      reports.push({
        outcome: body.outcome,
        failureReason: body.failureReason,
        idempotencyKey: request.headers.get('Idempotency-Key') ?? '',
      });
    }

    return fetch(request);
  };

  const rendered = renderHookWithProviders(() => useIssuePrintRunner(WORKER_NO, draw), {
    fetch: observedFetch,
  });

  return { ...rendered, reports, draw, renditionCalls: () => renditionCalls };
};

/** POP 셸 통로를 세운다. 없으면 브라우저와 같은 상태다. */
const installShell = (save: RenditionShell['save']): void => {
  (window as unknown as { pop?: { rendition?: RenditionShell } }).pop = { rendition: { save } };
};

/* jsdom 은 `createObjectURL` 을 구현하지 않는다 — `URL` 을 통째로 갈지 않는다(주소 조립이 깨진다). */
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:label');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete (window as unknown as { pop?: unknown }).pop;
  vi.restoreAllMocks();
});

describe('발행 뒤 인쇄 절차 — 포장 라벨은 POP 이 그린다', () => {
  it('서버 렌디션을 부르지 않고 그린 라벨로 미리보기가 선다', async () => {
    const { result, renditionCalls, draw } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(draw).toHaveBeenCalledWith(HANDLING_UNIT_ID, 2);
    expect(result.current.state.phase).toBe('preview');
    expect(result.current.state.imageUrl).toBe('blob:label');
    expect(renditionCalls()).toBe(0);
  });

  /* ⛔ 못 그린 것은 발행 실패가 아니다 — 대상이 남아야 같은 기록으로 다시 그린다. */
  it('그리지 못해도 발행 실패로 말하지 않는다 — 대상과 사유가 남는다', async () => {
    const { result } = setup({ drawFails: true });

    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(result.current.state.target).toEqual(TARGET);
    expect(result.current.state.reason).toBe('LOT 을 불러오지 못했습니다.');
  });

  it('셸이 있으면 TSPL 명령을 보내고 성공을 보고한다', async () => {
    const save = vi.fn<RenditionShell['save']>(async () => 'ok');
    installShell(save);
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(save).toHaveBeenCalledTimes(1);
    const [payload, label, , format] = save.mock.calls[0] ?? [];
    expect(new TextDecoder().decode(payload)).toBe(COMMAND);
    expect(label).toBe(HANDLING_UNIT_NO);
    expect(format).toBe('tspl');
    expect(reports.map((each) => each.outcome)).toEqual(['SUCCEEDED']);
    expect(result.current.state.phase).toBe('succeeded');
  });

  it('셸이 없으면 보내지 않고 shellUnavailable 이다 — 보고하지 않는다', async () => {
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(reports).toHaveLength(0);
    expect(result.current.state.phase).toBe('shellUnavailable');
  });

  it('셸이 보내지 못하면 실패로 보고하고 failed 다', async () => {
    installShell(vi.fn<RenditionShell['save']>(async () => Promise.reject(new Error('용지 없음'))));
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(reports[0]).toMatchObject({ outcome: 'FAILED', failureReason: '용지 없음' });
    expect(result.current.state.phase).toBe('failed');
  });

  it('미리보기를 다시 열어도 서버 렌디션 요청이 나가지 않는다', async () => {
    const { result, renditionCalls, draw } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(draw).toHaveBeenCalledTimes(2);
    expect(renditionCalls()).toBe(0);
  });

  it('보고 재시도는 대상이 남아 있으면 그대로 동작한다', async () => {
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.retryReport();
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.outcome).toBe('SUCCEEDED');
    expect(result.current.state.phase).toBe('succeeded');
  });

  /* ⛔ 재시도마다 새 키를 만들면 같은 보고가 다른 쓰기로 나간다. */
  it('같은 결과의 보고는 멱등 키가 같다', async () => {
    const { result, reports } = setup({ reportFails: true });

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.retryReport();
    });
    await act(async () => {
      await result.current.retryReport();
    });

    await waitFor(() => {
      expect(reports).toHaveLength(2);
    });
    expect(reports[0]?.idempotencyKey).toBe(reports[1]?.idempotencyKey);
    expect(reports[0]?.idempotencyKey).not.toBe('');
  });

  /* 닫아도 발행 기록은 남는다 — 인쇄는 나중에 다시 할 수 있다. */
  it('미리보기를 닫아도 대상을 잃지 않는다', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    act(() => {
      result.current.dismiss();
    });

    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.target).toEqual(TARGET);
  });
});

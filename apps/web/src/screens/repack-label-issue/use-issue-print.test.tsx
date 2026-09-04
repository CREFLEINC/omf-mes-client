import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { DOCUMENT_ISSUE_LOG_ID, HANDLING_UNIT_NO, WORKER_NO } from './fixtures';
import type { RenditionShell } from './print';
import { useIssuePrintRunner } from './use-issue-print';

const TARGET = { documentIssueLogId: DOCUMENT_ISSUE_LOG_ID, label: HANDLING_UNIT_NO };

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface ReportCall {
  outcome: string;
  failureReason?: string | null;
  idempotencyKey: string;
}

interface Options {
  /** 그린 것을 받지 못한다 */
  renditionFails?: boolean;
  /** 결과 보고가 실패한다 */
  reportFails?: boolean;
}

const setup = (options: Options = {}) => {
  const reports: ReportCall[] = [];
  let renditionCalls = 0;

  const fetch = createStubFetch([
    {
      match: (request) => pathOf(request).endsWith('/rendition'),
      respond: () => {
        renditionCalls += 1;

        if (options.renditionFails === true) {
          return jsonResponse({ message: '렌디션 실패' }, { status: 500 });
        }

        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        });
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

  /* 보고 본문·헤더를 들여다보려면 요청을 가로채야 한다 — 스텁 응답만으로는 못 본다. */
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

  const rendered = renderHookWithProviders(() => useIssuePrintRunner(WORKER_NO), {
    fetch: observedFetch,
  });

  return { ...rendered, reports, renditionCalls: () => renditionCalls };
};

/** POP 셸 통로를 세운다. 없으면 브라우저와 같은 상태다. */
const installShell = (save: RenditionShell['save']): void => {
  (window as unknown as { pop?: { rendition?: RenditionShell } }).pop = { rendition: { save } };
};

/*
 * jsdom 은 `createObjectURL` 을 구현하지 않는다. ⛔ **`URL` 을 통째로 갈아치우지 않는다** —
 * 그러면 생성자가 사라져 API 클라이언트의 주소 조립까지 깨진다(실측).
 */
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:label');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete (window as unknown as { pop?: unknown }).pop;
  vi.restoreAllMocks();
});

describe('발행 뒤 인쇄 절차', () => {
  it('그린 것을 받으면 미리보기가 선다', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(result.current.state.phase).toBe('preview');
    expect(result.current.state.imageUrl).toBe('blob:label');
  });

  /*
   * ⛔ **그림을 못 받은 것은 발행 실패가 아니다.** 기록은 남았으므로 화면이 이 둘을 뭉뚱그리면
   * 사용자가 다시 «발행»을 눌러 회차를 하나 더 올린다.
   */
  it('그린 것을 못 받아도 발행 실패로 말하지 않는다', async () => {
    const { result } = setup({ renditionFails: true });

    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(result.current.state.target).toEqual(TARGET);
  });

  it('인쇄하면 성공을 보고한다', async () => {
    installShell(vi.fn(async () => 'ok'));
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('succeeded');
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]?.outcome).toBe('SUCCEEDED');
  });

  /*
   * ⛔ 보고하지 않으면 발행 기록이 곧 인쇄 성공으로 읽혀, 실제로는 안 나온 라벨이 나온 것으로
   * 남는다(계약).
   */
  it('셸이 실패하면 실패를 사유와 함께 보고한다', async () => {
    installShell(
      vi.fn(async () => {
        throw new Error('용지 걸림');
      }),
    );
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(result.current.state.phase).toBe('failed');
    expect(reports[0]?.outcome).toBe('FAILED');
    expect(reports[0]?.failureReason).toBe('용지 걸림');
    expect(result.current.state.reason).toBe('용지 걸림');
  });

  /*
   * ⚠ **보고 실패가 인쇄 성공을 뒤집지 않는다.** 종이는 이미 나왔다 — 「인쇄되지 않았다」고
   * 말하면 사용자가 한 장을 더 뽑는다.
   *
   * ⛔ **`failed` 와 갈린 상태여야 한다.** 같은 상태로 두면 화면이 두 경우를 구분할 수 없어
   * 복구로 「다시 인쇄」를 권하게 된다(독립 검증 실측).
   */
  it('종이가 나온 뒤 보고만 실패하면 인쇄 실패와 다른 상태다', async () => {
    const save = vi.fn(async () => 'ok');
    installShell(save);
    const { result } = setup({ reportFails: true });

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('reportFailed');
    expect(result.current.state.phase).not.toBe('failed');
  });

  /* ⛔ 복구는 보고 재시도다 — 셸을 다시 부르면 같은 라벨이 한 장 더 나온다. */
  it('보고 재시도가 종이를 다시 뽑지 않는다', async () => {
    const save = vi.fn<RenditionShell['save']>(async () => 'ok');
    installShell(save);
    const { result, reports } = setup({ reportFails: true });

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });
    await act(async () => {
      await result.current.retryReport();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(reports).toHaveLength(2);
    expect(reports[1]?.outcome).toBe('SUCCEEDED');
  });

  /* ⛔ 재시도마다 새 키를 만들면 같은 보고가 다른 쓰기로 나간다. */
  it('같은 결과의 보고는 멱등 키가 같다', async () => {
    installShell(vi.fn(async () => 'ok'));
    const { result, reports } = setup({ reportFails: true });

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });
    await act(async () => {
      await result.current.print();
    });

    expect(reports).toHaveLength(2);
    expect(reports[0]?.idempotencyKey).toBe(reports[1]?.idempotencyKey);
    expect(reports[0]?.idempotencyKey).not.toBe('');
  });

  /*
   * ⛔ 두 번 받으면 서버가 두 번 그리고, 그사이 값이 달라지면 **본 것과 나온 것이 갈린다.**
   */
  it('미리보기와 인쇄가 같은 바이트를 쓴다 — 다시 받지 않는다', async () => {
    /* 인자를 들여다보므로 셸 통로의 시그니처를 그대로 준다 — 안 주면 `calls` 가 빈 튜플이다. */
    const save = vi.fn<RenditionShell['save']>(async () => 'ok');
    installShell(save);
    const { result, renditionCalls } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(renditionCalls()).toBe(1);
    expect(save.mock.calls[0]?.[0]).toEqual(new Uint8Array([1, 2, 3]));
  });

  /* 셸 밖(관리웹)이다. 발행은 끝났고 인쇄만 여기서 할 수 없다. */
  it('셸이 없으면 보내지 않고 사유만 남긴다', async () => {
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(result.current.state.phase).toBe('shellUnavailable');
    expect(reports).toHaveLength(0);
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

import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LABEL_RENDITION_NOT_READY_REASON } from '../../patterns/pop-label-rendition';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { DOCUMENT_ISSUE_LOG_ID, HANDLING_UNIT_ID, HANDLING_UNIT_NO, WORKER_NO } from './fixtures';
import type { RenditionShell } from './print';
import { useIssuePrintRunner } from './use-issue-print';

const TARGET = {
  documentIssueLogId: DOCUMENT_ISSUE_LOG_ID,
  targetId: HANDLING_UNIT_ID,
  label: HANDLING_UNIT_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface ReportCall {
  outcome: string;
  failureReason?: string | null;
  idempotencyKey: string;
}

interface Options {
  /** 결과 보고가 실패한다 */
  reportFails?: boolean;
}

/*
 * ⛔ **`/rendition` 스텁을 그래도 등록해 둔다** — 부르면 안 되는 자리다. 실수로 다시 부르게
 * 되돌아가면(회귀) 이 스텁이 «성공」을 돌려줘 위의 실패 계열 시험들이 조용히 통과해 버리는
 * 대신, 아래 각 시험이 `renditionCalls()` 로 호출 수가 **0** 인지 직접 잰다.
 */
const setup = (options: Options = {}) => {
  const reports: ReportCall[] = [];
  let renditionCalls = 0;

  const fetch = createStubFetch([
    {
      match: (request) => pathOf(request).endsWith('/rendition'),
      respond: () => {
        renditionCalls += 1;

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

/*
 * ⚠ **이 describe 전체가 대응표 P1 「미구현 5건」의 영향을 받는다.** `GET
 * /app/document-issues/{id}/rendition` 은 서버에 경로 자체가 없어(`patterns/pop-label-rendition`
 * 머리말) `begin()` 은 이제 **항상** `renditionFailed` 로 멈춘다 — 그림을 못 받으므로
 * `bytes.current` 가 결코 채워지지 않고, 그 아래 `print()` 는 대상이 있어도 조용히 아무 일도
 * 하지 않는다(코드의 `if (target === null || payload === null) return;`). 그래서 원래
 * 「받으면 미리보기가 선다」·「인쇄하면 성공을 보고한다」처럼 그림을 실제로 받는 것을 전제한
 * 시험들은 더는 일어날 수 없는 경로였다 — 지우지 않고, 지금 실제로 일어나는 것(요청이 나가지
 * 않는다 · 인쇄가 조용히 막힌다 · 발행 기록은 그대로 남아 재시도할 수 있다)으로 다시 적는다.
 */
describe('발행 뒤 인쇄 절차 — 서버에 렌디션 경로가 없어 미리보기·인쇄가 막혔다', () => {
  it('그림을 받으러 네트워크 요청을 보내지 않고 곧바로 renditionFailed 로 정착한다', async () => {
    const { result, renditionCalls } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(renditionCalls()).toBe(0);
  });

  /*
   * ⛔ **그림을 못 받은 것은 발행 실패가 아니다.** 기록은 남았으므로 화면이 이 둘을 뭉뚱그리면
   * 사용자가 다시 «발행»을 눌러 회차를 하나 더 올린다 — 대상이 그대로 남아 있어야 재시도(같은
   * 회차의 미리보기 다시 열기)가 된다.
   */
  it('그린 것을 못 받아도 발행 실패로 말하지 않는다 — 대상이 남아 사유도 「준비 중」임을 말한다', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(result.current.state.target).toEqual(TARGET);
    expect(result.current.state.reason).toBe(LABEL_RENDITION_NOT_READY_REASON);
  });

  /*
   * ⭐ **셸이 있어도 막힌다.** 막힌 자리가 셸 판정보다 «앞»(그림을 받는 걸음)이라, 실기 단말에
   * 연결해도 인쇄까지 가지 못한다는 것을 잠근다 — 이 성질이 무너지면 어떤 단말에서는 예전
   * 그대로 인쇄가 되는 것처럼 보일 수 있다.
   */
  it('셸이 있어도 인쇄를 시도하지 않는다 — 받은 바이트가 없다', async () => {
    const save = vi.fn<RenditionShell['save']>(async () => 'ok');
    installShell(save);
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(save).not.toHaveBeenCalled();
    expect(reports).toHaveLength(0);
    /* ⛔ `shellUnavailable` 로도 빠지지 않는다 — `print()` 가 셸을 보기도 전에 멈춘다. */
    expect(result.current.state.phase).toBe('renditionFailed');
  });

  it('셸이 없어도 같은 이유로 인쇄를 시도하지 않는다', async () => {
    const { result, reports } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.print();
    });

    expect(reports).toHaveLength(0);
    expect(result.current.state.phase).toBe('renditionFailed');
  });

  /*
   * ⚠ **재시도(미리보기 다시 열기)도 서버를 다시 부르지 않는다.** 대역이 상태를 갖지 않으므로
   * 몇 번을 다시 눌러도 네트워크 요청은 늘 0이다 — 사용자가 계속 눌러도 서버에 부담을 주지
   * 않는다는 뜻이다.
   */
  it('미리보기를 다시 열어도 요청이 나가지 않는다', async () => {
    const { result, renditionCalls } = setup();

    await act(async () => {
      await result.current.begin(TARGET);
    });
    await act(async () => {
      await result.current.begin(TARGET);
    });

    expect(renditionCalls()).toBe(0);
    expect(result.current.state.phase).toBe('renditionFailed');
  });

  /*
   * ⚠ **`retryReport` 는 그림 취득과 무관하게 남아 있는 경로다.** 화면은 `reportFailed` 일
   * 때만 이 단추를 보이는데 그 상태에 이제 이를 방법이 없어졌지만(인쇄 자체가 없으니 보고도
   * 없다), 함수 자체는 대상만 있으면 그대로 동작한다 — 그 계약이 조용히 깨지지 않았는지만
   * 잰다.
   */
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

import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LABEL_RENDITION_NOT_READY_REASON } from '../../patterns/pop-label-rendition';
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
  /*
   * ⛔⛔ **서버에 `GET /app/document-issues/{id}/rendition` 경로가 없다**(`patterns/
   * pop-label-rendition` 머리말 · 대응표 P1 「미구현 5건」). 원래 이 시험은 «물리 인쇄까지는
   * 됐는데 성공 보고만 실패한» 상태(`reportFailed`)에서 `retryReport` 가 그 보고만 다시
   * 보내는 것을 쟀다 — 그림을 받는 걸음이 항상 막혀 있어 물리 인쇄 자체가 없고, 그 상태
   * (`pendingSuccessReport`)가 결코 서지 않는다. **재시도는 할 일이 없어 조용히 아무 일도
   * 하지 않는다**는, 지금 실제로 성립하는 사실로 다시 잰다.
   */
  it('그림을 받지 못하면 물리 인쇄 없이 실패로 보고되고, 보고 재시도는 할 일이 없다', async () => {
    const { result, renditionCalls, reports, save } = setup();

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(result.current.state).toEqual({
      phase: 'renditionFailed',
      printed: 0,
      reason: LABEL_RENDITION_NOT_READY_REASON,
    });
    expect(renditionCalls()).toBe(0);
    expect(save).not.toHaveBeenCalled();
    expect(reports).toMatchObject([
      { outcome: 'FAILED', failureReason: LABEL_RENDITION_NOT_READY_REASON },
    ]);

    /* 물리 인쇄가 없었으니 되돌릴(재시도할) 성공 보고도 없다 — 조용히 아무 일도 하지 않는다. */
    await act(async () => {
      await result.current.retryReport();
    });

    expect(result.current.state).toEqual({
      phase: 'renditionFailed',
      printed: 0,
      reason: LABEL_RENDITION_NOT_READY_REASON,
    });
    expect(reports).toHaveLength(1);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 보고 재시도 연타와 겹친 `run`이
   * 뒤섞이지 않고 한 흐름만 실행되는 것을, «성공까지 이어지는» 긴 시나리오로 쟀다 — 성공
   * 자체가 더는 없다. **겹쳐 부른 `run`이 무시된다**(`isExecuting` 잠금)는 알맹이는 남아
   * 있으므로, 실행 중에 겹쳐 부른 두 번째 `run`이 아무 요청도 보태지 않는지로 다시 잰다.
   */
  it('실행 중에 겹쳐 부른 run은 무시된다 — 보고를 두 번 보태지 않는다', async () => {
    const { result, reports, save } = setup();

    await act(async () => {
      const first = result.current.run([TARGET, NEXT_TARGET]);
      const overlapping = result.current.run([OVERLAPPING_TARGET]);
      await Promise.all([first, overlapping]);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(save).not.toHaveBeenCalled();
    /* 겹쳐 부른 두 번째 run은 실행되지 않아, 첫 대상 하나의 실패 보고만 나갔다. */
    expect(reports).toMatchObject([{ outcome: 'FAILED' }]);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 보고 재시도가 거듭 실패해도
   * 잠금이 풀려 다음 재시도를 받아들이는 것을 쟀다 — `retryReport` 가 이제 할 일이 없는
   * 자리(위 시험)라 그 경로로는 잠금을 다시 걸 수 없다. **`retryReport`(할 일이 없어 곧바로
   * 끝난다)를 부른 뒤에도 잠금이 정말 풀려 있어, 이어지는 다음 `run`이 막히지 않는지**로
   * 같은 「잠금이 풀린다」 성질을 다시 잰다.
   */
  it('할 일 없는 보고 재시도 뒤에도 잠금이 풀려 다음 run을 받아들인다', async () => {
    const { result, reports, save } = setup();

    await act(async () => {
      await result.current.run([TARGET]);
    });
    await act(async () => {
      await result.current.retryReport();
    });
    await act(async () => {
      await result.current.run([NEXT_TARGET]);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(save).not.toHaveBeenCalled();
    /* 대상별로 한 번씩, 실패 보고 두 건이 나갔다 — 잠금에 걸려 빠진 것이 없다. */
    expect(reports).toHaveLength(2);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 제목의 「성공한 실행」은 더는 없지만,
   * **실행이 끝난 뒤(성공이든 실패든) 잠금이 풀려 다음 명시적 실행을 받아들인다**는 성질은
   * 그대로 지켜야 한다 — 안 풀리면 화면이 두 번째 대상부터는 영영 인쇄를 시도조차 못 한다.
   */
  it('실패로 끝난 실행 뒤에도 잠금을 풀어 다음 명시적 실행을 허용한다', async () => {
    const { result, reports, save } = setup();

    await act(async () => {
      await result.current.run([TARGET]);
    });
    await act(async () => {
      await result.current.run([NEXT_TARGET]);
    });

    expect(result.current.state.phase).toBe('renditionFailed');
    expect(save).not.toHaveBeenCalled();
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

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 «물리 인쇄 자체의» 실패
   * (`printFailed`)가 렌디션 실패와 다른 사유로 갈리는 것을 쟀다 — 이제는 그림을 받는 걸음이
   * 셸을 부르기 «전»에 이미 막혀 있어 `printFailed` 에 이를 수 없다. 셸이 결국 성공하도록
   * 준비해 두어도(«셸 탓이 아님»을 보이려고) 그 셸이 «불리지조차 않는다»는 사실로 다시 잰다.
   */
  it('그림을 받지 못하면 셸이 정상이어도 부르지 않는다 — printFailed 로 갈리지 않는다', async () => {
    let saveAttempts = 0;
    const { result, reports, save } = setup({
      save: async () => {
        saveAttempts += 1;

        return '/tmp/lot.prn';
      },
    });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(result.current.state).toMatchObject({ phase: 'renditionFailed', printed: 0 });
    expect(reports).toMatchObject([
      { outcome: 'FAILED', failureReason: LABEL_RENDITION_NOT_READY_REASON },
    ]);
    expect(saveAttempts).toBe(0);
    expect(save).not.toHaveBeenCalled();
  });
});

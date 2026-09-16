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
  /** 셸이 명령형(RAW) 인쇄를 할 수 있는가. 주지 않으면 「못 한다」 — 그림으로 간다. */
  raw?: boolean;
  renditionFails?: boolean;
  save?: () => Promise<string>;
  reportFailures?: number;
  reportResponse?: (attempt: number) => Response | Promise<Response>;
}

const pathOf = (request: Request): string => new URL(request.url).pathname;

/** 셸에 넘긴 형식. 저장 호출의 넷째 인자다(`save(bytes, label, now, format)`). */
const savedFormats = (save: { mock: { calls: unknown[][] } }): unknown[] =>
  save.mock.calls.map((call) => call[3]);

const setup = (options: SetupOptions = {}) => {
  const save = vi.fn(options.save ?? (async () => '/tmp/lot.prn'));
  const reports: ReportCall[] = [];
  const formats: string[] = [];
  let renditionCalls = 0;

  Object.defineProperty(window, 'pop', {
    configurable: true,
    value: {
      rendition: { save },
      printers: { capabilities: async () => ({ raw: options.raw === true }) },
    },
  });

  const fetch = createStubFetch([
    {
      match: (request) => pathOf(request).endsWith('/rendition'),
      respond: (request) => {
        renditionCalls += 1;
        formats.push(new URL(request.url).searchParams.get('format') ?? '');
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

  return {
    ...rendered,
    renditionCalls: () => renditionCalls,
    reports,
    save,
    formats,
    reportKeys: () => reports.map((each) => each.idempotencyKey),
  };
};

afterEach(() => {
  Reflect.deleteProperty(window, 'pop');
  vi.restoreAllMocks();
});

describe('생산 라벨 인쇄 절차', () => {
  /*
   * 서버가 생산 LOT 라벨의 그림을 그려 준다(실측 2026-09-15). 한때 클라이언트가 그 종류를
   * 「아직 준비되지 않았다」로 막아 물리 인쇄까지 가는 길 자체가 없었고, 이 시험도 그 상태를
   * 재고 있었다 — 막힘을 걷었으니(WIP-CHAIN-01 D1) 원래 재려던 것으로 되돌린다:
   * **물리 인쇄까지는 됐는데 성공 보고만 실패한 상태에서, 재시도가 그 보고만 다시 보낸다.**
   */
  it('인쇄는 됐는데 보고만 실패하면 재시도가 그 보고만 다시 보낸다', async () => {
    const { result, renditionCalls, reports, save } = setup({ reportFailures: 1 });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    /* 그림을 받고 셸까지 불렀다 — 막히던 시절과 갈리는 자리다. */
    expect(renditionCalls()).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({ phase: 'reportFailed', printed: 1 });
    expect(reports).toMatchObject([{ outcome: 'SUCCEEDED' }]);

    await act(async () => {
      await result.current.retryReport();
    });

    expect(result.current.state).toMatchObject({ phase: 'succeeded', printed: 1 });
    /* 보고만 다시 갔다 — 물리 인쇄를 다시 하지 않는다. */
    expect(save).toHaveBeenCalledTimes(1);
    expect(reports).toMatchObject([{ outcome: 'SUCCEEDED' }, { outcome: 'SUCCEEDED' }]);
  });

  /* 겹쳐 부른 `run` 은 잠금(`isExecuting`)에 막혀 아무 요청도 보태지 않는다. */
  it('실행 중에 겹쳐 부른 run은 무시된다 — 보고를 두 번 보태지 않는다', async () => {
    const { result, reports, save } = setup();

    await act(async () => {
      const first = result.current.run([TARGET, NEXT_TARGET]);
      const overlapping = result.current.run([OVERLAPPING_TARGET]);
      await Promise.all([first, overlapping]);
    });

    expect(result.current.state.phase).toBe('succeeded');
    /* 겹쳐 부른 두 번째 run은 실행되지 않아, 첫 run 의 두 대상만 나갔다. */
    expect(save).toHaveBeenCalledTimes(2);
    expect(reports).toMatchObject([{ outcome: 'SUCCEEDED' }, { outcome: 'SUCCEEDED' }]);
  });

  /* 보고 재시도 뒤에도 잠금이 풀려 이어지는 `run` 이 막히지 않는다. */
  it('보고 재시도 뒤에도 잠금이 풀려 다음 run을 받아들인다', async () => {
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

    expect(result.current.state.phase).toBe('succeeded');
    /* 대상별로 한 번씩 인쇄·보고가 나갔다 — 잠금에 걸려 빠진 것이 없다. */
    expect(save).toHaveBeenCalledTimes(2);
    expect(reports).toHaveLength(2);
  });

  /* 실행이 끝나면 잠금이 풀린다 — 안 풀리면 두 번째 대상부터 영영 인쇄를 시도조차 못 한다. */
  it('끝난 실행 뒤에는 잠금을 풀어 다음 명시적 실행을 허용한다', async () => {
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

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 «물리 인쇄 자체의» 실패
   * (`printFailed`)가 렌디션 실패와 다른 사유로 갈리는 것을 쟀다 — 이제는 그림을 받는 걸음이
   * 셸을 부르기 «전»에 이미 막혀 있어 `printFailed` 에 이를 수 없다. 셸이 결국 성공하도록
   * 준비해 두어도(«셸 탓이 아님»을 보이려고) 그 셸이 «불리지조차 않는다»는 사실로 다시 잰다.
   */
  it('그림을 받지 못하면 셸이 정상이어도 부르지 않는다 — printFailed 로 갈리지 않는다', async () => {
    let saveAttempts = 0;
    const { result, reports, save } = setup({
      renditionFails: true,
      save: async () => {
        saveAttempts += 1;

        return '/tmp/lot.prn';
      },
    });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(result.current.state).toMatchObject({ phase: 'renditionFailed', printed: 0 });
    expect(reports).toMatchObject([{ outcome: 'FAILED' }]);
    expect(saveAttempts).toBe(0);
    expect(save).not.toHaveBeenCalled();
  });

  /*
   * 셸에 명령형(RAW) 자리가 없으면 그림(`png`)을 받아야 찍힌다. 무조건 `tspl` 을 받던 때는
   * 인쇄가 「보낼 프린터를 찾을 수 없다」로 멎어 라벨을 못 붙였다(WIP-CHAIN-01 D6 실측 · macOS).
   */
  it('명령형 인쇄를 못 하는 셸에는 그림을 받아 넘긴다', async () => {
    const { result, save, formats } = setup({ raw: false });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(formats).toEqual(['png']);
    expect(savedFormats(save)).toEqual(['png']);
    expect(result.current.state.phase).toBe('succeeded');
  });

  it('명령형 인쇄를 하는 셸에는 명령형을 받아 넘긴다', async () => {
    const { result, save, formats } = setup({ raw: true });

    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(formats).toEqual(['tspl']);
    expect(savedFormats(save)).toEqual(['tspl']);
  });

  /*
   * 서버 멱등 규칙은 「같은 키 · 다른 본문」을 409 로 거절한다. 실패 사유가 시도마다 다를 수
   * 있어 성공·실패 두 슬롯으로만 가르면 두 번째 실패 보고가 통째로 거절됐다(D6 실측).
   */
  it('실패 사유가 다르면 보고 멱등 키도 다르다', async () => {
    let attempt = 0;
    const { result, reportKeys } = setup({
      raw: false,
      save: async () => {
        attempt += 1;
        throw new Error(attempt === 1 ? '프린터를 찾을 수 없다' : '용지가 없다');
      },
    });

    await act(async () => {
      await result.current.run([TARGET]);
    });
    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(reportKeys()).toHaveLength(2);
    expect(reportKeys()[0]).not.toBe(reportKeys()[1]);
  });

  /* 같은 사유의 되풀이는 흡수된다 — 끊긴 자리에서 다시 보낸 것을 서버가 두 건으로 세지 않는다. */
  it('같은 실패 사유의 재시도는 같은 키를 쓴다', async () => {
    const { result, reportKeys } = setup({
      raw: false,
      save: async () => {
        throw new Error('프린터를 찾을 수 없다');
      },
    });

    await act(async () => {
      await result.current.run([TARGET]);
    });
    await act(async () => {
      await result.current.run([TARGET]);
    });

    expect(reportKeys()).toHaveLength(2);
    expect(reportKeys()[0]).toBe(reportKeys()[1]);
  });
});

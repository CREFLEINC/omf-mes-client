import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { FAILED_ISSUE, PRINTED_ISSUE, splitLot } from './split-fixtures';
import { useSplitLabelPrint, type SplitPrintResult } from './split-print';

/*
 * 008 P-01-02 분할 LOT 라벨 찍기(omf-all-around#289) — 발행 본문 · 라벨 값 · 실패 처리. 합성값만 쓴다.
 */

afterEach(() => {
  delete window.pop;
});

const WORKER = '900028';
const OPTIONS = { printerName: null, shellPrinterName: null, reissueReasonCode: 'DAMAGED' };

interface Sent {
  issues: unknown[];
  reports: { id: string; body: unknown }[];
}

const mount = (options: { issueStatus?: number } = {}) => {
  const sent: Sent = { issues: [], reports: [] };
  let seq = 0;
  const view = renderHookWithProviders(() => useSplitLabelPrint(WORKER), {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url);

      if (pathname === '/app/document-issues') {
        sent.issues.push(await request.json());

        if (options.issueStatus !== undefined) {
          return jsonResponse(
            { code: 'X', message: '합성 거절', errors: [] },
            { status: options.issueStatus },
          );
        }

        seq += 1;

        return jsonResponse(
          {
            items: [
              { documentIssueLogId: 8000 + seq, issueSeq: 1, lotNo: null, printOutcome: 'PENDING' },
            ],
          },
          { status: 201 },
        );
      }

      const report = /^\/app\/document-issues\/(\d+):report-print$/u.exec(pathname);

      if (report !== null) {
        sent.reports.push({ id: report[1] ?? '', body: await request.json() });

        return jsonResponse({}, { status: 200 });
      }

      throw new Error(`스텁에 없는 요청: ${pathname}`);
    },
  });

  return { ...view, sent };
};

const withShell = (save: (bytes: Uint8Array) => Promise<string>) => {
  const calls: Uint8Array[] = [];

  window.pop = {
    rendition: {
      save: (bytes: Uint8Array) => {
        calls.push(bytes);

        return save(bytes);
      },
    },
  } as unknown as typeof window.pop;

  return calls;
};

const latin1 = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('useSplitLabelPrint', () => {
  it('US2-2 자재 LOT 라벨로 발행하고(MATERIAL_LOT_LABEL · LOT) QR 에 분할 번호, 수량은 분할 수량 — 패키징 줄 없음', async () => {
    const shell = withShell(() => Promise.resolve('/tmp/x.tspl'));
    const { result, sent } = mount();
    let results: SplitPrintResult[] = [];

    await act(async () => {
      results = await result.current.run([splitLot()], OPTIONS);
    });

    expect(results).toEqual([{ lotId: 7101, outcome: 'printed', message: null }]);
    expect(sent.issues).toEqual([
      {
        documentTypeCode: 'MATERIAL_LOT_LABEL',
        targets: [{ targetTypeCode: 'LOT', targetId: 7101, lotId: 7101 }],
      },
    ]);
    const text = latin1(shell[0] ?? new Uint8Array());
    expect(text).toContain('"SYN-ITEM-A|300|261117|100330|0001-S1"');
    expect(text).toContain('"300 EA"');
    expect(text).not.toContain('×');
    expect(sent.reports).toEqual([{ id: '8001', body: { outcome: 'SUCCEEDED' } }]);
  });

  it('US2-4 발행 기록이 있는 LOT 에만 재발행 사유를 싣는다 — 첫 발행에는 싣지 않는다', async () => {
    withShell(() => Promise.resolve('/tmp/x.tspl'));
    const { result, sent } = mount();

    await act(async () => {
      await result.current.run(
        [
          splitLot({ lotId: 1, labelIssue: FAILED_ISSUE }),
          splitLot({ lotId: 2 }),
          splitLot({ lotId: 3, labelIssue: PRINTED_ISSUE }),
        ],
        OPTIONS,
      );
    });

    expect(
      sent.issues.map((body) => (body as { reissueReasonCode?: string }).reissueReasonCode),
    ).toEqual(['DAMAGED', undefined, 'DAMAGED']);
  });

  it('US2-3 인쇄가 실패하면 실패로 보고하고 남은 장은 보내지 않는다', async () => {
    withShell(() => Promise.reject(new Error('프린터가 응답하지 않습니다.')));
    const { result, sent } = mount();
    let results: SplitPrintResult[] = [];

    await act(async () => {
      results = await result.current.run([splitLot({ lotId: 1 }), splitLot({ lotId: 2 })], OPTIONS);
    });

    expect(results.map((each) => each.outcome)).toEqual(['printFailed', 'notSent']);
    expect(sent.issues).toHaveLength(1);
    expect(sent.reports).toEqual([
      { id: '8001', body: { outcome: 'FAILED', failureReason: '프린터가 응답하지 않습니다.' } },
    ]);
  });

  it('셸 통로가 없으면 인쇄 실패로 보고한다 — 나오지 않은 라벨을 나온 것으로 남기지 않는다', async () => {
    const { result, sent } = mount();
    let results: SplitPrintResult[] = [];

    await act(async () => {
      results = await result.current.run([splitLot()], OPTIONS);
    });

    expect(results[0]?.outcome).toBe('printFailed');
    expect(sent.reports[0]?.body).toMatchObject({ outcome: 'FAILED' });
  });

  it('발행 권한이 없으면(403) 남은 장을 보내지 않는다', async () => {
    withShell(() => Promise.resolve('/tmp/x.tspl'));
    const { result, sent } = mount({ issueStatus: 403 });
    let results: SplitPrintResult[] = [];

    await act(async () => {
      results = await result.current.run([splitLot({ lotId: 1 }), splitLot({ lotId: 2 })], OPTIONS);
    });

    expect(results.map((each) => each.outcome)).toEqual(['issueForbidden', 'notSent']);
    expect(sent.issues).toHaveLength(1);
  });

  it('⛔ 사번을 모르면 아무것도 부르지 않는다', async () => {
    const fetch = vi.fn();
    const { result } = renderHookWithProviders(() => useSplitLabelPrint(null), { fetch });

    await act(async () => {
      await result.current.run([splitLot()], OPTIONS);
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});

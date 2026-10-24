import { describe, expect, it } from 'vitest';

import { retryCommands, rowStatusOf, summarize, type BatchSnapshot } from './batch-view';
import type { IssueRunResult } from './mutations';
import type { TargetRow } from './types';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const result = (over: Partial<IssueRunResult>): IssueRunResult => ({
  lineId: 1,
  isPrinted: false,
  failedAt: null,
  hasCreatedLot: false,
  hasPrintedLabel: false,
  issue: null,
  lotId: null,
  error: null,
  iqcLabel: null,
  ...over,
});

const printed = (lineId: number): IssueRunResult =>
  result({ lineId, isPrinted: true, lotId: 9000 + lineId });

const printFailed = (lineId: number): IssueRunResult =>
  result({
    lineId,
    failedAt: 'print',
    hasCreatedLot: true,
    lotId: 9000 + lineId,
    issue: { documentIssueLogId: 1, issueSeq: 1, lotNo: null, printOutcome: 'PENDING' },
  });

const snapshot = (over: Partial<BatchSnapshot>): BatchSnapshot => ({
  order: [],
  results: new Map(),
  skipped: new Set(),
  notRun: new Set(),
  currentLineId: null,
  ...over,
});

const row = (id: number): TargetRow => ({
  inboundReceiptLineId: id,
  lineNo: 1,
  inboundReceiptId: id,
  inboundReceiptNo: `SYN-IB-${String(id)}`,
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime: '2026-08-27T02:00:00Z',
  itemId: 8601,
  receivedQty: 1,
  uomId: 8401,
  lotId: null,
  inspectionRequired: false,
  lotNo: null,
  lotStatusCode: null,
  lastIssue: null,
});

describe('rowStatusOf', () => {
  it('보내지 않은 줄 · 보내는 줄 · 기다리는 줄 · 끝난 줄을 가른다', () => {
    const batch = snapshot({
      order: [1, 2, 3, 4, 5],
      currentLineId: 2,
      results: new Map([[1, printed(1)]]),
      skipped: new Set([4]),
      notRun: new Set([5]),
    });

    expect(rowStatusOf(9, batch)).toEqual({ kind: 'notSelected' });
    expect(rowStatusOf(1, batch)).toEqual({ kind: 'printed', iqcMissing: false });
    expect(rowStatusOf(2, batch)).toEqual({ kind: 'running' });
    expect(rowStatusOf(3, batch)).toEqual({ kind: 'waiting' });
    expect(rowStatusOf(4, batch)).toEqual({ kind: 'alreadyIssued' });
    expect(rowStatusOf(5, batch)).toEqual({ kind: 'stopped' });
  });

  it('자재 라벨은 나왔고 IQC 라벨만 안 나왔으면 「인쇄됨」에 그 사실을 붙인다', () => {
    const batch = snapshot({
      order: [1],
      results: new Map([[1, { ...printed(1), iqcLabel: 'failed' as const }]]),
    });

    expect(rowStatusOf(1, batch)).toEqual({ kind: 'printed', iqcMissing: true });
  });
});

describe('summarize', () => {
  it('나온 장 · 안 나온 장 · 다시 보낼 수 있는 장 · 첫 실패를 센다', () => {
    const batch = snapshot({
      order: [1, 2, 3],
      results: new Map([
        [1, printed(1)],
        [2, printFailed(2)],
      ]),
      notRun: new Set([3]),
    });

    expect(summarize(batch)).toEqual({
      total: 3,
      printed: 1,
      unfinished: [2, 3],
      retryable: [2, 3],
      headline: 'printFailed',
    });
  });

  it('⛔ 종이가 이미 나온 장(보고만 실패)은 다시 보낼 장에 넣지 않는다', () => {
    const batch = snapshot({
      order: [1],
      results: new Map([[1, result({ failedAt: 'report', hasPrintedLabel: true })]]),
    });

    expect(summarize(batch)).toMatchObject({
      unfinished: [1],
      retryable: [],
      headline: 'reportFailedAfterPrint',
    });
  });

  it('실패 없이 멈췄으면 「멈춤」을 말한다', () => {
    expect(summarize(snapshot({ order: [1], notRun: new Set([1]) })).headline).toBe('stopped');
  });
});

describe('retryCommands', () => {
  const base = { printerName: null, shellPrinterName: null };
  const describeRow = () => ({ uomCode: 'EA', supplierText: null });
  const rows = new Map([1, 2].map((id) => [id, row(id)] as const));

  it('발행 기록이 남은 장은 같은 LOT 에 「인쇄 실패」 사유로, 기록 전 장은 사유 없이 확인을 달아 보낸다', () => {
    const results = new Map([[1, printFailed(1)]]);
    const { commands, needsReason } = retryCommands(
      [1, 2],
      rows,
      results,
      base,
      describeRow,
      'PRINT_FAILURE',
    );

    expect(needsReason).toEqual([]);
    expect(commands[0]).toMatchObject({
      row: { inboundReceiptLineId: 1, lotId: 9001 },
      reissueReasonCode: 'PRINT_FAILURE',
    });
    expect(commands[0]?.verify).toBeUndefined();
    expect(commands[1]).toMatchObject({ reissueReasonCode: null, verify: 'unissued' });
  });

  it('사유 목록에 「인쇄 실패」가 없으면 기록이 남은 장은 보내지 않고 따로 센다', () => {
    const results = new Map([[1, printFailed(1)]]);
    const { commands, needsReason } = retryCommands([1, 2], rows, results, base, describeRow, null);

    expect(commands.map((command) => command.row.inboundReceiptLineId)).toEqual([2]);
    expect(needsReason).toEqual([1]);
  });
});

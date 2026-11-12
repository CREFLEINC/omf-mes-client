import { describe, expect, it } from 'vitest';

import { retryCommands, rowStatusOf, summarize, type BatchSnapshot } from './batch-view';
import type { IssueRunResult } from './mutations';
import { labelLot } from './test-lots';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const result = (over: Partial<IssueRunResult>): IssueRunResult => ({
  lotId: 1,
  isPrinted: false,
  failedAt: null,
  hasPrintedLabel: false,
  issue: null,
  error: null,
  iqcLabel: null,
  ...over,
});

const printed = (lotId: number): IssueRunResult => result({ lotId, isPrinted: true });

const printFailed = (lotId: number): IssueRunResult =>
  result({
    lotId,
    failedAt: 'print',
    issue: { documentIssueLogId: 1, issueSeq: 1, lotNo: null, printOutcome: 'PENDING' },
  });

const snapshot = (over: Partial<BatchSnapshot>): BatchSnapshot => ({
  order: [],
  results: new Map(),
  skipped: new Set(),
  notRun: new Set(),
  currentLotId: null,
  ...over,
});

describe('rowStatusOf', () => {
  it('보내지 않은 줄 · 보내는 줄 · 기다리는 줄 · 끝난 줄을 가른다', () => {
    const batch = snapshot({
      order: [1, 2, 3, 4, 5],
      currentLotId: 2,
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
  const base = { printerName: null, shellPrinterName: null, plantId: 8301 };
  const lots = new Map([1, 2].map((id) => [id, labelLot(id)] as const));

  it('발행 기록이 남은 장은 같은 LOT 에 「인쇄 실패」 사유로, 기록 전 장은 사유 없이 확인을 달아 보낸다', () => {
    const results = new Map([[1, printFailed(1)]]);
    const { commands, needsReason } = retryCommands([1, 2], lots, results, base, 'PRINT_FAILURE');

    expect(needsReason).toEqual([]);
    expect(commands[0]).toMatchObject({ lot: { lotId: 1 }, reissueReasonCode: 'PRINT_FAILURE' });
    expect(commands[0]?.verifyUnissued).toBeUndefined();
    expect(commands[1]).toMatchObject({
      lot: { lotId: 2 },
      reissueReasonCode: null,
      verifyUnissued: true,
      plantId: 8301,
    });
  });

  it('사유 목록에 「인쇄 실패」가 없으면 기록이 남은 장은 보내지 않고 따로 센다', () => {
    const results = new Map([[1, printFailed(1)]]);
    const { commands, needsReason } = retryCommands([1, 2], lots, results, base, null);

    expect(commands.map((command) => command.lot.lotId)).toEqual([2]);
    expect(needsReason).toEqual([1]);
  });

  it('이미 출력한 적이 있는 LOT(다시 인쇄)은 첫 발행으로 보내지 않는다', () => {
    const reprinted = new Map([
      [3, labelLot(3, { lastIssue: { issueSeq: 1, issuedAt: '2026-11-11T01:12:00Z' } })],
    ]);
    const { commands } = retryCommands([3], reprinted, new Map(), base, 'PRINT_FAILURE');

    expect(commands[0]).toMatchObject({ reissueReasonCode: 'PRINT_FAILURE' });
  });
});

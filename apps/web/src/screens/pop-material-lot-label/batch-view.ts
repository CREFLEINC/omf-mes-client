import { toIssueFailure, type IssueFailure } from './failure';
import type { BatchIssueHandle, IssueCommand, IssueRunResult } from './mutations';
import type { LabelLot } from './types';

/**
 * 일괄 발행이 남긴 것을 **줄마다 · 동작 바 한 줄로** 읽는다 — 화면이 그리기만 하게 판정을 여기 모은다.
 */
export type RowStatus =
  | { kind: 'notSelected' }
  | { kind: 'waiting' }
  | { kind: 'running' }
  | { kind: 'printed'; iqcMissing: boolean }
  | { kind: 'failed'; failure: IssueFailure }
  | { kind: 'stopped' }
  | { kind: 'alreadyIssued' };

export type BatchSnapshot = Pick<
  BatchIssueHandle,
  'order' | 'results' | 'skipped' | 'notRun' | 'currentLotId'
>;

export const rowStatusOf = (lotId: number, batch: BatchSnapshot): RowStatus => {
  if (!batch.order.includes(lotId)) return { kind: 'notSelected' };
  if (batch.currentLotId === lotId) return { kind: 'running' };
  if (batch.skipped.has(lotId)) return { kind: 'alreadyIssued' };
  if (batch.notRun.has(lotId)) return { kind: 'stopped' };

  const result = batch.results.get(lotId);

  if (result === undefined) return { kind: 'waiting' };
  if (result.isPrinted) {
    /* 자재 라벨은 나왔다 — IQC 라벨만 빠졌으면 따로 말한다(「실패」로 읽히면 자재 라벨을 한 장 더 찍는다). */
    return { kind: 'printed', iqcMissing: result.iqcLabel === 'failed' };
  }

  return { kind: 'failed', failure: toIssueFailure(result) ?? 'other' };
};

/**
 * 다시 보내서 풀릴 수 있는 실패인가.
 *
 * ⛔ 권한 없음 · 발행할 수 없는 LOT 은 다시 보내도 같은 답이다. 「인쇄됐는데 기록만 못
 *    남김」은 종이가 이미 나왔다 — 다시 찍으면 같은 LOT 의 라벨이 두 장 돈다.
 */
const RETRYABLE: ReadonlySet<IssueFailure> = new Set(['printFailed', 'other']);

export interface BatchSummary {
  /** 이번 묶음에 넣은 장수. */
  total: number;
  printed: number;
  /** 아직 나오지 않은 장(실패 · 멈춤). 이미 발행된 줄은 세지 않는다. */
  unfinished: number[];
  /** 「다시 발행」으로 이어갈 수 있는 장. */
  retryable: number[];
  /** 동작 바가 말할 첫 실패 — 멈췄으면 `stopped`. 모두 나왔으면 `null`. */
  headline: IssueFailure | 'stopped' | null;
}

export const summarize = (batch: BatchSnapshot): BatchSummary => {
  const unfinished: number[] = [];
  const retryable: number[] = [];
  let printed = 0;
  let headline: BatchSummary['headline'] = null;

  for (const lotId of batch.order) {
    const status = rowStatusOf(lotId, batch);

    if (status.kind === 'printed') {
      printed += 1;
    } else if (status.kind === 'failed') {
      unfinished.push(lotId);
      if (RETRYABLE.has(status.failure)) retryable.push(lotId);
      headline ??= status.failure;
    } else if (status.kind === 'stopped') {
      unfinished.push(lotId);
      retryable.push(lotId);
    }
  }

  if (headline === null && unfinished.length > 0) headline = 'stopped';

  return { total: batch.order.length, printed, unfinished, retryable, headline };
};

/**
 * 「다시 발행」으로 보낼 명령.
 *
 * ⭐ **발행 기록이 이미 남은 장**(인쇄만 실패)은 2회차라 사유가 필수다 — 「인쇄 실패」를 싣는다. 받은 사유
 *    목록에 그 값이 없으면(`printFailureCode` 가 `null`) 그 장은 여기서 보내지 않고 다시 인쇄 보기로 넘긴다.
 * ⭐ 기록 전에 멈춘 장은 첫 발행이다 — 사유 없이, 보내기 직전 확인(`verifyUnissued`)을 단다.
 */
export const retryCommands = (
  lotIds: readonly number[],
  lots: ReadonlyMap<number, LabelLot>,
  results: ReadonlyMap<number, IssueRunResult>,
  base: Pick<IssueCommand, 'printerName' | 'shellPrinterName' | 'plantId'>,
  printFailureCode: string | null,
): { commands: IssueCommand[]; needsReason: number[] } => {
  const commands: IssueCommand[] = [];
  const needsReason: number[] = [];

  for (const lotId of lotIds) {
    const lot = lots.get(lotId);

    if (lot === undefined) continue;

    const previous = results.get(lotId);
    const isReissue =
      (previous?.issue !== null && previous?.issue !== undefined) || lot.lastIssue !== null;

    if (isReissue && printFailureCode === null) {
      needsReason.push(lotId);
      continue;
    }

    commands.push({
      ...base,
      lot,
      reissueReasonCode: isReissue ? printFailureCode : null,
      lotStatusCode: null,
      ...(isReissue ? {} : { verifyUnissued: true }),
    });
  }

  return { commands, needsReason };
};

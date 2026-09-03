import type { components } from '@omf-mes/api-client';

import { DOCUMENT_TARGET_TYPE_CODE } from './codes';

/**
 * P-02-07 LOT 라벨 출력 화면 슬라이스의 계약.
 *
 * ⭐ **대상(LOT)과 발행 기록(발행 현황)이 다른 자원이다.** 둘을 한 타입으로 뭉치면 「LOT 은
 * 있고 발행 기록은 없는」 정상 상태 — 이 화면이 가장 먼저 보여야 하는 «미출력» — 을 표현할
 * 수 없다(스펙 §3).
 */
export type Lot = components['schemas']['Lot'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type Printer = components['schemas']['Printer'];
export type DocumentIssueBatchResult = components['schemas']['DocumentIssueBatchResponse'];
export type Item = components['schemas']['Item'];
export type PageMeta = components['schemas']['PageMeta'];

export type PrinterStatus = Printer['status'];

/**
 * 발행 현황을 한 번에 물을 수 있는 대상 수의 상한. **발행 상한과 같은 값이다**(계약 명시).
 *
 * 넘기면 서버가 400 으로 되돌리므로, 목록이 그보다 길면 물을 대상을 잘라 보낸다.
 */
export const MAX_SUMMARY_TARGETS = 1000;

/**
 * 목록 한 줄.
 *
 * ⚠ **`statusLabel`·`goodQty` 가 없다.** 스펙 §3 은 행마다 「완료 / 미달」과 양품 수를 그리는데,
 * 목록 조회(`GET /trace/lots`)가 생산 진척을 함께 내리지 않는다 — `progress` 는 상세 조회의
 * `withProgress` 질의로만 채워진다. 그래서 **이 타입에 그 두 자리를 두지 않는다.**
 *
 * ⛔ **행마다 상세를 따로 부르지 않는다.** 설계가 정한 방식이 아니고, 목록이 길면 요청이 그만큼
 * 늘어난다. 화면은 열을 비우고 사유를 말한다(전례 `P-02-05` 와 같은 처리).
 *
 * ⛔ **`completedAt` 이 있다고 「완료」로, 없다고 「미달」로 적지 않는다.** 미달 마감도 완료
 * 처리된 것이라 `completedAt` 이 채워진다 — 둘을 가르는 것은 `progress.completionJudgmentCode`
 * 이고 그 값이 목록에 없다.
 */
export interface LotRow {
  lotId: number;
  lotNo: string;
  /**
   * 이 LOT 에 이 종류의 라벨이 몇 번 발행됐는가. **`null` 은 「0」이 아니라 「모른다」다** —
   * 발행 현황 조회가 실패했을 때 미출력으로 보이면 이미 찍은 라벨을 다시 찍게 된다.
   */
  issueCount: number | null;
}

/**
 * 발행 현황을 LOT 별로 꺼낼 수 있게 편다.
 *
 * ⛔ **`targetTypeCode` 로 먼저 거른다.** 같은 `targetId` 라도 유형이 다르면 다른 것을 가리킨다
 * (스펙 §5-2 — 인식표는 개체를 가리킨다). 서버에 유형을 주고 물었더라도 응답을 그대로 믿고
 * 세지 않는다 — 세는 자리가 한 곳이면 그 한 곳에서 확인한다.
 */
export const toIssueCountByLotId = (
  summaries: readonly DocumentIssueSummary[],
): Map<number, number> => {
  const counts = new Map<number, number>();

  for (const summary of summaries) {
    if (summary.targetTypeCode !== DOCUMENT_TARGET_TYPE_CODE) continue;

    counts.set(summary.targetId, summary.issueCount);
  }

  return counts;
};

/**
 * 목록 줄을 만든다.
 *
 * `counts` 가 `null` 이면 **발행 현황을 확인하지 못한 것**이다 — 전 줄의 회차가 「모른다」가
 * 된다. 한 줄만 비는 경우(현황에 그 대상이 빠진 경우)는 서버가 `issueCount: 0` 으로 함께
 * 돌려주므로(계약 명시) 일어나지 않지만, 일어나더라도 「모른다」로 남긴다.
 */
export const toLotRows = (lots: readonly Lot[], counts: Map<number, number> | null): LotRow[] =>
  lots.map((lot) => ({
    lotId: lot.lotId,
    lotNo: lot.lotNo,
    issueCount: counts?.get(lot.lotId) ?? null,
  }));

/** 화면 머리에 보일 프린터 한 대. 기본 프린터가 있으면 그것, 없으면 첫 줄. */
export const toHeadPrinter = (printers: readonly Printer[]): Printer | null =>
  printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;

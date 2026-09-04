import type { DocumentIssueSummary, GoodsIssueLine } from './types';

/**
 * 목록 한 줄이 아는 것 — 출고 라인과 그 라인의 발행 현황을 합친 값이다.
 *
 * ⭐ **「모른다」를 「발행 안 함」으로 접지 않는다.** 요약 조회가 실패했거나 아직 오지 않은
 * 라인은 발행 횟수를 말할 수 없고, 그 상태로 「미발행」이라 적으면 **이미 라벨이 도는 대상을
 * 처음 찍는 것처럼 보이게 한다.** 계약이 발행한 적 없는 대상까지 `issueCount: 0` 으로 돌려주는
 * 것도 같은 이유다.
 */
export type IssueStatus =
  { kind: 'unknown' } | { kind: 'notIssued' } | { kind: 'issued'; count: number };

export interface LineRow {
  line: GoodsIssueLine;
  status: IssueStatus;
}

const toStatus = (summary: DocumentIssueSummary | undefined): IssueStatus => {
  if (summary === undefined) return { kind: 'unknown' };

  return summary.issueCount === 0
    ? { kind: 'notIssued' }
    : { kind: 'issued', count: summary.issueCount };
};

/**
 * 라인과 발행 요약을 합친다. **라인이 기준이다** — 요약에만 있는 대상은 이 전표의 것이 아니다.
 */
export const toLineRows = (
  lines: readonly GoodsIssueLine[],
  summaries: readonly DocumentIssueSummary[],
): LineRow[] => {
  const byTargetId = new Map(summaries.map((summary) => [summary.targetId, summary]));

  return lines.map((line) => ({
    line,
    status: toStatus(byTargetId.get(line.goodsIssueLineId)),
  }));
};

/** 목록의 행 식별자. 선택 상태가 이 값으로 붙는다. */
export const rowId = (line: GoodsIssueLine): string => String(line.goodsIssueLineId);

/**
 * 고른 라인 중 **하나라도 이미 발행된 것이 있는가.** 있으면 이번 발행은 재발행이고 사유가
 * 필수다(계약: 대상 중 하나라도 발행된 것이 있으면 사유가 없을 때 422).
 *
 * ⚠ **「모른다」는 재발행으로 세지 않는다.** 모르는 것을 재발행으로 접으면 최초 발행에도 사유를
 * 요구하게 되고, 사용자는 고를 이유가 없는 값을 고르게 된다. 회차는 어차피 서버가 매긴다.
 */
export const hasIssuedTarget = (
  rows: readonly LineRow[],
  selectedIds: readonly string[],
): boolean =>
  rows.some((row) => selectedIds.includes(rowId(row.line)) && row.status.kind === 'issued');

/**
 * 고른 라인 중 **발행 현황을 확인하지 못한 것이 있는가.**
 *
 * ⚠ **모르는 것을 「처음 발행」으로 접으면 빠져나올 길이 사라진다.** 요약 조회가 실패한 라인이
 * 실은 이미 발행된 것이면 서버가 사유 없는 발행을 거부하는데, 사유 칸이 서 있지 않으면 사용자는
 * **사유를 줄 방법이 없는 채로 같은 거부만 반복해서 본다.**
 *
 * 그래서 이때는 사유 칸을 **열되 요구하지는 않는다** — 재발행인지 아닌지를 화면이 단정하지
 * 않는다. 판정은 서버가 하고, 거부가 오면 그 자리에 사유를 넣어 다시 보낼 수 있다.
 */
export const hasUnknownTarget = (
  rows: readonly LineRow[],
  selectedIds: readonly string[],
): boolean =>
  rows.some((row) => selectedIds.includes(rowId(row.line)) && row.status.kind === 'unknown');

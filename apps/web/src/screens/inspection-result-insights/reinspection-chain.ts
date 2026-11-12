import { cycleLabelOf } from './cycle-label';
import type { InspectionResult } from './queries';

export interface InspectionResultTreeRow {
  result: InspectionResult;
  depth: number;
  /** 005 D-18 — 확정 주기가 있는 행(입하 LOT IQC)의 「처음」·「재검 n차」. 없으면 `null` 이고 사슬 깊이로 보인다. */
  cycleLabel: string | null;
}

/**
 * 서버가 보장한 뿌리 기준 페이지와 사슬 내부 회차 순서를 화면용 깊이로 옮긴다.
 * 부모가 같은 페이지의 앞쪽에 없으면 계약 밖 응답이므로 임의 계층을 만들지 않고 뿌리로 둔다.
 * 확정 주기(`confirmCycle`)가 있는 행은 사슬이 없으므로(재검은 같은 요청의 다음 주기) 들여 쓰지 않는다.
 */
export const toInspectionResultTreeRows = (
  results: readonly InspectionResult[],
): InspectionResultTreeRow[] => {
  const nodes = new Map<
    number,
    { depth: number; inspectionRequestId: number; inspectionRound: number; valid: boolean }
  >();

  return results.map((result) => {
    const parent =
      result.previousResultId === undefined ? undefined : nodes.get(result.previousResultId);
    const validParent =
      parent !== undefined &&
      parent.valid &&
      parent.inspectionRequestId === result.inspectionRequestId &&
      parent.inspectionRound < result.inspectionRound;
    const valid = result.previousResultId === undefined || validParent;
    const depth = validParent ? parent.depth + 1 : 0;
    nodes.set(result.inspectionResultId, {
      depth,
      inspectionRequestId: result.inspectionRequestId,
      inspectionRound: result.inspectionRound,
      valid,
    });
    const cycleLabel = cycleLabelOf(result);
    return { result, depth: cycleLabel === null ? depth : 0, cycleLabel };
  });
};

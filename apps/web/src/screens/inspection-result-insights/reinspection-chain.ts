import type { InspectionResult } from './queries';

export interface InspectionResultTreeRow {
  result: InspectionResult;
  depth: number;
}

/**
 * 서버가 보장한 뿌리 기준 페이지와 사슬 내부 회차 순서를 화면용 깊이로 옮긴다.
 * 부모가 같은 페이지의 앞쪽에 없으면 계약 밖 응답이므로 임의 계층을 만들지 않고 뿌리로 둔다.
 */
export const toInspectionResultTreeRows = (
  results: readonly InspectionResult[],
): InspectionResultTreeRow[] => {
  const depths = new Map<number, number>();

  return results.map((result) => {
    const parentDepth =
      result.previousResultId === undefined ? undefined : depths.get(result.previousResultId);
    const depth = parentDepth === undefined ? 0 : parentDepth + 1;
    depths.set(result.inspectionResultId, depth);
    return { result, depth };
  });
};

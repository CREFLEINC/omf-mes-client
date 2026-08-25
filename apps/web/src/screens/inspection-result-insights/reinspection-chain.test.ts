import { describe, expect, it } from 'vitest';

import type { InspectionResult } from './queries';
import { toInspectionResultTreeRows } from './reinspection-chain';

const result = (
  inspectionResultId: number,
  previousResultId?: number,
  overrides: Partial<InspectionResult> = {},
): InspectionResult => ({
  inspectionResultId,
  inspectionResultNo: `RESULT-${String(inspectionResultId)}`,
  inspectionRequestId: 100,
  inspectionRound: inspectionResultId,
  inspectedQty: 1,
  acceptedQty: 1,
  rejectedQty: 0,
  heldQty: 0,
  uomId: 1,
  overallJudgmentCode: 'ACCEPTED',
  inspectorId: 1,
  inspectedAt: '2026-08-01T09:00:00+09:00',
  statusCode: 'CONFIRMED',
  ...(previousResultId === undefined ? {} : { previousResultId }),
  ...overrides,
});

describe('재검 사슬 표시 깊이', () => {
  it('같은 페이지의 앞선 부모를 따라 회차 깊이를 만든다', () => {
    expect(
      toInspectionResultTreeRows([result(1), result(2, 1), result(3, 2), result(4)]).map(
        ({ result: row, depth }) => [row.inspectionResultId, depth],
      ),
    ).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 0],
    ]);
  });

  it('부모가 앞쪽에 없는 계약 밖 응답은 다른 사슬에 붙이지 않는다', () => {
    expect(toInspectionResultTreeRows([result(2, 1), result(1)]).map(({ depth }) => depth)).toEqual(
      [0, 0],
    );
  });

  it.each([
    {
      name: '순환 참조',
      rows: [result(1, 2), result(2, 1)],
    },
    {
      name: '회차 역전',
      rows: [result(1, undefined, { inspectionRound: 2 }), result(2, 1, { inspectionRound: 1 })],
    },
    {
      name: '다른 검사 의뢰 참조',
      rows: [result(1), result(2, 1, { inspectionRequestId: 200 })],
    },
  ])('$name 계약 위반은 임의 계층을 만들지 않는다', ({ rows }) => {
    expect(toInspectionResultTreeRows(rows).map(({ depth }) => depth)).toEqual([0, 0]);
  });
});

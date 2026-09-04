import { describe, expect, it } from 'vitest';

import { hasIssuedTarget, rowId, toLineRows } from './line-rows';
import type { DocumentIssueSummary, GoodsIssueLine } from './types';

const line = (goodsIssueLineId: number): GoodsIssueLine => ({
  goodsIssueLineId,
  goodsIssueId: 900,
  lineNo: goodsIssueLineId,
  itemId: 10,
  lotId: 20,
  issueQty: 100,
  uomId: 30,
  sourceLocationId: 40,
});

const summary = (targetId: number, issueCount: number): DocumentIssueSummary => ({
  targetTypeCode: 'GOODS_ISSUE_LINE',
  targetId,
  issueCount,
});

describe('toLineRows', () => {
  it('요약이 없는 라인은 「모른다」로 둔다 — 미발행으로 접지 않는다', () => {
    const rows = toLineRows([line(1), line(2)], [summary(1, 0)]);

    expect(rows[0]?.status).toEqual({ kind: 'notIssued' });
    expect(rows[1]?.status).toEqual({ kind: 'unknown' });
  });

  it('발행 횟수를 그대로 싣는다', () => {
    const rows = toLineRows([line(1)], [summary(1, 2)]);

    expect(rows[0]?.status).toEqual({ kind: 'issued', count: 2 });
  });

  it('라인에 없는 요약은 버린다 — 라인이 기준이다', () => {
    const rows = toLineRows([line(1)], [summary(1, 1), summary(99, 5)]);

    expect(rows).toHaveLength(1);
  });
});

describe('hasIssuedTarget', () => {
  const rows = toLineRows([line(1), line(2), line(3)], [summary(1, 0), summary(2, 3)]);

  it('고른 것 중 발행된 것이 있으면 재발행이다', () => {
    expect(hasIssuedTarget(rows, [rowId(line(2))])).toBe(true);
  });

  it('고르지 않은 라인이 발행됐어도 재발행이 아니다', () => {
    expect(hasIssuedTarget(rows, [rowId(line(1))])).toBe(false);
  });

  it('「모른다」는 재발행으로 세지 않는다', () => {
    expect(hasIssuedTarget(rows, [rowId(line(3))])).toBe(false);
  });

  it('아무것도 고르지 않으면 재발행이 아니다', () => {
    expect(hasIssuedTarget(rows, [])).toBe(false);
  });
});

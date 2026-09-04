import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { lotFixture, shipmentFixture } from './fixtures';
import {
  activeLines,
  addLineSource,
  removeLine,
  setLineQty,
  toLineDrafts,
  totalQty,
  validateLines,
} from './line-draft';
import { toLotLineSource, toReturnLineSources } from './types';

const t = messages.returnReceipt.lines;
const drafts = () => toLineDrafts(toReturnLineSources(shipmentFixture()));

describe('반품 라인 초안', () => {
  it('배분에서 온 줄은 수량이 비어 있다 — 전량 반품이 기본이 아니다', () => {
    expect(drafts().map((draft) => draft.qtyText)).toEqual(['', '']);
  });

  it('빈 줄과 0 은 오류가 아니고 보내지도 않는다', () => {
    const lines = setLineQty(drafts(), 'alloc:9922', '0');

    expect(validateLines(lines)).toEqual({});
    expect(activeLines(lines)).toEqual([]);
  });

  it('숫자 아님 · 음수 · 출하 수량 초과를 줄마다 다른 말로 막는다', () => {
    let lines = setLineQty(drafts(), 'alloc:9921', 'x');
    expect(validateLines(lines)['alloc:9921']).toBe(t.qtyNotNumber);

    lines = setLineQty(drafts(), 'alloc:9921', '-1');
    expect(validateLines(lines)['alloc:9921']).toBe(t.qtyTooSmall);

    lines = setLineQty(drafts(), 'alloc:9921', '181');
    expect(validateLines(lines)['alloc:9921']).toBe(t.qtyExceeds('180'));
  });

  it('상한이 없는 직접 입력 줄은 큰 수도 받는다', () => {
    const added = addLineSource([], toLotLineSource(lotFixture()));
    const lines = setLineQty(added.drafts, 'lot:8309', '10000');

    expect(validateLines(lines)).toEqual({});
    expect(activeLines(lines)).toEqual([{ source: added.drafts[0]?.source, qty: 10000 }]);
  });

  it('보낼 줄만 골라 합을 낸다 — 단위가 하나일 때만', () => {
    const lines = setLineQty(setLineQty(drafts(), 'alloc:9921', '120'), 'alloc:9922', '30');
    const active = activeLines(lines);

    expect(active.map((line) => line.qty)).toEqual([120, 30]);
    expect(totalQty(active)).toEqual({ qty: 150, uomId: 7001 });
    expect(totalQty([])).toBeNull();
  });

  it('같은 LOT 은 두 번 더하지 않고 그 줄을 알려 준다', () => {
    const first = addLineSource([], toLotLineSource(lotFixture()));
    const again = addLineSource(first.drafts, toLotLineSource(lotFixture()));

    expect(again.duplicate).not.toBeNull();
    expect(again.drafts).toHaveLength(1);
    expect(removeLine(again.drafts, 'lot:8309')).toEqual([]);
  });
});

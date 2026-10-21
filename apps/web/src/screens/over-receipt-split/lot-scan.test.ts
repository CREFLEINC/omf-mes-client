import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { LABEL_9301, LABEL_9301_SECOND, purchaseOrderLineFixtures } from './fixtures';
import { createDrafts, readDraft, setDraftQty } from './line-draft';
import { applyLotScan } from './lot-scan';

const t = messages.overReceiptSplit;

/** 9301 → SAMPLE-ITEM-01(9401·9403 두 줄) · 9302 → SAMPLE-ITEM-02. */
const codeOf = (itemId: number): string | null =>
  itemId === 9301 ? 'SAMPLE-ITEM-01' : itemId === 9302 ? 'SAMPLE-ITEM-02' : null;

const LINES = purchaseOrderLineFixtures;
const EMPTY = createDrafts(LINES);

describe('applyLotScan — 라벨로 줄을 찾아 채운다', () => {
  it('첫 라벨은 그 품목의 첫 줄 정량분 LOT 과 수량이 된다', () => {
    const result = applyLotScan(LABEL_9301, LINES, EMPTY, codeOf);

    expect(result.applied).toBe(true);
    expect(readDraft(result.drafts, 9401)).toEqual({
      qtyText: '66',
      lot: { lotNo: LABEL_9301, labelMissing: false, reasonCode: '' },
      excessLot: { lotNo: '', labelMissing: false, reasonCode: '' },
    });
    expect(result.note).toBe(t.scan.added(1, '66', 'normal'));
  });

  it('수량을 먼저 쳐 둔 줄은 수량을 두고 LOT 만 담는다', () => {
    const result = applyLotScan(LABEL_9301, LINES, setDraftQty(EMPTY, 9401, '50'), codeOf);

    expect(readDraft(result.drafts, 9401).qtyText).toBe('50');
    expect(readDraft(result.drafts, 9401).lot.lotNo).toBe(LABEL_9301);
  });

  /* 같은 품목의 둘째 줄(9403)이 비어 있으면 거기부터 — 정량분 LOT 이 빈 첫 줄을 고른다. */
  it('같은 품목의 둘째 라벨은 정량분이 빈 다음 줄로 간다', () => {
    const first = applyLotScan(LABEL_9301, LINES, EMPTY, codeOf);
    const second = applyLotScan(LABEL_9301_SECOND, LINES, first.drafts, codeOf);

    expect(readDraft(second.drafts, 9403).lot.lotNo).toBe(LABEL_9301_SECOND);
    expect(readDraft(second.drafts, 9403).qtyText).toBe('10');
    expect(second.note).toBe(t.scan.added(3, '10', 'normal'));
  });

  it('정량분이 다 찼으면 초과분 LOT 으로 가고 수량을 더한다', () => {
    const lines = LINES.filter((line) => line.purchaseOrderLineId !== 9403);
    const first = applyLotScan(LABEL_9301, lines, createDrafts(lines), codeOf);
    const second = applyLotScan(LABEL_9301_SECOND, lines, first.drafts, codeOf);

    expect(second.applied).toBe(true);
    expect(readDraft(second.drafts, 9401).qtyText).toBe('76');
    expect(readDraft(second.drafts, 9401).excessLot.lotNo).toBe(LABEL_9301_SECOND);
    expect(second.note).toBe(t.scan.added(1, '10', 'excess'));
  });

  it('둘 다 찼으면 담지 않고 그 사실을 말한다', () => {
    const lines = LINES.filter((line) => line.purchaseOrderLineId !== 9403);
    const one = applyLotScan(LABEL_9301, lines, createDrafts(lines), codeOf);
    const two = applyLotScan(LABEL_9301_SECOND, lines, one.drafts, codeOf);
    const three = applyLotScan(
      'SAMPLE-ITEM-01|5|260806|SAMPLE-SUP-01|0003',
      lines,
      two.drafts,
      codeOf,
    );

    expect(three.applied).toBe(false);
    expect(three.drafts).toBe(two.drafts);
    expect(three.note).toBe(t.scan.bothFilled(1));
  });

  it('라벨 형식이 아니면 담지 않는다', () => {
    const result = applyLotScan('not-a-label', LINES, EMPTY, codeOf);

    expect(result.applied).toBe(false);
    expect(result.note).toBe(t.scan.invalid);
  });

  it('이 발주에 없는 품목이면 그 코드를 말한다', () => {
    const result = applyLotScan('ZZZ-9|1|260806|SAMPLE-SUP-01|0001', LINES, EMPTY, codeOf);

    expect(result.applied).toBe(false);
    expect(result.note).toBe(t.scan.notFound('ZZZ-9'));
  });

  it('품목 정보를 아직 못 받았으면 기다리라고 말한다', () => {
    const result = applyLotScan(LABEL_9301, LINES, EMPTY, () => null);

    expect(result.applied).toBe(false);
    expect(result.note).toBe(t.scan.itemsPending);
  });
});

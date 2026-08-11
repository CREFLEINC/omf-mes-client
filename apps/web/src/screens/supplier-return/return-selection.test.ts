import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { goodsReceiptLine, goodsReceiptLineFixtures } from './fixtures';
import { EMPTY_LINE_DRAFT, setDraftQty, toggleLineSelection, type LineDraft } from './line-draft';
import type { BalanceSource, ItemBalance } from './on-hand';
import { describeReturnSelection, toReturnLineRows } from './return-selection';
import type { BalanceView } from './types';

const t = messages.supplierReturn;

const itemBalance = (overrides: Partial<ItemBalance> = {}): ItemBalance => ({
  itemId: 9301,
  entries: [],
  isLoading: false,
  isError: false,
  truncated: false,
  ...overrides,
});

const entry = (overrides: Partial<BalanceView> = {}): BalanceView => ({
  lotId: 9601,
  onHandQty: 80,
  uomId: 9501,
  ...overrides,
});

const balanceSource = (items: ItemBalance[] = []): BalanceSource => ({
  items,
  isError: items.some((item) => item.isError),
  truncated: items.some((item) => item.truncated),
});

/** 품목 9301 · LOT 9601에 보유 80이 있는 정상 상태. */
const withOnHand = (onHandQty = 80): BalanceSource =>
  balanceSource([itemBalance({ entries: [entry({ onHandQty })] })]);

const LINE = goodsReceiptLine();
const LINES = [LINE];

const pick = (draft: LineDraft, lineId: number, text: string): LineDraft =>
  setDraftQty(toggleLineSelection(draft, lineId), lineId, text);

describe('toReturnLineRows — 줄마다의 판정을 한 번에 만든다', () => {
  it('표시 순번이 1부터 차례로 붙는다', () => {
    const rows = toReturnLineRows(goodsReceiptLineFixtures, EMPTY_LINE_DRAFT, balanceSource());

    expect(rows.map((row) => row.ordinal)).toEqual([1, 2, 3]);
  });

  it('빈 초안에서는 어느 줄도 골라져 있지 않고 수량 칸이 비어 있다', () => {
    const rows = toReturnLineRows(LINES, EMPTY_LINE_DRAFT, balanceSource());

    expect(rows[0]?.isSelected).toBe(false);
    expect(rows[0]?.qtyText).toBe('');
    expect(rows[0]?.qty).toEqual({ kind: 'empty' });
    expect(rows[0]?.error).toBeUndefined();
  });

  it('고른 줄과 친 글자를 그대로 싣는다', () => {
    const rows = toReturnLineRows(LINES, pick(EMPTY_LINE_DRAFT, 9401, '10'), withOnHand());

    expect(rows[0]?.isSelected).toBe(true);
    expect(rows[0]?.qtyText).toBe('10');
    expect(rows[0]?.qty).toEqual({ kind: 'qty', value: 10 });
  });

  it('그 줄의 보유 수량을 함께 싣는다', () => {
    const rows = toReturnLineRows(LINES, EMPTY_LINE_DRAFT, withOnHand(120));

    expect(rows[0]?.onHand).toEqual({ kind: 'known', qty: 120, uomId: 9501 });
  });

  /**
   * **고를 수 없는 줄은 골라져 있지 않은 것으로 본다**(계획 결정 8의 짝). 「다시 조회」로
   * 라인이 바뀌어 고른 줄이 고를 수 없게 되면, 그대로 두었을 때 **표에는 잠긴 줄이 골라져
   * 있는** 상태가 되고 그 줄이 요청에 실린다.
   */
  it('고를 수 없는 줄은 초안에 있어도 골라진 것으로 세지 않는다', () => {
    const blocked = goodsReceiptLine({ goodsReceiptLineId: 9403, receiptQty: 0 });
    const rows = toReturnLineRows([blocked], pick(EMPTY_LINE_DRAFT, 9403, '10'), withOnHand());

    expect(rows[0]?.select).toEqual({ kind: 'blocked', reason: t.reasons.lineQtyNotPositive });
    expect(rows[0]?.isSelected).toBe(false);
  });

  it('형식 오류를 인라인 오류로 낸다', () => {
    const rows = toReturnLineRows(LINES, pick(EMPTY_LINE_DRAFT, 9401, '0'), withOnHand());

    expect(rows[0]?.error).toBe(t.errors.qtyNotPositive);
  });

  /** **M24** — 상한 비교가 없으면 보유보다 많은 수량이 그대로 나간다. */
  it('보유 수량을 넘으면 인라인 오류를 낸다', () => {
    const rows = toReturnLineRows(LINES, pick(EMPTY_LINE_DRAFT, 9401, '81'), withOnHand(80));

    expect(rows[0]?.error).toBe(t.errors.qtyOverOnHand(80));
  });

  it('상한과 같은 값에는 오류가 없다', () => {
    const rows = toReturnLineRows(LINES, pick(EMPTY_LINE_DRAFT, 9401, '80'), withOnHand(80));

    expect(rows[0]?.error).toBeUndefined();
  });

  /** **승인 13-6** — 확인하지 못한 줄은 아무리 큰 수량이어도 화면이 막지 않는다. */
  it('상한을 확인하지 못한 줄에는 초과 오류를 내지 않는다', () => {
    const rows = toReturnLineRows(LINES, pick(EMPTY_LINE_DRAFT, 9401, '999999'), balanceSource());

    expect(rows[0]?.onHand.kind).not.toBe('known');
    expect(rows[0]?.error).toBeUndefined();
  });

  /**
   * 순서가 뜻을 정한다 — **형식 오류가 상한 초과보다 앞선다.** 「숫자가 아니다」인데
   * 「보유 수량보다 많다」를 내면 사용자가 수량을 줄여 보다가 왜 안 되는지 모른다.
   */
  it('형식 오류가 상한 초과보다 앞선다', () => {
    const rows = toReturnLineRows(LINES, pick(EMPTY_LINE_DRAFT, 9401, '열개'), withOnHand(1));

    expect(rows[0]?.error).toBe(t.errors.qtyNotNumber);
  });

  /** 고르지 않은 줄에 친 값도 그대로 재어 준다 — 고르는 순간 오류가 새로 나타나면 놀란다. */
  it('고르지 않은 줄의 오류도 함께 낸다', () => {
    const rows = toReturnLineRows(LINES, setDraftQty(EMPTY_LINE_DRAFT, 9401, '0'), withOnHand());

    expect(rows[0]?.isSelected).toBe(false);
    expect(rows[0]?.error).toBe(t.errors.qtyNotPositive);
  });
});

describe('describeReturnSelection — 「보낼 수 있는가」 판정이 한 곳이다', () => {
  const judge = (draft: LineDraft, source = withOnHand(), lines = LINES) =>
    describeReturnSelection(toReturnLineRows(lines, draft, source));

  /** **C29** — 고른 줄이 하나도 없으면 다음 단계로 갈 수 없고 그 사유가 보인다. */
  it('고른 줄이 없으면 사유와 함께 막힌다', () => {
    const view = judge(EMPTY_LINE_DRAFT);

    expect(view.count).toBe(0);
    expect(view.ready).toEqual({ kind: 'blocked', reason: t.reasons.selectNone });
  });

  it('고른 줄의 수량이 비면 사유와 함께 막힌다', () => {
    const view = judge(toggleLineSelection(EMPTY_LINE_DRAFT, 9401));

    expect(view.ready).toEqual({ kind: 'blocked', reason: t.reasons.selectQtyMissing });
  });

  it('고른 줄에 오류가 있으면 사유와 함께 막힌다', () => {
    const view = judge(pick(EMPTY_LINE_DRAFT, 9401, '0'));

    expect(view.ready).toEqual({ kind: 'blocked', reason: t.reasons.selectQtyInvalid });
  });

  it('고른 줄에 수량이 갖춰지면 갈 수 있다', () => {
    expect(judge(pick(EMPTY_LINE_DRAFT, 9401, '10')).ready).toEqual({ kind: 'ready' });
  });

  /**
   * **C25** — 고른 줄만 수량이 필수다. 고르지 않은 줄이 비어 있어도 막히지 않는다.
   * 이것이 전 줄 필수인 재고실사와 갈리는 자리다.
   */
  it('고르지 않은 줄의 빈 수량은 막지 않는다', () => {
    const lines = [LINE, goodsReceiptLine({ goodsReceiptLineId: 9402 })];
    const view = judge(pick(EMPTY_LINE_DRAFT, 9401, '10'), withOnHand(), lines);

    expect(view.count).toBe(1);
    expect(view.ready).toEqual({ kind: 'ready' });
  });

  /** 고르지 않은 줄의 오류도 막지 않는다 — 보내지 않을 값이 길을 세우면 안 된다. */
  it('고르지 않은 줄의 오류는 막지 않는다', () => {
    const lines = [LINE, goodsReceiptLine({ goodsReceiptLineId: 9402 })];
    const draft = setDraftQty(pick(EMPTY_LINE_DRAFT, 9401, '10'), 9402, '0');

    expect(judge(draft, withOnHand(), lines).ready).toEqual({ kind: 'ready' });
  });

  /** 빈 칸이 오류보다 앞선다 — 오류는 붉은 글씨로 이미 보이고 빈 칸은 멀쩡해 보인다. */
  it('빈 칸과 오류가 함께 있으면 빈 칸을 먼저 말한다', () => {
    const lines = [LINE, goodsReceiptLine({ goodsReceiptLineId: 9402 })];
    const draft = setDraftQty(
      toggleLineSelection(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9402),
      9401,
      '0',
    );

    expect(judge(draft, withOnHand(), lines).ready).toEqual({
      kind: 'blocked',
      reason: t.reasons.selectQtyMissing,
    });
  });

  it('세 사유의 문구가 서로 다르다', () => {
    expect(new Set([t.reasons.selectNone, t.reasons.selectQtyMissing, t.reasons.selectQtyInvalid]).size).toBe(3);
  });

  /**
   * **C33** — 화면에 보이는 줄 수와 합계가 **서버에 보낼 줄**에서 나온다. 화면이 따로 세면
   * 사용자가 확인한 것과 나가는 것이 갈린다.
   */
  it('고른 줄 수와 반품 수량 합계를 낸다', () => {
    const lines = [LINE, goodsReceiptLine({ goodsReceiptLineId: 9402 })];
    const draft = pick(pick(EMPTY_LINE_DRAFT, 9401, '10'), 9402, '12.5');
    const view = judge(draft, withOnHand(), lines);

    expect(view.count).toBe(2);
    expect(view.totalQty).toBe(22.5);
    expect(view.totalUomId).toBe(9501);
    expect(view.selectedRows.map((row) => row.line.goodsReceiptLineId)).toEqual([9401, 9402]);
  });

  it('합계에 고르지 않은 줄의 수량을 넣지 않는다', () => {
    const lines = [LINE, goodsReceiptLine({ goodsReceiptLineId: 9402 })];
    const draft = setDraftQty(pick(EMPTY_LINE_DRAFT, 9401, '10'), 9402, '999');

    expect(judge(draft, withOnHand(), lines).totalQty).toBe(10);
  });

  /**
   * **단위가 섞이면 합계를 내지 않는다.** 100 개와 5 상자를 더한 105는 어떤 뜻도 없다 —
   * 화면이 확인하지 않은 것을 말하지 않는다.
   */
  it('단위가 섞이면 합계를 내지 않는다', () => {
    const lines = [LINE, goodsReceiptLine({ goodsReceiptLineId: 9402, uomId: 9599 })];
    const draft = pick(pick(EMPTY_LINE_DRAFT, 9401, '10'), 9402, '5');
    const view = judge(draft, withOnHand(), lines);

    expect(view.count).toBe(2);
    expect(view.totalQty).toBeNull();
    expect(view.totalUomId).toBeNull();
  });

  it('고른 줄이 없으면 합계도 없다', () => {
    const view = judge(EMPTY_LINE_DRAFT);

    expect(view.totalQty).toBeNull();
    expect(view.totalUomId).toBeNull();
  });

  /** 「지금 표에 있는 줄」만 센다 — 사라진 줄의 초안은 어디에도 실리지 않는다(계획 결정 8). */
  it('표에서 사라진 줄은 세지 않는다', () => {
    const draft = pick(pick(EMPTY_LINE_DRAFT, 9401, '10'), 9999, '20');
    const view = judge(draft);

    expect(view.count).toBe(1);
    expect(view.totalQty).toBe(10);
  });
});

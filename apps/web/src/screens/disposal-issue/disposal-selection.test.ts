import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { describeDisposalSelection, toDisposalLineRows } from './disposal-selection';
import { EMPTY_LINE_DRAFT, setDraftQty, toggleLineSelection, type LineDraft } from './line-draft';
import type { BalanceSource } from './on-hand';
import type { BalanceView, ReceiptLineView } from './types';

const t = messages.disposalIssue;

const LINE_A = 9401;
const LINE_B = 9402;
const ITEM_A = 9301;
const ITEM_B = 9302;
const LOT_A = 9601;
const LOT_B = 9602;
const UOM = 9801;
const OTHER_UOM = 9802;

const line = (overrides: Partial<ReceiptLineView> = {}): ReceiptLineView => ({
  goodsReceiptLineId: LINE_A,
  itemId: ITEM_A,
  lotId: LOT_A,
  receiptQty: 100,
  uomId: UOM,
  destinationLocationId: 9901,
  ...overrides,
});

const LINE_TWO = line({ goodsReceiptLineId: LINE_B, itemId: ITEM_B, lotId: LOT_B });

const balanceOf = (itemId: number, lotId: number, onHandQty: number, uomId = UOM): BalanceView => ({
  groupBy: 'LOT',
  lotId,
  onHandQty,
  uomId,
});

/** 두 품목의 잔액을 넉넉히 확인해 준 자료 — 상한이 판정을 흐리지 않게 한다. */
const BALANCES: BalanceSource = {
  items: [
    {
      itemId: ITEM_A,
      entries: [balanceOf(ITEM_A, LOT_A, 500)],
      isLoading: false,
      isError: false,
      truncated: false,
    },
    {
      itemId: ITEM_B,
      entries: [balanceOf(ITEM_B, LOT_B, 500)],
      isLoading: false,
      isError: false,
      truncated: false,
    },
  ],
  isError: false,
  truncated: false,
};

const NO_BALANCES: BalanceSource = { items: [], isError: false, truncated: false };

const pick = (draft: LineDraft, lineId: number, text: string): LineDraft =>
  setDraftQty(toggleLineSelection(draft, lineId), lineId, text);

const rowsOf = (lines: readonly ReceiptLineView[], draft: LineDraft, balances = BALANCES) =>
  toDisposalLineRows(lines, draft, balances);

describe('toDisposalLineRows', () => {
  it('표시 순번을 1부터 매긴다', () => {
    expect(rowsOf([line(), LINE_TWO], EMPTY_LINE_DRAFT).map((row) => row.ordinal)).toEqual([1, 2]);
  });

  /**
   * **지금 표에 있는 줄만 만든다.** 초안에 남아 있어도 사라진 줄은 여기 나타나지 않으므로
   * 요약에도 뒤따르는 회차의 요청에도 실리지 않는다 — 「다시 조회」가 초안을 지우지 않아도
   * 되는 이유다(수명 표 14행).
   */
  it('표에 없는 줄의 초안은 나타나지 않는다', () => {
    const draft = pick(EMPTY_LINE_DRAFT, LINE_B, '7');

    expect(rowsOf([line()], draft)).toHaveLength(1);
    expect(describeDisposalSelection(rowsOf([line()], draft)).count).toBe(0);
  });

  /**
   * **고를 수 없게 된 줄은 골라져 있지 않은 것으로 본다.** 「다시 조회」로 라인이 바뀌어 고른
   * 줄이 잠기면, 그대로 두었을 때 표에는 **잠긴 줄이 골라져 있는** 상태가 된다.
   */
  it('고를 수 없는 줄은 골라진 것으로 세지 않는다', () => {
    const draft = pick(EMPTY_LINE_DRAFT, LINE_A, '5');
    const blocked = rowsOf([line({ itemId: 0 })], draft);

    expect(blocked[0]?.select.kind).toBe('blocked');
    expect(blocked[0]?.isSelected).toBe(false);
  });

  /** **형식 오류가 상한 초과보다 앞선다** — 숫자가 아닌데 「보유 수량보다 많다」를 내면 헛다리를 짚는다. */
  it('형식 오류를 상한 초과보다 먼저 낸다', () => {
    const draft = pick(EMPTY_LINE_DRAFT, LINE_A, '가나다');

    expect(rowsOf([line()], draft)[0]?.error).toBe(t.errors.qtyNotNumber);
  });

  it('상한을 넘으면 그 사유를 낸다', () => {
    const draft = pick(EMPTY_LINE_DRAFT, LINE_A, '501');

    expect(rowsOf([line()], draft)[0]?.error).toBe(t.errors.qtyOverOnHand(500));
  });

  /** **빈 칸은 오류가 아니다** — 아직 정하지 않았다는 뜻이다. */
  it('빈 칸에는 오류를 내지 않는다', () => {
    expect(rowsOf([line()], EMPTY_LINE_DRAFT)[0]?.error).toBeUndefined();
  });

  /**
   * **확인하지 못한 줄은 상한으로 막지 않는다**(계획 결정 4 · 완료 조건 C24).
   * 선택도 입력도 막히지 않는다는 것을 짝으로 굳힌다.
   */
  it('상한을 확인하지 못한 줄은 큰 수를 쳐도 막지 않고 고를 수도 있다', () => {
    const draft = pick(EMPTY_LINE_DRAFT, LINE_A, '99999');
    const [row] = rowsOf([line()], draft, NO_BALANCES);

    expect(row?.onHand.kind).toBe('loading');
    expect(row?.error).toBeUndefined();
    expect(row?.select.kind).toBe('selectable');
    expect(row?.isSelected).toBe(true);
  });
});

describe('describeDisposalSelection', () => {
  it('아무것도 고르지 않으면 막고 사유를 낸다', () => {
    const view = describeDisposalSelection(rowsOf([line(), LINE_TWO], EMPTY_LINE_DRAFT));

    expect(view.count).toBe(0);
    expect(view.totalQty).toBeNull();
    expect(view.ready).toEqual({ kind: 'blocked', reason: t.reasons.selectNone });
  });

  it('고른 줄의 수량을 더한다', () => {
    const draft = pick(pick(EMPTY_LINE_DRAFT, LINE_A, '5'), LINE_B, '7.5');
    const view = describeDisposalSelection(rowsOf([line(), LINE_TWO], draft));

    expect(view.count).toBe(2);
    expect(view.totalQty).toBe(12.5);
    expect(view.totalUomId).toBe(UOM);
    expect(view.ready).toEqual({ kind: 'ready' });
  });

  /**
   * **고르지 않은 줄의 수량은 합계에 들어가지 않는다**(완료 조건 C27 · 감지기 M28).
   * 초안 전체를 더하면 선택을 푼 줄의 수량이 조용히 요약에 남는다.
   */
  it('고르지 않은 줄의 수량은 합계에 들어가지 않는다', () => {
    const draft = setDraftQty(pick(EMPTY_LINE_DRAFT, LINE_A, '5'), LINE_B, '999');
    const view = describeDisposalSelection(rowsOf([line(), LINE_TWO], draft));

    expect(view.count).toBe(1);
    expect(view.totalQty).toBe(5);
  });

  /**
   * **단위가 섞이면 합치지 않는다**(완료 조건 C28 · 감지기 M29). 100 개와 5 상자를 더한 105는
   * 어떤 뜻도 없고, 화면이 확인하지 않은 것을 말하는 것이 된다. **줄 수는 그대로 낸다.**
   */
  it('단위가 섞이면 합계를 내지 않고 줄 수만 낸다', () => {
    const otherUom = line({ goodsReceiptLineId: LINE_B, itemId: ITEM_B, lotId: LOT_B, uomId: OTHER_UOM });
    const draft = pick(pick(EMPTY_LINE_DRAFT, LINE_A, '5'), LINE_B, '7');
    const balances: BalanceSource = {
      ...BALANCES,
      items: [
        BALANCES.items[0] as BalanceSource['items'][number],
        {
          itemId: ITEM_B,
          entries: [balanceOf(ITEM_B, LOT_B, 500, OTHER_UOM)],
          isLoading: false,
          isError: false,
          truncated: false,
        },
      ],
    };
    const view = describeDisposalSelection(rowsOf([line(), otherUom], draft, balances));

    expect(view.count).toBe(2);
    expect(view.totalQty).toBeNull();
    expect(view.totalUomId).toBeNull();
    /* 합계를 못 내는 것과 보낼 수 없는 것은 다르다 — 줄마다의 수량은 멀쩡하다. */
    expect(view.ready).toEqual({ kind: 'ready' });
  });

  /**
   * **고른 줄에 수량이 없으면 다음 단계가 성립하지 않는다**(완료 조건 C27).
   * 사유 순서가 뜻을 정한다 — **아무것도 안 골랐다 → 빈 칸 → 오류.** 빈 칸이 오류보다 앞서는
   * 이유는 오류가 이미 그 칸 아래 붉은 글씨로 서 있는 반면 **빈 칸은 멀쩡해 보이기** 때문이다.
   */
  it('고른 줄의 수량이 비면 막고 빈 칸 사유를 낸다', () => {
    const draft = toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A);
    const view = describeDisposalSelection(rowsOf([line()], draft));

    expect(view.count).toBe(1);
    expect(view.ready).toEqual({ kind: 'blocked', reason: t.reasons.selectQtyMissing });
  });

  it('빈 칸과 오류가 함께 있으면 빈 칸을 먼저 말한다', () => {
    const draft = pick(toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A), LINE_B, '0');
    const view = describeDisposalSelection(rowsOf([line(), LINE_TWO], draft));

    expect(view.ready).toEqual({ kind: 'blocked', reason: t.reasons.selectQtyMissing });
  });

  it('오류가 있는 줄이 있으면 막고 오류 사유를 낸다', () => {
    const draft = pick(EMPTY_LINE_DRAFT, LINE_A, '501');
    const view = describeDisposalSelection(rowsOf([line()], draft));

    expect(view.ready).toEqual({ kind: 'blocked', reason: t.reasons.selectQtyInvalid });
  });

  /** 보낼 줄은 **골라진 줄에서만** 나온다 — 요약도 뒤따르는 회차의 요청도 이 배열을 쓴다. */
  it('보낼 줄 목록이 골라진 줄과 같다', () => {
    const draft = pick(EMPTY_LINE_DRAFT, LINE_B, '7');
    const view = describeDisposalSelection(rowsOf([line(), LINE_TWO], draft));

    expect(view.selectedRows.map((row) => row.line.goodsReceiptLineId)).toEqual([LINE_B]);
  });
});

import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { createDrafts, setDraftQty, type LineDrafts } from './line-draft';
import { normalLimit, remainingQty, splitLineQty, toSplitLines } from './split-calc';
import type { PoLineView } from './types';

/**
 * 이 화면의 핵심 규칙 — 무엇이 정량분이고 무엇이 초과분인가.
 *
 * **가르는 자리가 여기 하나다.** 표도 (뒤따르는 PR의) 요청 조립도 이 함수의 결과를 받는다.
 * 두 곳에서 다시 계산하면 규칙이 갈려 보이는 값과 보내는 값이 달라진다.
 */

const t = messages.overReceiptSplit;

const line = (overrides: Partial<PoLineView> = {}): PoLineView => ({
  purchaseOrderLineId: 9401,
  purchaseOrderId: 9001,
  lineNo: 1,
  itemId: 9301,
  orderedQty: 100,
  uomId: 9501,
  receivedQty: 40,
  toleranceOverQty: 5,
  ...overrides,
});

const draftsFor = (lines: readonly PoLineView[], texts: Record<number, string>): LineDrafts =>
  Object.entries(texts).reduce<LineDrafts>(
    (drafts, [lineId, text]) => setDraftQty(drafts, Number(lineId), text),
    createDrafts(lines),
  );

describe('remainingQty — 잔량', () => {
  it('발주 수량에서 누적 입하를 뺀다', () => {
    expect(remainingQty(100, 40)).toBe(60);
  });

  /*
   * **M15** — 누적 입하가 발주를 이미 넘긴 발주가 실제로 온다. 음수를 그대로 쓰면
   * 정량 한도가 초과 허용치보다 작아져 **정상 도착이 초과분으로 갈린다.**
   */
  it('누적 입하가 발주를 넘겼으면 0으로 본다', () => {
    expect(remainingQty(100, 140)).toBe(0);
  });

  it('꼭 맞게 받았으면 0이다', () => {
    expect(remainingQty(100, 100)).toBe(0);
  });

  it('소수 수량도 그대로 뺀다', () => {
    expect(remainingQty(10.5, 0.5)).toBe(10);
  });
});

describe('normalLimit — 정량 한도', () => {
  /* 계약이 `toleranceOverQty`를 「이 값을 넘으면 초과 입하 분리로 간다」로 정의했다. */
  it('잔량에 초과 허용치를 더한 값이다', () => {
    expect(normalLimit(100, 40, 5)).toBe(65);
  });

  it('초과 허용치가 0이면 잔량이 곧 한도다', () => {
    expect(normalLimit(100, 40, 0)).toBe(60);
  });

  it('잔량이 음수여도 한도는 초과 허용치까지다', () => {
    expect(normalLimit(100, 140, 5)).toBe(5);
  });
});

describe('splitLineQty — 정량분과 초과분을 가른다', () => {
  const base = { orderedQty: 100, receivedQty: 40, toleranceOverQty: 5 };

  /*
   * **M14** — 계약이 「이 값을 **넘으면**」이라고 썼다. 경계를 `>=`로 뒤집으면
   * 한도와 꼭 같은 도착이 초과분으로 갈려, 받을 수 있는 수량에 초과 전표가 만들어진다.
   */
  it('한도와 같으면 전부 정량분이다', () => {
    expect(splitLineQty({ ...base, arrivedQty: 65 })).toEqual({ normalQty: 65, excessQty: 0 });
  });

  it('한도보다 1 많으면 그 1만 초과분이다', () => {
    expect(splitLineQty({ ...base, arrivedQty: 66 })).toEqual({ normalQty: 65, excessQty: 1 });
  });

  it('한도보다 적으면 전부 정량분이다', () => {
    expect(splitLineQty({ ...base, arrivedQty: 64 })).toEqual({ normalQty: 64, excessQty: 0 });
  });

  /*
   * **M16** — 초과분이 0인 라인을 「0짜리 초과 라인」으로 만들면 초과분 전표에
   * 받지도 않은 줄이 실린다. 정확히 0이어야 그 라인을 뺄 수 있다.
   */
  it('한도 안이면 초과분이 정확히 0이다', () => {
    const split = splitLineQty({ ...base, arrivedQty: 10 });

    expect(split.excessQty).toBe(0);
    expect(Object.is(split.excessQty, -0)).toBe(false);
  });

  /* 잔량이 0이고 허용치도 0이면 도착한 전부가 초과분이다. */
  it('받을 것이 남지 않았으면 전부 초과분이다', () => {
    expect(
      splitLineQty({ arrivedQty: 12, orderedQty: 100, receivedQty: 100, toleranceOverQty: 0 }),
    ).toEqual({ normalQty: 0, excessQty: 12 });
  });

  it('누적 입하가 발주를 넘긴 라인도 허용치까지는 정량분이다', () => {
    expect(
      splitLineQty({ arrivedQty: 8, orderedQty: 100, receivedQty: 140, toleranceOverQty: 5 }),
    ).toEqual({ normalQty: 5, excessQty: 3 });
  });

  /* 수량은 소수를 가질 수 있다(계약이 `number`다). 뺄셈만 하고 합계를 누적하지 않는다. */
  it('소수 수량도 갈린다', () => {
    expect(
      splitLineQty({ arrivedQty: 65.5, orderedQty: 100, receivedQty: 40, toleranceOverQty: 5 }),
    ).toEqual({ normalQty: 65, excessQty: 0.5 });
  });
});

describe('toSplitLines — 라인과 초안을 읽는 자리에서 파생한다', () => {
  const lines = [line(), line({ purchaseOrderLineId: 9402, lineNo: 2, receivedQty: 100 })];

  it('초안에 넣은 수량으로 라인마다 갈린다', () => {
    const rows = toSplitLines(lines, draftsFor(lines, { 9401: '66', 9402: '3' }));

    expect(rows[0]?.split).toEqual({ normalQty: 65, excessQty: 1 });
    expect(rows[1]?.split).toEqual({ normalQty: 3, excessQty: 0 });
  });

  it('잔량과 정량 한도를 함께 낸다 — 표가 다시 계산하지 않는다', () => {
    const rows = toSplitLines(lines, draftsFor(lines, {}));

    expect(rows[0]?.remainingQty).toBe(60);
    expect(rows[0]?.normalLimit).toBe(65);
    expect(rows[1]?.remainingQty).toBe(0);
    expect(rows[1]?.normalLimit).toBe(5);
  });

  /*
   * **M18** — 빈 칸은 「이 라인은 이번에 받지 않는다」이지 잘못이 아니다.
   * 필수 오류를 붙이면 라인이 열 줄인 발주에서 열 개의 오류가 한꺼번에 뜬다.
   */
  it('빈 칸은 오류가 아니고 가를 것도 없다', () => {
    const rows = toSplitLines(lines, draftsFor(lines, {}));

    expect(rows[0]?.qtyError).toBeNull();
    expect(rows[0]?.split).toBeNull();
  });

  /*
   * **M17** — 잘못된 수량을 그대로 넘기면 `NaN`이 계산에 들어가 정량·초과가 둘 다 `NaN`이 되고,
   * 그 값이 요청 본문에까지 흘러간다.
   */
  it('숫자가 아니거나 0 이하면 계산에서 빠지고 사유가 붙는다', () => {
    const rows = toSplitLines(lines, draftsFor(lines, { 9401: 'abc', 9402: '0' }));

    expect(rows[0]?.split).toBeNull();
    expect(rows[0]?.qtyError).toBe(t.errors.qtyNotNumber);
    expect(rows[1]?.split).toBeNull();
    expect(rows[1]?.qtyError).toBe(t.errors.qtyNotPositive);
  });

  /* 짝이 되는 방향 — 한 줄이 잘못돼도 다른 줄의 계산은 그대로 나온다. */
  it('한 줄이 잘못돼도 나머지 줄은 갈린다', () => {
    const rows = toSplitLines(lines, draftsFor(lines, { 9401: 'abc', 9402: '3' }));

    expect(rows[0]?.split).toBeNull();
    expect(rows[1]?.split).toEqual({ normalQty: 3, excessQty: 0 });
  });

  it('친 글자를 그대로 들고 있다 — 입력칸이 되돌아가지 않는다', () => {
    const rows = toSplitLines(lines, draftsFor(lines, { 9401: '6' }));

    expect(rows[0]?.qtyText).toBe('6');
    expect(rows[1]?.qtyText).toBe('');
  });

  it('라인 순서를 바꾸지 않는다', () => {
    expect(toSplitLines(lines, draftsFor(lines, {})).map((row) => row.line.lineNo)).toEqual([1, 2]);
  });
});

import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_LINE_DRAFT,
  hasAnyLineDraftValue,
  isLineSelected,
  parseReturnQty,
  readDraftQty,
  setDraftQty,
  toggleLineSelection,
} from './line-draft';

const t = messages.supplierReturn;

describe('parseReturnQty — 세 갈래를 가른다', () => {
  it('빈 칸은 오류가 아니다', () => {
    expect(parseReturnQty('')).toEqual({ kind: 'empty' });
  });

  it('공백만도 빈 칸이다', () => {
    expect(parseReturnQty('   ')).toEqual({ kind: 'empty' });
  });

  it('양수를 수량으로 읽는다', () => {
    expect(parseReturnQty('100')).toEqual({ kind: 'qty', value: 100 });
  });

  it('소수를 그대로 읽는다', () => {
    expect(parseReturnQty('12.5')).toEqual({ kind: 'qty', value: 12.5 });
  });

  it('앞뒤 공백을 떼고 읽는다', () => {
    expect(parseReturnQty('  7 ')).toEqual({ kind: 'qty', value: 7 });
  });

  /**
   * **M21** — 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. `<= 0`을 `< 0`으로 바꾸면
   * 목이 400으로 되돌리는 값을 화면이 통과시킨다.
   */
  it('0을 막는다', () => {
    expect(parseReturnQty('0')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotPositive,
    });
  });

  it('0.0도 막는다', () => {
    expect(parseReturnQty('0.0')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotPositive,
    });
  });

  it('음수를 막는다', () => {
    expect(parseReturnQty('-1')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotPositive,
    });
  });

  /** `Number()`는 `Infinity`를 숫자로 읽는다 — 직렬화하면 `null`이 되어 요청에 실린다. */
  it('무한대를 숫자로 받지 않는다', () => {
    expect(parseReturnQty('Infinity')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotNumber,
    });
  });

  it('숫자가 아닌 글자를 막는다', () => {
    expect(parseReturnQty('열개')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotNumber,
    });
  });

  /**
   * **`Number()`를 쓰는 이유가 이 자리다.** `parseFloat`는 꼬리 쓰레기를 잘라 `'10abc'`를
   * `10`으로 읽는다 — 사용자가 잘못 친 값이 **조용히 다른 수량으로** 나가게 된다.
   * 「숫자가 아니다」를 `'abc'`류로만 재면 두 함수가 같은 답을 내는 입력만 지나간다.
   */
  it('꼬리에 글자가 붙은 수를 받지 않는다', () => {
    expect(parseReturnQty('10abc')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotNumber,
    });
    expect(parseReturnQty('10 20')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotNumber,
    });
  });

  /** 「0.」은 소수를 치는 도중이다 — 숫자로 읽히고 0이므로 양수 사유로 막힌다. */
  it('치는 도중의 0.도 양수 사유로 막는다', () => {
    expect(parseReturnQty('0.')).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotPositive,
    });
  });

  it('형식 오류와 양수 오류의 문구가 서로 다르다', () => {
    expect(t.errors.qtyNotNumber).not.toBe(t.errors.qtyNotPositive);
  });
});

describe('반품 수량 초안 — 친 글자를 그대로 들고 있는다', () => {
  /**
   * **M22 · 승인 13-7** — 입고 수량으로 미리 채우면 전량 반품이 기본값처럼 보이고,
   * 사용자가 그대로 확인하면 **받은 전부가 나간다.**
   */
  it('초안은 비어 있고 어느 줄도 빈 칸으로 읽힌다', () => {
    expect(readDraftQty(EMPTY_LINE_DRAFT, 9401)).toBe('');
    expect(readDraftQty(EMPTY_LINE_DRAFT, 9402)).toBe('');
  });

  it('친 글자를 그대로 돌려준다', () => {
    const draft = setDraftQty(EMPTY_LINE_DRAFT, 9401, '0.');

    expect(readDraftQty(draft, 9401)).toBe('0.');
  });

  it('한 줄을 고쳐도 다른 줄의 값이 남는다', () => {
    const draft = setDraftQty(setDraftQty(EMPTY_LINE_DRAFT, 9401, '10'), 9402, '20');

    expect(readDraftQty(draft, 9401)).toBe('10');
    expect(readDraftQty(draft, 9402)).toBe('20');
  });

  /** 같은 참조를 고치면 화면이 다시 그려지지 않는다 — 앞 초안을 건드리지 않는다. */
  it('앞 초안을 고치지 않고 새 초안을 만든다', () => {
    const before = setDraftQty(EMPTY_LINE_DRAFT, 9401, '10');
    const after = setDraftQty(before, 9401, '20');

    expect(before).not.toBe(after);
    expect(readDraftQty(before, 9401)).toBe('10');
  });

  it('수량을 지우면 빈 칸으로 돌아간다', () => {
    const draft = setDraftQty(setDraftQty(EMPTY_LINE_DRAFT, 9401, '10'), 9401, '');

    expect(readDraftQty(draft, 9401)).toBe('');
  });
});

describe('줄 선택 집합', () => {
  it('처음에는 아무 줄도 골라져 있지 않다', () => {
    expect(isLineSelected(EMPTY_LINE_DRAFT, 9401)).toBe(false);
  });

  it('누르면 골라지고 다시 누르면 풀린다', () => {
    const picked = toggleLineSelection(EMPTY_LINE_DRAFT, 9401);
    const released = toggleLineSelection(picked, 9401);

    expect(isLineSelected(picked, 9401)).toBe(true);
    expect(isLineSelected(released, 9401)).toBe(false);
  });

  /** **여러 줄을 함께 고른다** — 한 반품 전표에 여러 라인이 실린다(계약 `lines` 배열). */
  it('여러 줄을 함께 고른다', () => {
    const draft = toggleLineSelection(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9402);

    expect(isLineSelected(draft, 9401)).toBe(true);
    expect(isLineSelected(draft, 9402)).toBe(true);
  });

  it('한 줄을 풀어도 다른 줄은 골라진 채다', () => {
    const draft = toggleLineSelection(
      toggleLineSelection(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9402),
      9401,
    );

    expect(isLineSelected(draft, 9401)).toBe(false);
    expect(isLineSelected(draft, 9402)).toBe(true);
  });

  /**
   * **선택과 수량은 짝이지만 서로를 지우지 않는다.** 잘못 눌러 선택이 풀렸을 때 친 수량까지
   * 사라지면 다시 치게 된다 — 무엇을 보내는지는 요약과 확인 창이 밝힌다.
   */
  it('선택을 풀어도 그 줄에 친 수량이 남는다', () => {
    const typed = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9401, '10');
    const released = toggleLineSelection(typed, 9401);

    expect(readDraftQty(released, 9401)).toBe('10');
  });

  it('수량을 쳐도 선택 상태가 바뀌지 않는다', () => {
    const draft = setDraftQty(EMPTY_LINE_DRAFT, 9401, '10');

    expect(isLineSelected(draft, 9401)).toBe(false);
  });

  it('앞 초안을 고치지 않고 새 초안을 만든다', () => {
    const after = toggleLineSelection(EMPTY_LINE_DRAFT, 9401);

    expect(after).not.toBe(EMPTY_LINE_DRAFT);
    expect(isLineSelected(EMPTY_LINE_DRAFT, 9401)).toBe(false);
  });
});

/**
 * **버릴 것이 있는가** — 「입력 지우기」를 열지 말지 가르는 자리다.
 *
 * 두 조각을 각각 봐야 하는 이유는 **선택을 풀어도 친 수량이 남기** 때문이다. 고른 줄이
 * 0이어도 수량이 남아 있으면 지울 것이 있고, 그것을 말없이 지우면 무엇을 잃었는지도 모른다.
 */
describe('hasAnyLineDraftValue — 버릴 것이 있는가', () => {
  it('빈 초안에는 버릴 것이 없다', () => {
    expect(hasAnyLineDraftValue(EMPTY_LINE_DRAFT)).toBe(false);
  });

  it('고른 줄만 있어도 버릴 것이 있다', () => {
    expect(hasAnyLineDraftValue(toggleLineSelection(EMPTY_LINE_DRAFT, 9401))).toBe(true);
  });

  /* 선택을 풀어도 수량이 남는다 — 그 상태에서 「버릴 것이 없다」로 읽으면 값이 말없이 사라진다. */
  it('선택을 푼 뒤 수량만 남아도 버릴 것이 있다', () => {
    const typed = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9401, '10');

    expect(hasAnyLineDraftValue(toggleLineSelection(typed, 9401))).toBe(true);
  });

  /* 쳤다가 지운 칸은 버릴 것이 아니다 — 키는 남지만 값이 빈 칸이다. */
  it('쳤다가 지운 칸만 남으면 버릴 것이 없다', () => {
    const cleared = setDraftQty(setDraftQty(EMPTY_LINE_DRAFT, 9401, '10'), 9401, '');

    expect(hasAnyLineDraftValue(cleared)).toBe(false);
  });
});

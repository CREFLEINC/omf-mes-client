import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  createDrafts,
  hasAnyQty,
  parseQty,
  readDraftQty,
  setDraftQty,
  type LineDrafts,
} from './line-draft';
import type { PoLineView } from './types';

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

const LINES = [line(), line({ purchaseOrderLineId: 9402, lineNo: 2 })];

describe('parseQty — 친 글자를 수량으로 읽는다', () => {
  /* 빈 칸은 「이 라인은 이번에 받지 않는다」이지 잘못이 아니다. */
  it('빈 칸과 공백만 친 칸은 미입력이다', () => {
    expect(parseQty('')).toEqual({ kind: 'empty' });
    expect(parseQty('   ')).toEqual({ kind: 'empty' });
  });

  it('앞뒤 공백을 다듬어 읽는다', () => {
    expect(parseQty('  12  ')).toEqual({ kind: 'qty', value: 12 });
  });

  it('소수 수량을 읽는다 — 계약이 수량을 정수로 제한하지 않는다', () => {
    expect(parseQty('0.5')).toEqual({ kind: 'qty', value: 0.5 });
  });

  /*
   * `<input type="number">`가 지수 표기를 그대로 받는다. 값으로는 1000이 맞으므로
   * 거절하지 않고 그 수로 읽는다 — 거절하면 사용자가 왜 막혔는지 알 수 없다.
   */
  it('지수 표기는 그 수로 읽는다', () => {
    expect(parseQty('1e3')).toEqual({ kind: 'qty', value: 1000 });
  });

  /* 계약이 `exclusiveMinimum: 0`이다. 0도 보낼 수 없다. */
  it('0과 음수는 사유가 갈린 오류다', () => {
    expect(parseQty('0')).toEqual({ kind: 'invalid', message: t.errors.qtyNotPositive });
    expect(parseQty('-3')).toEqual({ kind: 'invalid', message: t.errors.qtyNotPositive });
  });

  it('숫자가 아닌 글자는 다른 사유의 오류다', () => {
    expect(parseQty('abc')).toEqual({ kind: 'invalid', message: t.errors.qtyNotNumber });
    expect(parseQty('12개')).toEqual({ kind: 'invalid', message: t.errors.qtyNotNumber });
  });

  /*
   * `Number('Infinity')`는 숫자이고 0보다 크다. 걸러 내지 않으면 요청 본문에 실려
   * JSON 직렬화에서 `null`이 되고 서버는 필수 필드 누락으로 본다.
   */
  it('무한대와 NaN 표기는 숫자가 아닌 것으로 본다', () => {
    expect(parseQty('Infinity')).toEqual({ kind: 'invalid', message: t.errors.qtyNotNumber });
    expect(parseQty('NaN')).toEqual({ kind: 'invalid', message: t.errors.qtyNotNumber });
  });

  /* 두 오류 문구가 같으면 사용자가 무엇을 고쳐야 하는지 알 수 없다. */
  it('두 오류의 문구가 서로 다르다', () => {
    expect(t.errors.qtyNotNumber).not.toBe(t.errors.qtyNotPositive);
  });
});

describe('createDrafts — 라인 응답으로 초안을 만든다', () => {
  /* 초안은 **특정 발주의 라인에 묶여 있다.** 어느 라인의 자리인지 키가 밝힌다. */
  it('라인마다 빈 칸 하나씩 만든다', () => {
    const drafts = createDrafts(LINES);

    expect(readDraftQty(drafts, 9401)).toBe('');
    expect(readDraftQty(drafts, 9402)).toBe('');
  });

  it('라인이 없으면 빈 초안이다', () => {
    expect(hasAnyQty(createDrafts([]))).toBe(false);
  });

  /* 라인 응답이 바뀌면 초안의 자리도 바뀐다 — 앞 발주의 수량이 남아 있으면 안 된다. */
  it('새로 만들면 앞서 친 수량이 남지 않는다', () => {
    const typed = setDraftQty(createDrafts(LINES), 9401, '12');

    expect(hasAnyQty(createDrafts(LINES))).toBe(false);
    expect(hasAnyQty(typed)).toBe(true);
  });
});

describe('setDraftQty — 한 줄의 수량을 바꾼다', () => {
  it('그 줄만 바뀌고 다른 줄은 그대로다', () => {
    const drafts = setDraftQty(setDraftQty(createDrafts(LINES), 9401, '12'), 9402, '3');

    expect(readDraftQty(drafts, 9401)).toBe('12');
    expect(readDraftQty(drafts, 9402)).toBe('3');
  });

  /* 상태를 직접 바꾸지 않는다 — 같은 참조를 고치면 React가 다시 그리지 않는다. */
  it('앞 초안을 고치지 않고 새 초안을 만든다', () => {
    const before: LineDrafts = createDrafts(LINES);
    const after = setDraftQty(before, 9401, '12');

    expect(readDraftQty(before, 9401)).toBe('');
    expect(after).not.toBe(before);
  });

  /* 지우는 도중의 상태다. 빈 칸으로 되돌아갈 수 있어야 한다. */
  it('비우면 다시 빈 칸이 된다', () => {
    const drafts = setDraftQty(setDraftQty(createDrafts(LINES), 9401, '12'), 9401, '');

    expect(readDraftQty(drafts, 9401)).toBe('');
    expect(hasAnyQty(drafts)).toBe(false);
  });
});

describe('readDraftQty — 아직 초안에 없는 줄', () => {
  /*
   * 라인 응답이 도착한 렌더와 초안을 새로 만드는 effect 사이에 **그 줄이 초안에 없는 순간**이
   * 실제로 있다. 그때 `undefined`가 입력칸의 `value`로 들어가면 제어 입력칸이 비제어로 바뀐다.
   */
  it('초안에 없는 줄은 빈 칸으로 읽는다', () => {
    expect(readDraftQty(createDrafts([]), 9401)).toBe('');
  });
});

describe('hasAnyQty — 버릴 것이 있는가', () => {
  it('한 줄이라도 채워져 있으면 참이다', () => {
    expect(hasAnyQty(setDraftQty(createDrafts(LINES), 9402, '3'))).toBe(true);
  });

  /* 공백만 친 칸은 버릴 값이 아니다 — 확인 창이 뜰 이유가 없다. */
  it('공백만 친 칸은 채운 것으로 보지 않는다', () => {
    expect(hasAnyQty(setDraftQty(createDrafts(LINES), 9401, '   '))).toBe(false);
  });

  /* 잘못 친 값도 사용자가 친 값이다 — 버리기 전에 확인을 받아야 한다. */
  it('잘못 친 값도 채운 것으로 본다', () => {
    expect(hasAnyQty(setDraftQty(createDrafts(LINES), 9401, 'abc'))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { isOrderOverdue } from './overdue';

const TODAY = '2026-10-20';

describe('isOrderOverdue — 납기 < 공장 오늘 이고 남은 라인이 있다', () => {
  it('납기가 지났고 남은 라인이 있으면 지연이다', () => {
    expect(isOrderOverdue({ expectedReceiptDate: '2026-10-19', openLineCount: 1 }, TODAY)).toBe(
      true,
    );
  });

  it('납기 당일은 지연이 아니다', () => {
    expect(isOrderOverdue({ expectedReceiptDate: TODAY, openLineCount: 1 }, TODAY)).toBe(false);
  });

  it('납기가 지났어도 남은 라인이 없으면(다 들어옴·취소) 지연이 아니다', () => {
    expect(isOrderOverdue({ expectedReceiptDate: '2026-10-19', openLineCount: 0 }, TODAY)).toBe(
      false,
    );
  });

  it('납기가 없거나 형식이 아니면 지연이 아니다', () => {
    expect(isOrderOverdue({ expectedReceiptDate: null, openLineCount: 1 }, TODAY)).toBe(false);
    expect(isOrderOverdue({ expectedReceiptDate: '2026/10/19', openLineCount: 1 }, TODAY)).toBe(
      false,
    );
  });
});

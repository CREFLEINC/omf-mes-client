import { setLocale } from '@omf-mes/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import { formatQty, fromReceiptLine } from './rows';
import { plantDate, plantDateTime } from './trace-table';
import type { ReceiptLine } from './types';

describe('수량 글자', () => {
  afterEach(() => setLocale('ko'));

  it('화면 언어의 자리 구분을 따른다', () => {
    expect(formatQty(1234.5)).toBe('1,234.5');
    setLocale('vi');
    expect(formatQty(1234.5)).toBe('1.234,5');
  });
});

describe('공장 날짜로 바꾸지 못한 값', () => {
  it('앞 10자(UTC 날짜)를 자르지 않고 받은 글자 그대로 보인다', () => {
    expect(plantDate('2026-10-23 오전')).toBe('2026-10-23 오전');
    expect(plantDateTime('알 수 없는 값')).toBe('알 수 없는 값');
    expect(plantDate(null)).toBe('');
  });

  it('입출고 줄도 같다', () => {
    const row = fromReceiptLine({ receiptDatetime: 'not-a-date' } as unknown as ReceiptLine);
    expect(row.date).toBe('not-a-date');
    expect(row.time).toBe('');
  });
});

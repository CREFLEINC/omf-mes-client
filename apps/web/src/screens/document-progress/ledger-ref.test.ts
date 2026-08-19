import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { describeLedgerRef, readLedgerRef } from './ledger-ref';

const t = messages.documentProgress;

describe('readLedgerRef', () => {
  /**
   * ⭐ **둘 다 있을 때만 짝이다.** 원장 조회는 영업일이 키의 일부라(계약 경로
   * `/inventory/transactions/{businessDate}/{inventoryTransactionId}`) 번호만으로는 찾을 수 없다.
   */
  it('번호와 영업일이 둘 다 있으면 짝을 낸다', () => {
    expect(
      readLedgerRef({ inventoryTransactionNo: 'SYN-TX-0001', businessDate: '2026-08-06' }),
    ).toEqual({ kind: 'pair', transactionNo: 'SYN-TX-0001', businessDate: '2026-08-06' });
  });

  it('둘 다 없으면 없음이다 — 원장을 만들지 않은 단계다', () => {
    expect(readLedgerRef({ inventoryTransactionNo: null, businessDate: null })).toEqual({
      kind: 'none',
    });
  });

  it('번호만 오면 반쪽으로 가른다', () => {
    expect(readLedgerRef({ inventoryTransactionNo: 'SYN-TX-0001', businessDate: null })).toEqual({
      kind: 'incomplete',
      transactionNo: 'SYN-TX-0001',
      businessDate: null,
    });
  });

  it('영업일만 와도 반쪽으로 가른다', () => {
    expect(readLedgerRef({ inventoryTransactionNo: null, businessDate: '2026-08-06' })).toEqual({
      kind: 'incomplete',
      transactionNo: null,
      businessDate: '2026-08-06',
    });
  });

  /* 빈 문자열은 값이 아니다 — 계약이 선택으로 둔 자리라 빈 글자가 스키마를 통과한다. */
  it('빈 문자열은 값으로 세지 않는다', () => {
    expect(readLedgerRef({ inventoryTransactionNo: '', businessDate: '2026-08-06' })).toEqual({
      kind: 'incomplete',
      transactionNo: null,
      businessDate: '2026-08-06',
    });
  });
});

describe('describeLedgerRef', () => {
  it('짝은 번호와 영업일을 함께 낸다', () => {
    const text = describeLedgerRef({
      kind: 'pair',
      transactionNo: 'SYN-TX-0001',
      businessDate: '2026-08-06',
    });

    expect(text).toContain('SYN-TX-0001');
    expect(text).toContain('2026-08-06');
  });

  /* 반쪽은 **무엇이 없는지**를 적는다 — 번호만 보이면 찾을 수 있는 것처럼 읽힌다. */
  it('영업일이 없으면 그 사실을 적는다', () => {
    expect(
      describeLedgerRef({ kind: 'incomplete', transactionNo: 'SYN-TX-0001', businessDate: null }),
    ).toBe(t.ledger.noBusinessDate('SYN-TX-0001'));
  });

  it('번호가 없으면 그 사실을 적는다', () => {
    expect(
      describeLedgerRef({ kind: 'incomplete', transactionNo: null, businessDate: '2026-08-06' }),
    ).toBe(t.ledger.noTransactionNo('2026-08-06'));
  });

  /* 없음은 값 없음 표식이다 — 빈 칸으로 두면 화면이 빠뜨린 것인지 구분되지 않는다. */
  it('없음은 값 없음 표식을 낸다', () => {
    expect(describeLedgerRef({ kind: 'none' })).toBe(t.values.empty);
  });
});

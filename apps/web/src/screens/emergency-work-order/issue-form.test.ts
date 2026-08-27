import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_ISSUE_FORM,
  type IssueFormValue,
  isIssueInputComplete,
  validateIssueForm,
} from './issue-form';

const t = messages.emergencyWorkOrder.form;

const filled = (overrides: Partial<IssueFormValue> = {}): IssueFormValue => ({
  itemId: '5001',
  orderQty: '200',
  plannedEndAtLocal: '2026-08-06T18:00',
  remarks: '고객 긴급 요청',
  ...overrides,
});

describe('validateIssueForm', () => {
  it('갖춰진 입력에는 오류가 없다', () => {
    expect(validateIssueForm(filled())).toEqual({});
    expect(isIssueInputComplete(filled())).toBe(true);
  });

  it('빈 폼은 품목·수량·사유를 짚는다', () => {
    expect(validateIssueForm(EMPTY_ISSUE_FORM)).toEqual({
      itemId: t.itemRequired,
      orderQty: t.qtyRequired,
      remarks: t.reasonRequired,
    });
  });

  describe('사유', () => {
    it('⛔ 사유를 비우면 발행할 수 없다 — 승인이 없어 사유가 유일한 기록이다', () => {
      expect(validateIssueForm(filled({ remarks: '' })).remarks).toBe(t.reasonRequired);
      expect(isIssueInputComplete(filled({ remarks: '' }))).toBe(false);
    });

    it('⛔ 공백만 넣은 것은 안 쓴 것이다', () => {
      expect(validateIssueForm(filled({ remarks: '   ' })).remarks).toBe(t.reasonRequired);
    });
  });

  describe('수량', () => {
    it('비우면 짚는다', () => {
      expect(validateIssueForm(filled({ orderQty: '' })).orderQty).toBe(t.qtyRequired);
    });

    it.each(['abc', '20개', '1e5', '-5', '1.2.3', ''])(
      '숫자가 아니면 발행할 수 없다: %s',
      (qty) => {
        expect(isIssueInputComplete(filled({ orderQty: qty }))).toBe(false);
      },
    );

    it('⛔ 0은 받지 않는다 — 아무것도 만들지 않는 지시다', () => {
      expect(validateIssueForm(filled({ orderQty: '0' })).orderQty).toBe(t.qtyNotPositive);
      expect(validateIssueForm(filled({ orderQty: '0.000000' })).orderQty).toBe(t.qtyNotPositive);
    });

    it('소수를 받는다 — 수량이 정수만은 아니다', () => {
      expect(validateIssueForm(filled({ orderQty: '0.5' }))).toEqual({});
      expect(validateIssueForm(filled({ orderQty: '12.345678' }))).toEqual({});
    });

    it('⛔ 자릿수가 넘치면 자릿수라고 말한다 — 「숫자가 아니다」로 뭉뚱그리지 않는다', () => {
      expect(validateIssueForm(filled({ orderQty: '9'.repeat(13) })).orderQty).toBe(t.qtyTooLong);
      expect(validateIssueForm(filled({ orderQty: '1.1234567' })).orderQty).toBe(t.qtyTooLong);
    });

    it('⛔ 안전 정수를 넘는 수를 통과시키지 않는다 — 친 수와 다른 값이 남는다', () => {
      expect(isIssueInputComplete(filled({ orderQty: '9007199254740993' }))).toBe(false);
    });
  });

  describe('납기', () => {
    it('⛔ 비워도 발행할 수 있다 — 활성 조건에 납기가 없다', () => {
      expect(validateIssueForm(filled({ plannedEndAtLocal: '' }))).toEqual({});
      expect(isIssueInputComplete(filled({ plannedEndAtLocal: '' }))).toBe(true);
    });

    it.each(['2026-02-30T09:00', '2026-13-01T09:00', '2026-08-06T25:00', '2026-08-06'])(
      '달력에 없는 값은 짚는다: %s',
      (due) => {
        expect(validateIssueForm(filled({ plannedEndAtLocal: due })).plannedEndAtLocal).toBe(
          t.dueInvalid,
        );
      },
    );

    it('윤년의 2월 29일을 받는다', () => {
      expect(validateIssueForm(filled({ plannedEndAtLocal: '2028-02-29T09:00' }))).toEqual({});
    });

    it('⛔ 지난 날짜를 막지 않는다 — 막으라고 정한 곳이 없다', () => {
      expect(validateIssueForm(filled({ plannedEndAtLocal: '2020-01-01T09:00' }))).toEqual({});
    });
  });

  describe('품목', () => {
    it('고르지 않으면 짚는다', () => {
      expect(validateIssueForm(filled({ itemId: '' })).itemId).toBe(t.itemRequired);
    });
  });
});

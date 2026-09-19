import { describe, expect, it } from 'vitest';

import { currentPostStep, isOptionalPostFieldOpen, isPostStepOpen } from './post-steps';
import { EMPTY_CODE_DRAFT, type ReceiptDraft } from './types';

const empty: ReceiptDraft = {
  warehouse: '',
  location: '',
  codes: EMPTY_CODE_DRAFT,
  receiptDatetime: '',
  remarks: '',
};

const upToCodes: ReceiptDraft = {
  ...empty,
  warehouse: '1',
  location: '2',
  codes: {
    ...EMPTY_CODE_DRAFT,
    receiptType: 'MATERIAL',
    sourceDocumentType: 'INBOUND_RECEIPT',
    qualityStatus: 'NORMAL',
    inventoryStatus: 'AVAILABLE',
  },
};

describe('입고 정보 입력 순서', () => {
  it('처음에는 창고만 열려 있다', () => {
    expect(currentPostStep(empty)).toBe('warehouse');
    expect(isPostStepOpen(empty, 'warehouse')).toBe(true);
    expect(isPostStepOpen(empty, 'location')).toBe(false);
    expect(isOptionalPostFieldOpen(empty)).toBe(false);
  });

  it('창고를 고르면 위치가 열린다', () => {
    const draft = { ...empty, warehouse: '1' };

    expect(currentPostStep(draft)).toBe('location');
    expect(isPostStepOpen(draft, 'location')).toBe(true);
    expect(isPostStepOpen(draft, 'receiptType')).toBe(false);
  });

  it('필수 코드를 다 고르면 입고 일시와 선택 칸(사유·비고)이 열린다', () => {
    expect(currentPostStep(upToCodes)).toBe('receiptDatetime');
    expect(isPostStepOpen(upToCodes, 'receiptDatetime')).toBe(true);
    expect(isOptionalPostFieldOpen(upToCodes)).toBe(true);
  });

  it('모두 채우면 지금 채울 칸이 없고 모든 칸이 열려 있다', () => {
    const done = { ...upToCodes, receiptDatetime: '2026-09-19T10:00' };

    expect(currentPostStep(done)).toBeNull();
    expect(isPostStepOpen(done, 'warehouse')).toBe(true);
    expect(isPostStepOpen(done, 'receiptDatetime')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { applyReturnAutoFill, NO_RETURN_AUTO_VALUES, onlyOptionValue } from './auto-fill';
import { EMPTY_RETURN_DRAFT } from './types';

const auto = {
  supplier: '545',
  issueType: 'SUPPLIER_RETURN',
  sourceDocumentType: 'GOODS_RECEIPT',
  destinationType: 'PARTNER',
  issuedDate: '2026-11-27',
  issuedTime: '11:20',
};

describe('applyReturnAutoFill', () => {
  it('빈 칸을 채우고 반품 사유는 비워 둔다', () => {
    const draft = applyReturnAutoFill(EMPTY_RETURN_DRAFT, NO_RETURN_AUTO_VALUES, auto);

    expect(draft.supplier).toBe('545');
    expect(draft.codes).toEqual({
      issueType: 'SUPPLIER_RETURN',
      sourceDocumentType: 'GOODS_RECEIPT',
      destinationType: 'PARTNER',
      reason: '',
    });
    expect([draft.issuedDate, draft.issuedTime]).toEqual(['2026-11-27', '11:20']);
  });

  it('전표를 바꾸면 화면이 채운 값은 바꾸고 사용자가 고친 값은 남긴다', () => {
    const filled = applyReturnAutoFill(EMPTY_RETURN_DRAFT, NO_RETURN_AUTO_VALUES, auto);
    const edited = { ...filled, issuedTime: '08:00' };
    const next = { ...auto, supplier: '566', issuedTime: '11:30' };

    const draft = applyReturnAutoFill(edited, auto, next);

    expect(draft.supplier).toBe('566');
    expect(draft.issuedTime).toBe('08:00');
  });

  it('사용자가 고른 공급사는 덮지 않는다', () => {
    const draft = applyReturnAutoFill(
      { ...EMPTY_RETURN_DRAFT, supplier: '1' },
      NO_RETURN_AUTO_VALUES,
      auto,
    );

    expect(draft.supplier).toBe('1');
  });
});

describe('onlyOptionValue', () => {
  it('선택지가 하나뿐일 때만 그 값을 낸다', () => {
    expect(onlyOptionValue([{ value: 'A' }])).toBe('A');
    expect(onlyOptionValue([{ value: 'A' }, { value: 'B' }])).toBe('');
    expect(onlyOptionValue([])).toBe('');
  });
});

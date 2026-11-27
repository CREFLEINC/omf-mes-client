import { describe, expect, it } from 'vitest';

import { applyDisposalAutoFill, NO_DISPOSAL_AUTO_VALUES } from './auto-fill';
import { EMPTY_DISPOSAL_DRAFT } from './types';

const auto = {
  issueType: 'OTHER',
  sourceDocumentType: 'GOODS_RECEIPT',
  issuedDate: '2026-11-27',
  issuedTime: '11:20',
  disposalPartnerId: '9561',
};

describe('applyDisposalAutoFill', () => {
  it('빈 칸을 채우고 폐기 사유 · 요청 사유는 비워 둔다', () => {
    const draft = applyDisposalAutoFill(EMPTY_DISPOSAL_DRAFT, NO_DISPOSAL_AUTO_VALUES, auto);

    expect(draft.codes).toEqual({
      issueType: 'OTHER',
      sourceDocumentType: 'GOODS_RECEIPT',
      reason: '',
    });
    expect([draft.issuedDate, draft.issuedTime]).toEqual(['2026-11-27', '11:20']);
    expect(draft.disposalPartnerId).toBe('9561');
    expect(draft.reason).toBe('');
  });

  it('자체 폐기를 체크했으면 거래처를 넣지 않는다', () => {
    const draft = applyDisposalAutoFill(
      { ...EMPTY_DISPOSAL_DRAFT, isSelfDisposal: true },
      NO_DISPOSAL_AUTO_VALUES,
      auto,
    );

    expect(draft.disposalPartnerId).toBe('');
  });

  it('사용자가 고친 값은 덮지 않는다', () => {
    const draft = applyDisposalAutoFill(
      { ...EMPTY_DISPOSAL_DRAFT, issuedDate: '2026-11-20' },
      NO_DISPOSAL_AUTO_VALUES,
      auto,
    );

    expect(draft.issuedDate).toBe('2026-11-20');
  });
});

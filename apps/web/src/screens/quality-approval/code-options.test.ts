import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { approvalScopeWarning, approvalTypeLabelOf, toTypeOptions } from './code-options';

describe('approvalScopeWarning', () => {
  it('승인 유형 기준값이 비어 있으면 넓은 조회 범위를 경고한다', () => {
    expect(approvalScopeWarning([])).toBe(messages.qualityApproval.scopeWarning);
  });

  it('승인 유형 기준값이 하나라도 있으면 준비 중 경고를 내리지 않는다', () => {
    expect(approvalScopeWarning(['IQC_SKIP'])).toBeUndefined();
  });
});

describe('approvalTypeLabelOf', () => {
  it('아는 승인 유형은 사용자 용어로, 모르는 코드는 원문 그대로 보인다', () => {
    expect(toTypeOptions(['CONCESSION', 'OQC_SKIP', 'SYNTH-TYPE'])).toEqual([
      { value: 'CONCESSION', label: messages.qualityApproval.typeLabels.CONCESSION },
      { value: 'OQC_SKIP', label: messages.qualityApproval.typeLabels.OQC_SKIP },
      { value: 'SYNTH-TYPE', label: 'SYNTH-TYPE' },
    ]);
    expect(approvalTypeLabelOf('CONCESSION')).toBe('특채');
  });
});

import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  approvalScopeWarning,
  approvalTypeLabelOf,
  statusBadgeOf,
  toTypeOptions,
} from './code-options';

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

describe('statusBadgeOf', () => {
  it('요청 상태를 사용자 용어와 색으로, 모르는 값은 회색에 코드 그대로 보인다', () => {
    expect(statusBadgeOf('PENDING')).toEqual({ label: '결재 대기', tone: 'warning' });
    expect(statusBadgeOf('APPROVED')).toEqual({ label: '승인', tone: 'success' });
    expect(statusBadgeOf('REJECTED')).toEqual({ label: '반려', tone: 'error' });
    expect(statusBadgeOf('SYNTH-STATE')).toEqual({ label: 'SYNTH-STATE', tone: 'idle' });
  });
});

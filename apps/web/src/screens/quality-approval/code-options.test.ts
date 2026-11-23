import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  QUALITY_APPROVAL_TYPE_CODES,
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
    expect(approvalScopeWarning(['CONCESSION'])).toBeUndefined();
  });
});

describe('QUALITY_APPROVAL_TYPE_CODES', () => {
  it('품질 승인 유형은 특채 하나다 — 건별 검사 생략 결재는 없어졌다(#353)', () => {
    expect(QUALITY_APPROVAL_TYPE_CODES).toEqual(['CONCESSION']);
  });
});

describe('approvalTypeLabelOf', () => {
  it('아는 승인 유형은 사용자 용어로, 모르는 코드는 원문 그대로 보인다', () => {
    expect(toTypeOptions(['CONCESSION', 'SYNTH-TYPE'])).toEqual([
      { value: 'CONCESSION', label: messages.qualityApproval.typeLabels.CONCESSION },
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

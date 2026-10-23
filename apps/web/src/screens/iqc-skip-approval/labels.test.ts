import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { approvalTypeLabelOf, statusBadgeOf, targetLabelOf } from './labels';

const t = messages.iqcSkipApproval;

describe('approvalTypeLabelOf', () => {
  it('아는 유형은 사용자 용어로 읽는다', () => {
    expect(approvalTypeLabelOf('IQC_SKIP')).toBe(t.labels.approvalType.IQC_SKIP);
  });

  it('표에 없는 유형은 코드 그대로다 — 이름을 짓지 않는다', () => {
    expect(approvalTypeLabelOf('GOODS_ISSUE_DISPOSAL')).toBe('GOODS_ISSUE_DISPOSAL');
  });
});

describe('targetLabelOf', () => {
  it('표시명 앞머리 유형 코드만 바꾸고 번호는 서버 값 그대로다', () => {
    expect(targetLabelOf('INBOUND_LOT #12', 'INBOUND_LOT')).toBe(
      `${t.labels.targetType.INBOUND_LOT} #12`,
    );
  });

  it('표시명이 그 코드로 시작하지 않으면 그대로다', () => {
    expect(targetLabelOf('합성 대상 문서 가', 'INBOUND_LOT')).toBe('합성 대상 문서 가');
  });

  it('표에 없는 유형이면 그대로다', () => {
    expect(targetLabelOf('GOODS_ISSUE #3', 'GOODS_ISSUE')).toBe('GOODS_ISSUE #3');
  });
});

describe('statusBadgeOf', () => {
  it('대기 주황 · 승인 초록 · 반려 빨강', () => {
    expect(statusBadgeOf('PENDING')).toEqual({ label: t.labels.status.PENDING, tone: 'warning' });
    expect(statusBadgeOf('APPROVED')).toEqual({ label: t.labels.status.APPROVED, tone: 'success' });
    expect(statusBadgeOf('REJECTED')).toEqual({ label: t.labels.status.REJECTED, tone: 'error' });
  });

  it('모르는 값은 회색에 코드 그대로다', () => {
    expect(statusBadgeOf('CANCELLED')).toEqual({ label: 'CANCELLED', tone: 'idle' });
  });
});

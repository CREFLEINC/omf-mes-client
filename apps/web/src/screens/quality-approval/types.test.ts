import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toRequestRow, type ApprovalRequest } from './types';

const request = (): ApprovalRequest => ({
  approvalRequestId: 31,
  approvalRequestNo: 'SYNTH-REQ-031',
  approvalTypeCode: 'SYNTH-CONCESSION',
  requestedBy: 7,
  requestedByName: '합성 사용자',
  requestedAt: '2026-08-22T09:30:00+09:00',
  statusCode: 'SYNTH-PENDING',
  reason: '\n  첫 근거  \n둘째 근거',
  target: {
    targetTypeCode: 'SYNTH-DOCUMENT',
    targetId: 91,
    displayName: '합성 대상',
    openable: false,
  },
  currentStepNo: 1,
  totalStepNo: 2,
  isMyTurn: true,
});

it('계약 응답을 안정 ID와 원시 유형 코드를 가진 표시 행으로 옮긴다', () => {
  const source = request();
  const before = structuredClone(source);

  expect(toRequestRow(source)).toEqual({
    approvalRequestId: 31,
    approvalRequestNo: 'SYNTH-REQ-031',
    approvalTypeCode: 'SYNTH-CONCESSION',
    targetName: '합성 대상',
    statusCode: 'SYNTH-PENDING',
    isMyTurn: true,
  });
  expect(source).toEqual(before);
});

it('빈 표시 이름을 내부 번호로 대신하지 않는다', () => {
  const source = request();
  source.requestedByName = '   ';
  source.target.displayName = '';

  const row = toRequestRow(source);

  expect(row.targetName).toBe(messages.qualityApproval.values.unknownTarget);
  expect(JSON.stringify(row)).not.toContain('91');
});

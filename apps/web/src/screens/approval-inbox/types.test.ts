import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ApprovalRequest } from './types';
import { firstLineOf, formatDateTime, toRequestRow } from './types';

const t = messages.approvalInbox;

const baseRequest: ApprovalRequest = {
  approvalRequestId: 9001,
  approvalRequestNo: 'SYNTH-REQ-001',
  approvalTypeCode: 'SAMPLE-TYPE-A',
  requestedBy: 9301,
  requestedByName: '합성 상신자1',
  requestedAt: '2026-08-06T14:20:00+09:00',
  statusCode: 'SAMPLE-STATUS-A',
  reason: '첫 줄 사유\n둘째 줄은 더 길게 적힌 설명이다',
  target: {
    targetTypeCode: 'SAMPLE-TARGET',
    targetId: 9401,
    displayName: '합성 대상 문서 A',
    openable: true,
  },
  currentStepNo: 2,
  totalStepNo: 3,
  isMyTurn: true,
};

describe('firstLineOf', () => {
  it('여러 줄 사유에서 첫 줄만 낸다', () => {
    expect(firstLineOf('첫 줄\n둘째 줄')).toBe('첫 줄');
  });

  it('CRLF 줄바꿈도 첫 줄에서 끊는다', () => {
    expect(firstLineOf('첫 줄\r\n둘째 줄')).toBe('첫 줄');
  });

  it('한 줄뿐이면 그 줄을 그대로 낸다', () => {
    expect(firstLineOf('한 줄짜리 사유')).toBe('한 줄짜리 사유');
  });

  it('앞이 빈 줄이면 내용이 있는 첫 줄을 낸다', () => {
    expect(firstLineOf('\n   \n실제 사유')).toBe('실제 사유');
  });

  it('줄 끝 공백을 남기지 않는다', () => {
    expect(firstLineOf('첫 줄   \n둘째 줄')).toBe('첫 줄');
  });

  it('내용이 하나도 없으면 빈 문자열이다', () => {
    expect(firstLineOf('   \n\t')).toBe('');
  });
});

describe('formatDateTime', () => {
  it('시각까지 낸다 — 날짜만 내면 같은 날 요청들의 앞뒤가 사라진다', () => {
    expect(formatDateTime('2026-08-06T14:20:00+09:00')).toBe('2026-08-06 14:20');
    expect(formatDateTime('2026-08-06T09:05:00+09:00')).toBe('2026-08-06 09:05');
  });

  it('실행 환경 시간대로 옮기지 않는다 — 실려 온 벽시계 시각 그대로다', () => {
    expect(formatDateTime('2026-08-06T23:50:00-05:00')).toBe('2026-08-06 23:50');
  });

  it('초와 offset은 표기하지 않는다', () => {
    expect(formatDateTime('2026-08-06T14:20:59+09:00')).not.toContain('59');
    expect(formatDateTime('2026-08-06T14:20:00+09:00')).not.toContain('+09');
  });

  it('형식이 아니면 원문을 그대로 낸다 — 자료를 잃지 않는다', () => {
    expect(formatDateTime('알 수 없는 값')).toBe('알 수 없는 값');
  });
});

describe('toRequestRow', () => {
  it('확정된 여섯 값만 담는다 — 행 식별자를 빼면 그것이 목록이 아는 전부다', () => {
    const row = toRequestRow(baseRequest);

    expect(row).toEqual({
      approvalRequestId: 9001,
      approvalRequestNo: 'SYNTH-REQ-001',
      approvalTypeCode: 'SAMPLE-TYPE-A',
      requesterName: '합성 상신자1',
      requestedAtText: '2026-08-06 14:20',
      statusCode: 'SAMPLE-STATUS-A',
      reasonFirstLine: '첫 줄 사유',
    });
  });

  it('상신 일시가 시각까지 담긴다 — 날짜만 담으면 여기서 멈춘다', () => {
    const row = toRequestRow(baseRequest);

    expect(row.requestedAtText).toBe('2026-08-06 14:20');
    expect(row.requestedAtText).not.toBe('2026-08-06');
  });

  it('대상과 진행 단계를 옮겨 담지 않는다 — 상세 구획 소관이다', () => {
    const row = toRequestRow(baseRequest);
    const keys = Object.keys(row);

    /* 짝 방향 — 담아야 할 값은 실제로 담긴다. 아무것도 담지 않아도 아래 단언은 통과한다. */
    expect(row.approvalTypeCode).toBe('SAMPLE-TYPE-A');
    expect(row.reasonFirstLine).toBe('첫 줄 사유');

    expect(keys).not.toContain('targetName');
    expect(keys).not.toContain('progressLabel');
    expect(keys).not.toContain('currentStepNo');
    expect(keys).not.toContain('totalStepNo');
  });

  it('내부 번호를 담지 않는다 — 담기지 않으면 화면으로 샐 경로도 없다', () => {
    const row = toRequestRow(baseRequest);

    /* 짝 방향 — 이름은 실제로 담긴다. */
    expect(row.requesterName).toBe('합성 상신자1');

    expect(Object.keys(row)).not.toContain('requestedBy');
    expect(Object.keys(row)).not.toContain('targetId');
    expect(Object.keys(row)).not.toContain('targetTypeCode');
  });

  it('상신자 이름이 비면 번호를 대신 내지 않는다', () => {
    const row = toRequestRow({ ...baseRequest, requestedByName: '' });

    expect(row.requesterName).toBe(t.values.unknownRequester);
    expect(row.requesterName).not.toContain('9301');
  });

  it('사유가 비면 빈 칸이 아니라 그 사실을 적는다', () => {
    const row = toRequestRow({ ...baseRequest, reason: '  \n ' });

    expect(row.reasonFirstLine).toBe(t.values.emptyReason);
  });

  it('유형 코드를 화면 낱말로 바꾸지 않는다', () => {
    expect(
      toRequestRow({ ...baseRequest, approvalTypeCode: 'SAMPLE-TYPE-Z' }).approvalTypeCode,
    ).toBe('SAMPLE-TYPE-Z');
  });
});

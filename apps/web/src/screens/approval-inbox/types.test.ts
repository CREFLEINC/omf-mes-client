import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ApprovalRequest } from './types';
import { firstLineOf, toProgressLabel, toRequestRow, toRequestedDate } from './types';

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

describe('toProgressLabel', () => {
  it('서버가 준 두 값을 그대로 잇는다', () => {
    expect(toProgressLabel(2, 3)).toBe('2 / 3');
  });

  it('첫 단계도 같은 형태다', () => {
    expect(toProgressLabel(1, 1)).toBe('1 / 1');
  });

  it('현재 단계가 비어 있으면 종료다 — 0으로 메우지 않는다', () => {
    expect(toProgressLabel(null, 3)).toBe(t.values.finished);
    expect(toProgressLabel(null, 3)).not.toContain('0');
  });

  it('현재 단계가 전체보다 커도 서버 값을 그대로 낸다', () => {
    /* 목 서버가 실제로 이런 응답을 준다 — 화면이 고쳐 쓰지 않는다(계획 결정 7). */
    expect(toProgressLabel(2, 1)).toBe('2 / 1');
  });
});

describe('toRequestedDate', () => {
  it('date-time에서 날짜만 뽑는다 — 실행 환경 시간대로 옮기지 않는다', () => {
    expect(toRequestedDate('2026-08-06T14:20:00+09:00')).toBe('2026-08-06');
    expect(toRequestedDate('2026-08-06T23:50:00-05:00')).toBe('2026-08-06');
  });

  it('형식이 아니면 원문을 그대로 낸다 — 자료를 잃지 않는다', () => {
    expect(toRequestedDate('알 수 없는 값')).toBe('알 수 없는 값');
  });
});

describe('toRequestRow', () => {
  it('목록 행이 보이는 값만 담는다', () => {
    const row = toRequestRow(baseRequest);

    expect(row).toEqual({
      approvalRequestId: 9001,
      approvalRequestNo: 'SYNTH-REQ-001',
      targetName: '합성 대상 문서 A',
      reasonFirstLine: '첫 줄 사유',
      requesterName: '합성 상신자1',
      requestedDate: '2026-08-06',
      statusCode: 'SAMPLE-STATUS-A',
      progressLabel: '2 / 3',
    });
  });

  it('내부 번호를 담지 않는다 — 담기지 않으면 화면으로 샐 경로도 없다', () => {
    const row = toRequestRow(baseRequest);

    expect(Object.keys(row)).not.toContain('requestedBy');
    expect(Object.keys(row)).not.toContain('targetId');
    expect(Object.keys(row)).not.toContain('targetTypeCode');
    /* 짝 방향 — 이름은 실제로 담긴다. 아무것도 담지 않아도 위 단언은 통과한다. */
    expect(row.requesterName).toBe('합성 상신자1');
    expect(row.targetName).toBe('합성 대상 문서 A');
  });

  it('상신자 이름이 비면 번호를 대신 내지 않는다', () => {
    const row = toRequestRow({ ...baseRequest, requestedByName: '' });

    expect(row.requesterName).toBe(t.values.unknownRequester);
    expect(row.requesterName).not.toContain('9301');
  });

  it('대상 표시명이 비면 번호를 대신 내지 않는다', () => {
    const row = toRequestRow({
      ...baseRequest,
      target: { ...baseRequest.target, displayName: '' },
    });

    expect(row.targetName).toBe(t.values.unknownTarget);
    expect(row.targetName).not.toContain('9401');
  });

  it('사유가 비면 빈 칸이 아니라 그 사실을 적는다', () => {
    const row = toRequestRow({ ...baseRequest, reason: '  \n ' });

    expect(row.reasonFirstLine).toBe(t.values.emptyReason);
  });

  it('종료된 요청의 진행은 종료다', () => {
    const row = toRequestRow({ ...baseRequest, currentStepNo: null });

    expect(row.progressLabel).toBe(t.values.finished);
  });
});

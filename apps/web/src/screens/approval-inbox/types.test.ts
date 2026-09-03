import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ApprovalRequest } from './types';
import {
  firstLineOf,
  formatDateTime,
  readableName,
  toReasonLines,
  toRequestDetailView,
  toRequestRow,
} from './types';

const t = messages.approvalInbox;

const baseRequest: ApprovalRequest = {
  approvalRequestId: 9001,
  approvalRequestNo: 'SYNTH-REQ-001',
  approvalTypeCode: 'PURCHASE_ORDER',
  requestedBy: 9301,
  requestedByName: '합성 상신자1',
  requestedAt: '2026-08-06T14:20:00+09:00',
  statusCode: 'SAMPLE-STATUS-A',
  reason: '첫 줄 사유\n둘째 줄은 더 길게 적힌 설명이다',
  target: {
    targetTypeCode: 'PURCHASE_ORDER',
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
      approvalTypeCode: 'PURCHASE_ORDER',
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
    expect(row.approvalTypeCode).toBe('PURCHASE_ORDER');
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

  it('공백만인 상신자 이름도 비어 있는 것과 같이 다룬다', () => {
    /*
     * 계약이 이 필드를 필수로 두었으나 공백만인 값은 스키마를 통과한다. 여기서 걸러 내지
     * 않으면 목록에는 빈 칸이 서고 **상세에는 안내가 서서 같은 요청이 두 얼굴을 갖는다.**
     */
    expect(toRequestRow({ ...baseRequest, requestedByName: '   ' }).requesterName).toBe(
      t.values.unknownRequester,
    );
  });

  it('사유가 비면 빈 칸이 아니라 그 사실을 적는다', () => {
    const row = toRequestRow({ ...baseRequest, reason: '  \n ' });

    expect(row.reasonFirstLine).toBe(t.values.emptyReason);
  });

  it('유형 코드를 화면 낱말로 바꾸지 않는다', () => {
    expect(toRequestRow({ ...baseRequest, approvalTypeCode: 'IQC_SKIP' }).approvalTypeCode).toBe(
      'IQC_SKIP',
    );
  });
});

describe('toReasonLines', () => {
  it('줄을 나눠 낸다 — 상세는 전문이고 줄바꿈이 뜻을 나른다', () => {
    expect(toReasonLines('첫 줄\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
  });

  it('CRLF도 같은 자리에서 나눈다 — 캐리지 리턴이 글자로 남지 않는다', () => {
    expect(toReasonLines('첫 줄\r\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
  });

  it('가운데 빈 줄을 지우지 않는다 — 문단 구분이 사유의 일부다', () => {
    expect(toReasonLines('첫 줄\n\n셋째 줄')).toEqual(['첫 줄', '', '셋째 줄']);
  });

  it('줄 안의 공백을 건드리지 않는다 — 들여쓴 목록이 무너지지 않는다', () => {
    expect(toReasonLines('머리\n  - 항목')).toEqual(['머리', '  - 항목']);
  });

  it('내용이 하나도 없으면 빈 칸 대신 그 사실을 적는다', () => {
    expect(toReasonLines('   \n\t')).toEqual([t.values.emptyReason]);
  });

  it('한 줄뿐이면 그 줄 하나다 — 자르거나 이어 붙이지 않는다', () => {
    const long = '아주 길게 이어지는 한 줄짜리 사유'.repeat(50);

    expect(toReasonLines(long)).toEqual([long]);
  });
});

describe('toRequestDetailView', () => {
  it('보이는 값 여섯만 담는다', () => {
    expect(toRequestDetailView(baseRequest)).toEqual({
      approvalRequestNo: 'SYNTH-REQ-001',
      approvalTypeCode: 'PURCHASE_ORDER',
      requesterName: '합성 상신자1',
      requestedAtText: '2026-08-06 14:20',
      statusCode: 'SAMPLE-STATUS-A',
      reasonLines: ['첫 줄 사유', '둘째 줄은 더 길게 적힌 설명이다'],
    });
  });

  it('내부 번호를 담지 않는다 — 담기지 않으면 화면으로 샐 경로도 없다', () => {
    const view = toRequestDetailView(baseRequest);

    /* 짝 방향 — 담아야 할 값은 실제로 담긴다. */
    expect(view.approvalRequestNo).toBe('SYNTH-REQ-001');
    expect(view.requesterName).toBe('합성 상신자1');

    const keys = Object.keys(view);

    expect(keys).not.toContain('approvalRequestId');
    expect(keys).not.toContain('requestedBy');
    expect(keys).not.toContain('targetId');
    expect(keys).not.toContain('targetTypeCode');
  });

  it('대상과 진행 단계를 옮겨 담지 않는다 — 각자 자기 구획이 있다', () => {
    const keys = Object.keys(toRequestDetailView(baseRequest));

    expect(keys).not.toContain('target');
    expect(keys).not.toContain('currentStepNo');
    expect(keys).not.toContain('totalStepNo');
    expect(keys).not.toContain('isMyTurn');
  });

  it('사유는 첫 줄이 아니라 전문이다 — 목록과 다른 자리다', () => {
    const view = toRequestDetailView(baseRequest);

    expect(view.reasonLines).toHaveLength(2);
    expect(view.reasonLines[1]).toBe('둘째 줄은 더 길게 적힌 설명이다');
  });

  it('상신자 이름이 비면 번호를 대신 내지 않는다', () => {
    const view = toRequestDetailView({ ...baseRequest, requestedByName: '' });

    expect(view.requesterName).toBe(t.values.unknownRequester);
    expect(view.requesterName).not.toContain('9301');
  });

  it('공백만인 상신자 이름을 목록과 **같은** 판정으로 다룬다', () => {
    const spaced = { ...baseRequest, requestedByName: '   ' };

    /* 한 화면 안에서 같은 요청이 두 얼굴을 갖지 않는다 — 판정이 한 자리에 있어야 지켜진다. */
    expect(toRequestDetailView(spaced).requesterName).toBe(toRequestRow(spaced).requesterName);
    expect(toRequestDetailView(spaced).requesterName).toBe(t.values.unknownRequester);
  });
});

describe('readableName', () => {
  it('실려 온 이름을 그대로 낸다', () => {
    expect(readableName('합성 상신자1', t.values.unknownRequester)).toBe('합성 상신자1');
  });

  it('빈 값과 공백만인 값을 같이 다룬다 — 이름 자리의 판정은 한 모양이다', () => {
    expect(readableName('', t.values.unknownRequester)).toBe(t.values.unknownRequester);
    expect(readableName('   ', t.values.unknownRequester)).toBe(t.values.unknownRequester);
    expect(readableName('\t\n', t.values.unknownRequester)).toBe(t.values.unknownRequester);
  });

  it('이름 안의 공백은 건드리지 않는다', () => {
    expect(readableName('  합성 상신자1  ', t.values.unknownRequester)).toBe('  합성 상신자1  ');
  });

  it('자리마다 다른 대체 문구를 받는다 — 무엇이 없는지가 자리마다 다르다', () => {
    expect(readableName('', t.values.unknownApprover)).toBe(t.values.unknownApprover);
    expect(readableName('', t.values.unknownTarget)).toBe(t.values.unknownTarget);
  });
});

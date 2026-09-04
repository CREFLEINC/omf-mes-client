import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  FIRST_LINE_OF_MULTILINE_REASON,
  SECOND_LINE_OF_MULTILINE_REASON,
  requestFixtures,
} from './fixtures';
import {
  firstLineOf,
  formatDateTime,
  readableName,
  toDecisionSubject,
  toReasonLines,
  toRequestDetailView,
  toRequestRow,
} from './types';
import type { ApprovalRequest } from './types';

const t = messages.iqcSkipApproval;

describe('firstLineOf', () => {
  it('여러 줄이면 첫 줄만 낸다 — 목록의 요약 자리는 첫 줄이다', () => {
    expect(firstLineOf('첫 줄\n둘째 줄')).toBe('첫 줄');
  });

  it('빈 줄로 시작하면 내용이 있는 첫 줄을 고른다', () => {
    expect(firstLineOf('\n   \n내용이 있는 줄')).toBe('내용이 있는 줄');
  });

  it('CRLF도 줄바꿈으로 본다 — 캐리지 리턴이 글자로 남지 않는다', () => {
    expect(firstLineOf('첫 줄\r\n둘째 줄')).toBe('첫 줄');
  });

  it('줄 끝 공백을 걷어 낸다', () => {
    expect(firstLineOf('  첫 줄  \n둘째 줄')).toBe('첫 줄');
  });

  it('내용이 하나도 없으면 빈 값이다 — 지어내지 않는다', () => {
    expect(firstLineOf('\n \n')).toBe('');
  });

  it('자르거나 줄이지 않는다 — 요약을 만들지 않는다(omf-mes#87)', () => {
    const long = '가'.repeat(200);

    expect(firstLineOf(`${long}\n둘째 줄`)).toBe(long);
  });
});

describe('readableName', () => {
  it('이름이 있으면 그대로 낸다', () => {
    expect(readableName('합성 상신자1', '없음')).toBe('합성 상신자1');
  });

  it('비었거나 공백만이면 대체 문구를 낸다 — 번호를 대신 내지 않는다(omf-mes#44)', () => {
    expect(readableName('', '없음')).toBe('없음');
    expect(readableName('   ', '없음')).toBe('없음');
  });

  it('이름 안의 공백은 건드리지 않는다 — 서버 표기를 고쳐 쓰지 않는다', () => {
    expect(readableName(' 합성 상신자1 ', '없음')).toBe(' 합성 상신자1 ');
  });
});

describe('formatDateTime', () => {
  it('연·월·일과 시·분을 낸다 — 같은 날의 앞뒤가 읽혀야 한다', () => {
    expect(formatDateTime('2026-08-06T14:20:00+09:00')).toBe('2026-08-06 14:20');
  });

  it('실행 환경 시간대로 옮기지 않는다 — 실려 온 시각 그대로다', () => {
    expect(formatDateTime('2026-08-06T23:50:00+00:00')).toBe('2026-08-06 23:50');
  });

  it('형식이 아니면 원문을 그대로 낸다 — 서버 값을 삼키지 않는다', () => {
    expect(formatDateTime('알 수 없는 값')).toBe('알 수 없는 값');
  });
});

describe('toRequestRow', () => {
  const [multiline] = requestFixtures;

  it('목록 행이 보이는 값 여섯을 담는다', () => {
    const row = toRequestRow(multiline as ApprovalRequest);

    expect(row.approvalRequestNo).toBe('SYNTH-REQ-001');
    expect(row.approvalTypeCode).toBe('GOODS_ISSUE_DISPOSAL');
    expect(row.targetName).toBe('합성 대상 문서 가');
    expect(row.reasonFirstLine).toBe('합성 사유 첫 줄');
    expect(row.requesterName).toBe('합성 상신자1');
    expect(row.requestedAtText).toBe('2026-08-06 14:20');
  });

  it('행이 나르는 값에 내부 번호가 없다 — 고르는 데 쓰는 식별자 하나뿐이다', () => {
    const row = toRequestRow(multiline as ApprovalRequest);

    expect(Object.keys(row).sort()).toEqual([
      'approvalRequestId',
      'approvalRequestNo',
      'approvalTypeCode',
      'reasonFirstLine',
      'requestedAtText',
      'requesterName',
      'targetName',
    ]);
    /* 상신자·대상의 내부 번호는 응답에 실려 오지만 행이 나르지 않는다. */
    expect(JSON.stringify(row)).not.toContain(String(multiline?.requestedBy));
    expect(JSON.stringify(row)).not.toContain(String(multiline?.target.targetId));
  });

  it('이름이 비어 오면 대체 문구가 서고 번호가 서지 않는다', () => {
    const nameless = requestFixtures.find((request) => request.requestedByName === '');
    const row = toRequestRow(nameless as ApprovalRequest);

    expect(row.requesterName).toBe(t.values.unknownRequester);
    expect(row.targetName).toBe(t.values.unknownTarget);
  });

  it('사유가 비어 오면 빈 칸 대신 그 사실을 적는다', () => {
    const emptyReason: ApprovalRequest = {
      ...(requestFixtures[0] as ApprovalRequest),
      reason: '\n \n',
    };

    expect(toRequestRow(emptyReason).reasonFirstLine).toBe(t.values.emptyReason);
  });

  it('대상 유형 코드를 행에 담지 않는다 — 담으면 어느 칸에든 그릴 수 있게 된다', () => {
    const row = toRequestRow(multiline as ApprovalRequest);

    expect(JSON.stringify(row)).not.toContain(multiline?.target.targetTypeCode ?? '');
  });
});

/**
 * 사유 **전문**. 목록의 첫 줄 규칙(`firstLineOf`)이 여기에는 걸리지 않는다 —
 * 상세는 상신자가 적은 그대로를 보이는 자리다.
 */
describe('toReasonLines', () => {
  it('줄마다 한 칸으로 나눈다 — 이어 붙이면 문단 구분이 사라진다', () => {
    expect(toReasonLines('첫 줄\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
  });

  it('가운데 빈 줄을 지우지 않는다 — 문단 구분이 사유의 일부다', () => {
    expect(toReasonLines('첫 문단\n\n둘째 문단')).toEqual(['첫 문단', '', '둘째 문단']);
  });

  it('들여쓴 줄의 공백을 걷어 내지 않는다 — 목록 표기가 사유의 일부다', () => {
    expect(toReasonLines('머리말\n  - 들여쓴 항목')).toEqual(['머리말', '  - 들여쓴 항목']);
  });

  it('CRLF에서 캐리지 리턴이 글자로 남지 않는다', () => {
    expect(toReasonLines('첫 줄\r\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
  });

  it('자르거나 줄이지 않는다 — 요약은 목록의 일이다', () => {
    const long = '가'.repeat(300);

    expect(toReasonLines(long)).toEqual([long]);
  });

  it('내용이 없으면 빈 칸 대신 그 사실을 적는다', () => {
    expect(toReasonLines('\n  \n')).toEqual([t.values.emptyReason]);
  });
});

describe('toRequestDetailView', () => {
  const [multiline] = requestFixtures;

  it('상세가 보이는 값 여섯을 담는다 — 사유는 전문이다', () => {
    const view = toRequestDetailView(multiline as ApprovalRequest);

    expect(view.approvalRequestNo).toBe('SYNTH-REQ-001');
    expect(view.approvalTypeCode).toBe('GOODS_ISSUE_DISPOSAL');
    expect(view.requesterName).toBe('합성 상신자1');
    expect(view.requestedAtText).toBe('2026-08-06 14:20');
    expect(view.statusCode).toBe('SAMPLE-STATUS-OPEN');
    expect(view.reasonLines).toHaveLength(2);
  });

  it('상세가 나르는 값에 내부 번호가 없다 — 행 식별자조차 담지 않는다', () => {
    const view = toRequestDetailView(multiline as ApprovalRequest);

    expect(Object.keys(view).sort()).toEqual([
      'approvalRequestNo',
      'approvalTypeCode',
      'reasonLines',
      'requestedAtText',
      'requesterName',
      'statusCode',
    ]);
    expect(JSON.stringify(view)).not.toContain(String(multiline?.approvalRequestId));
    expect(JSON.stringify(view)).not.toContain(String(multiline?.requestedBy));
    expect(JSON.stringify(view)).not.toContain(String(multiline?.target.targetId));
  });

  it('대상과 결재 진행을 담지 않는다 — 각자 자기 구획이 있다', () => {
    const view = toRequestDetailView(multiline as ApprovalRequest);

    expect(JSON.stringify(view)).not.toContain(multiline?.target.displayName ?? '');
    expect(JSON.stringify(view)).not.toContain(multiline?.target.targetTypeCode ?? '');
  });

  it('이름이 비어 오면 대체 문구가 서고 번호가 서지 않는다', () => {
    const nameless = requestFixtures.find((request) => request.requestedByName === '');
    const view = toRequestDetailView(nameless as ApprovalRequest);

    expect(view.requesterName).toBe(t.values.unknownRequester);
    expect(JSON.stringify(view)).not.toContain(String(nameless?.requestedBy));
  });
});

/**
 * 확인 창이 다시 보이는 **대상 요약**. 오결재 방어의 마지막 자리다(계획 §13-2 셋째 방어).
 *
 * **승인 유형 코드가 미확정인 동안 이 화면에는 다른 유형의 요청이 섞여 온다**(`omf-mes#64`).
 * 목록 위 안내가 「유형과 사유로 확인하라」고 말하므로, 되돌릴 수 없는 확인 직전에 그
 * 확인 수단이 같은 자리에 다시 서야 한다.
 */
describe('toDecisionSubject', () => {
  const [multiline] = requestFixtures;

  it('확인 창이 다시 보일 다섯 값을 담는다', () => {
    const subject = toDecisionSubject(multiline as ApprovalRequest);

    expect(subject.approvalRequestNo).toBe('SYNTH-REQ-001');
    expect(subject.approvalTypeCode).toBe('GOODS_ISSUE_DISPOSAL');
    expect(subject.targetName).toBe('합성 대상 문서 가');
    expect(subject.requesterName).toBe('합성 상신자1');
    expect(subject.reasonFirstLine).toBe(FIRST_LINE_OF_MULTILINE_REASON);
  });

  /** 요약이라도 **번호를 나르지 않는다**(`omf-mes#44`) — 담지 않으면 창에서 샐 경로가 없다. */
  it('내부 번호를 담지 않는다', () => {
    const subject = toDecisionSubject(multiline as ApprovalRequest);

    expect(Object.keys(subject).sort()).toEqual([
      'approvalRequestNo',
      'approvalTypeCode',
      'reasonFirstLine',
      'requesterName',
      'targetName',
    ]);
    expect(JSON.stringify(subject)).not.toContain(String(multiline?.approvalRequestId));
    expect(JSON.stringify(subject)).not.toContain(String(multiline?.requestedBy));
    expect(JSON.stringify(subject)).not.toContain(String(multiline?.target.targetId));
  });

  /** 사유는 **첫 줄**이다 — 확인 창은 읽는 자리가 아니라 확인하는 자리라 전문이 오면 묻힌다. */
  it('사유는 첫 줄만 담고 둘째 줄을 담지 않는다', () => {
    const subject = toDecisionSubject(multiline as ApprovalRequest);

    expect(subject.reasonFirstLine).not.toContain(SECOND_LINE_OF_MULTILINE_REASON);
  });

  it('이름이 비어 오면 대체 문구가 서고 번호가 서지 않는다', () => {
    const nameless = requestFixtures.find((request) => request.requestedByName === '');
    const subject = toDecisionSubject(nameless as ApprovalRequest);

    expect(subject.requesterName).toBe(t.values.unknownRequester);
    expect(subject.targetName).toBe(t.values.unknownTarget);
    expect(JSON.stringify(subject)).not.toContain(String(nameless?.requestedBy));
    expect(JSON.stringify(subject)).not.toContain(String(nameless?.target.targetId));
  });

  /** 사유가 비어 와도 빈 칸을 내지 않는다 — 확인 창의 한 줄이 통째로 사라지면 안 된다. */
  it('사유가 비어 오면 그 사실을 적는다', () => {
    const blank = { ...(multiline as ApprovalRequest), reason: '\n  \n' };

    expect(toDecisionSubject(blank).reasonFirstLine).toBe(t.values.emptyReason);
  });
});

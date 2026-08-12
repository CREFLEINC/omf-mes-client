import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { requestFixtures } from './fixtures';
import { firstLineOf, formatDateTime, readableName, toRequestRow } from './types';
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
    expect(row.approvalTypeCode).toBe('SAMPLE-TYPE-A');
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

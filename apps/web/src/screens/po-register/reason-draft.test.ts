import { describe, expect, it } from 'vitest';

import {
  NO_BREAK_SPACE,
  firstLineOf,
  readReason,
  toApprovalRequest,
  toReasonLines,
  toVisibleLine,
} from './reason-draft';

describe('readReason', () => {
  /**
   * **막는 곳이 화면뿐이다.** 계약이 `minLength: 1`을 두었으나 **목이 공백만인 사유를 202로
   * 통과시킨다**(계획 §5.2.3 · 이번 회차 목 4021 재실측) — 통과하면 결재함 목록의 요약 자리가
   * 빈 채로 결재에 올라가고, 그 요청은 무엇에 대한 것인지 읽을 수 없다.
   */
  it.each(['', ' ', '   ', '\n', '\r\n', '\t\n '])('빈 값과 공백만(%j)은 보낼 수 없다', (raw) => {
    expect(readReason(raw)).toEqual({ kind: 'empty' });
  });

  it('앞뒤 공백을 떼고 보낼 값을 만든다', () => {
    expect(readReason('  초과 입하분 정산 발주  ')).toEqual({
      kind: 'ready',
      reason: '초과 입하분 정산 발주',
      firstLine: '초과 입하분 정산 발주',
    });
  });

  /** 줄바꿈은 유지한다 — 첫 줄이 요약 자리이고 나머지가 근거다(공유계약 A-12). */
  it('가운데 줄바꿈을 유지한다', () => {
    expect(readReason('첫 줄 요약\n\n둘째 문단 — 근거')).toEqual({
      kind: 'ready',
      reason: '첫 줄 요약\n\n둘째 문단 — 근거',
      firstLine: '첫 줄 요약',
    });
  });

  /** **길이를 화면이 정하지 않는다** — 계약이 정한 것은 `minLength: 1`뿐이다. */
  it('짧은 사유도 보낼 수 있다', () => {
    expect(readReason('정산')).toEqual({ kind: 'ready', reason: '정산', firstLine: '정산' });
  });
});

describe('firstLineOf', () => {
  it('첫 줄만 뽑는다', () => {
    expect(firstLineOf('첫 줄\n둘째 줄')).toBe('첫 줄');
  });

  /** 사유가 빈 줄로 시작하면 요약 자리가 이름 없는 줄이 된다 — 다듬은 값에서 뽑는다. */
  it('다듬은 값에서 첫 줄을 뽑는다', () => {
    expect(firstLineOf(' \n 실제 첫 줄 \n 둘째 ')).toBe('실제 첫 줄');
  });

  /** 붙여넣기로 들어오는 글이 실제로 CRLF다 — 캐리지 리턴이 남으면 요약 끝에 안 보이는 글자가 붙는다. */
  it('CRLF에서도 첫 줄만 뽑는다', () => {
    expect(firstLineOf('첫 줄\r\n둘째 줄')).toBe('첫 줄');
  });
});

describe('toApprovalRequest', () => {
  /**
   * **본문이 사유 하나다**(완료 조건 C29 · 착수 이슈 §6 ④).
   *
   * 계약의 `ApprovalRequestCreate`에 필드가 그것 하나라, 승인 유형·승인자·결재선을 함께 실으면
   * 계약 밖의 요청이 된다 — 승인 주체는 결재선 정의가 정하지 이 화면이 정하지 않는다.
   */
  it('본문이 사유 하나이고 키가 그것뿐이다', () => {
    const body = toApprovalRequest('  두 줄\n사유  ');

    expect(body).toEqual({ reason: '두 줄\n사유' });
    expect(Object.keys(body ?? {})).toEqual(['reason']);
  });

  it('공백만이면 본문을 만들지 않는다', () => {
    expect(toApprovalRequest('   ')).toBeNull();
  });
});

/**
 * 확인 창이 사유 **전문**을 그리는 데 쓰는 두 함수.
 *
 * 빈 줄과 들여쓴 줄은 HTML에서 접힌다 — 둘 다 「보이지 않게 되는」 자리라, 접히면 사용자가
 * 확인한 글자와 결재함에 실릴 글자가 갈린다.
 */
describe('toReasonLines · toVisibleLine', () => {
  /**
   * **상수 자신을 기대값으로 쓰는 고리를 끊는다**(사본 체크리스트 6번 · 리뷰 R-25).
   *
   * 아래 세 시험은 기대값에 `NO_BREAK_SPACE`를 그대로 쓰므로 **상수가 무엇이든 통과한다** —
   * 저장소의 「비가시 공백 정리」 한 번이 상수를 보통 공백으로 바꿔도 아무 감지기가 울지 않고,
   * 그 순간 `toVisibleLine`이 무동작이 되어 확인 창의 빈 줄·들여쓰기가 접힌다(되돌릴 수 없는
   * 조작의 마지막 확인 층에서 **본 글자와 보낼 글자가 갈린다**).
   *
   * 그래서 **코드포인트를 직접** 문다 — escape 표기·`export`와 함께 두 겹째 방어다
   * (전례 `disposal-issue/approval-progress-pane.test.tsx`와 같은 형태).
   */
  it('줄바꿈 없는 공백이 정말 U+00A0이다 — 보통 공백이 아니다', () => {
    expect(NO_BREAK_SPACE).toBe('\u00a0');
    expect(NO_BREAK_SPACE).not.toBe(' ');
    expect(NO_BREAK_SPACE.codePointAt(0)).toBe(0x00a0);
  });

  it('줄바꿈으로 가르고 CRLF도 같이 다룬다', () => {
    expect(toReasonLines('첫 줄\r\n둘째 줄\n\n넷째 줄')).toEqual([
      '첫 줄',
      '둘째 줄',
      '',
      '넷째 줄',
    ]);
  });

  it('빈 줄을 보이는 글자로 바꾼다', () => {
    expect(toVisibleLine('')).toBe(NO_BREAK_SPACE);
  });

  it('들여쓴 만큼만 보이는 공백으로 바꾼다', () => {
    expect(toVisibleLine('  들여쓴 줄')).toBe(`${NO_BREAK_SPACE.repeat(2)}들여쓴 줄`);
  });

  /** 줄 가운데·끝 공백은 바꾸지 않는다 — 전부 바꾸면 복사해 간 글에 보통 공백이 남지 않는다. */
  it('가운데 공백은 그대로 둔다', () => {
    expect(toVisibleLine('앞 뒤 사이')).toBe('앞 뒤 사이');
  });
});

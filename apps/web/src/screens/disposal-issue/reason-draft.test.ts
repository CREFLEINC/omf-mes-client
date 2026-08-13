import { describe, expect, it } from 'vitest';

import { firstLineOf, readReason, toApprovalRequest } from './reason-draft';

describe('readReason', () => {
  /**
   * **막는 곳이 화면뿐이다**(감지기 M56). 계약이 `minLength: 1`을 두었으나 **목이 공백만인 사유를
   * 202로 통과시킨다**(실측) — 통과하면 결재함 목록의 요약 자리가 빈 채로 결재에 올라간다.
   */
  it.each(['', ' ', '   ', '\n', '\t\n '])('빈 값과 공백만(%j)은 보낼 수 없다', (raw) => {
    expect(readReason(raw)).toEqual({ kind: 'empty' });
  });

  it('앞뒤 공백을 떼고 보낼 값을 만든다', () => {
    expect(readReason('  불량 판정분 폐기  ')).toEqual({
      kind: 'ready',
      reason: '불량 판정분 폐기',
      firstLine: '불량 판정분 폐기',
    });
  });

  /** 줄바꿈은 유지한다 — 첫 줄이 요약 자리이고 나머지가 근거다(공유계약 A-12). */
  it('가운데 줄바꿈을 유지한다', () => {
    const state = readReason('첫 줄 요약\n\n둘째 문단 — 근거');

    expect(state).toEqual({
      kind: 'ready',
      reason: '첫 줄 요약\n\n둘째 문단 — 근거',
      firstLine: '첫 줄 요약',
    });
  });

  /** **길이를 화면이 정하지 않는다**(승인 기록 §13-6 안 A) — 유도이지 강제가 아니다. */
  it('짧은 사유도 보낼 수 있다', () => {
    expect(readReason('폐기')).toEqual({ kind: 'ready', reason: '폐기', firstLine: '폐기' });
  });
});

describe('firstLineOf', () => {
  it('첫 줄만 뽑는다', () => {
    expect(firstLineOf('첫 줄\n둘째 줄')).toBe('첫 줄');
  });

  /** 사유 전문이 개행 문자로 시작하면 앞의 빈 줄이 첫 줄이 되는데, 보낼 값은 이미 다듬은 값이다. */
  it('다듬은 값에서 첫 줄을 뽑는다', () => {
    expect(firstLineOf(' \n 실제 첫 줄 \n 둘째 ')).toBe('실제 첫 줄');
  });

  it('CRLF에서도 첫 줄만 뽑는다', () => {
    expect(firstLineOf('첫 줄\r\n둘째 줄')).toBe('첫 줄');
  });
});

describe('toApprovalRequest', () => {
  /** 상신 본문은 **다듬은 사유 하나**다(감지기 M63) — 다른 필드를 함께 실으면 계약 밖이다. */
  it('본문이 사유 하나다', () => {
    expect(toApprovalRequest('  두 줄\n사유  ')).toEqual({ reason: '두 줄\n사유' });
  });

  it('공백만이면 본문을 만들지 않는다', () => {
    expect(toApprovalRequest('   ')).toBeNull();
  });
});

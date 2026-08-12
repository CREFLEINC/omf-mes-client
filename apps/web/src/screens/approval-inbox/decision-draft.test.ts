import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DECISION_COMMENT_FIELD,
  DECISION_KNOWN_FIELDS,
  decisionBlockedReason,
  toApproveBody,
  toRejectBody,
} from './decision-draft';

const t = messages.approvalInbox;

/**
 * 승인·반려 본문을 만드는 자리 하나 — **되돌릴 수 없는 요청의 몸통이 여기서 정해진다.**
 *
 * 두 조작의 규칙이 서로 다르다는 것이 이 파일 시험의 축이다. 「의견을 다듬어 싣는다」 같은
 * 넓은 잣대 하나로 재면 **승인 쪽의 「빈 키를 두지 않는다」가 통째로 빠진다** —
 * 좁은 규칙은 좁은 잣대로 잰다.
 */

describe('toApproveBody', () => {
  /**
   * 계약이 승인의 `requestBody` 자체를 선택으로 두고 `comment`도 선택으로 두었다.
   * 빈 문자열을 실으면 결재 기록에 **빈 의견이 남는다** — 「의견 없음」과 「빈 의견」은 다르다.
   */
  it('의견이 비면 comment 키 자체를 두지 않는다', () => {
    expect(toApproveBody('')).toEqual({});
    expect('comment' in toApproveBody('')).toBe(false);
  });

  it('공백만인 의견도 키를 두지 않는다', () => {
    expect(toApproveBody('   ')).toEqual({});
    expect(toApproveBody('\n\t ')).toEqual({});
  });

  /** 짝 방향 — 「늘 빈 객체」로도 위 둘이 통과하므로 차 있는 쪽을 함께 잰다. */
  it('의견이 차 있으면 다듬은 값을 싣는다', () => {
    expect(toApproveBody('합성 승인 의견')).toEqual({ comment: '합성 승인 의견' });
  });

  it('앞뒤 공백을 걷어 낸다', () => {
    expect(toApproveBody('  합성 승인 의견  ')).toEqual({ comment: '합성 승인 의견' });
  });

  /** 말 안의 공백은 사용자가 적은 그대로다 — 다듬는 것은 앞뒤뿐이다. */
  it('의견 가운데의 공백과 줄바꿈은 건드리지 않는다', () => {
    expect(toApproveBody(' 앞줄\n  뒷줄 ')).toEqual({ comment: '앞줄\n  뒷줄' });
  });
});

describe('toRejectBody', () => {
  /**
   * **목 서버가 공백만인 의견을 200으로 받는다**(계획 §6.3 실측). 계약은 `minLength: 1`을
   * 요구하지만 그 검사를 하지 않는 서버가 실재하므로 **막는 곳이 화면뿐이다.**
   * 여기서 통과시키면 반려 사유가 공백인 결재 기록이 남고, 상신자는 무엇을 고쳐야 하는지 모른다.
   */
  it('의견이 공백만이면 보낼 본문을 만들지 않는다', () => {
    expect(toRejectBody('   ')).toBeNull();
    expect(toRejectBody('\n\t')).toBeNull();
  });

  it('의견이 비면 보낼 본문을 만들지 않는다', () => {
    expect(toRejectBody('')).toBeNull();
  });

  it('의견이 차 있으면 다듬은 값을 필수 필드로 싣는다', () => {
    expect(toRejectBody('합성 반려 사유')).toEqual({ comment: '합성 반려 사유' });
  });

  it('앞뒤 공백을 걷어 낸 값을 싣는다', () => {
    expect(toRejectBody('  합성 반려 사유\n')).toEqual({ comment: '합성 반려 사유' });
  });
});

/**
 * 버튼이 잠기는 **첫째 겹**의 판정. 사유까지 함께 정하므로 화면은 이 값을 그리기만 한다.
 *
 * **왜 내 차례가 아닌지는 말하지 않는다.** 앞 단계가 안 끝난 것인지, 내가 승인자가 아닌 것인지,
 * 이미 끝난 요청인지 화면이 가를 근거가 응답에 없다(`isMyTurn` 하나뿐이다).
 */
describe('decisionBlockedReason', () => {
  it('내 차례가 아니면 승인과 반려가 모두 막히고 사유가 컨트롤 이름으로 시작한다', () => {
    expect(decisionBlockedReason('approve', { isMyTurn: false, comment: '합성 의견' })).toBe(
      t.decision.blockedNotMyTurn(t.decision.approve),
    );
    expect(decisionBlockedReason('reject', { isMyTurn: false, comment: '합성 의견' })).toBe(
      t.decision.blockedNotMyTurn(t.decision.reject),
    );
  });

  /** 내 차례가 아닌 것이 먼저다 — 의견까지 비었을 때 「의견을 적으라」고 하면 헛일을 시킨다. */
  it('내 차례가 아니고 의견도 비면 차례 사유를 낸다', () => {
    expect(decisionBlockedReason('reject', { isMyTurn: false, comment: '' })).toBe(
      t.decision.blockedNotMyTurn(t.decision.reject),
    );
  });

  it('내 차례면 승인은 의견이 비어도 열린다', () => {
    expect(decisionBlockedReason('approve', { isMyTurn: true, comment: '' })).toBeNull();
    expect(decisionBlockedReason('approve', { isMyTurn: true, comment: '   ' })).toBeNull();
  });

  it('내 차례여도 반려는 의견이 비면 막히고 사유가 다르다', () => {
    const reason = decisionBlockedReason('reject', { isMyTurn: true, comment: '' });

    expect(reason).toBe(t.decision.blockedNoComment(t.decision.reject));
    expect(reason).not.toBe(t.decision.blockedNotMyTurn(t.decision.reject));
  });

  it('공백만인 의견은 적지 않은 것과 같다', () => {
    expect(decisionBlockedReason('reject', { isMyTurn: true, comment: ' \n ' })).toBe(
      t.decision.blockedNoComment(t.decision.reject),
    );
  });

  it('내 차례이고 의견이 차 있으면 반려가 열린다', () => {
    expect(
      decisionBlockedReason('reject', { isMyTurn: true, comment: '합성 반려 사유' }),
    ).toBeNull();
  });
});

/**
 * 공통 쓰기 훅에 넘길 필드 이름. **화면에 그 입력칸이 실제로 있는 이름만** 담는다 —
 * 없는 이름을 담으면 그 필드의 서버 오류가 인라인으로 흘러가 어디에도 보이지 않는다.
 */
describe('DECISION_KNOWN_FIELDS', () => {
  it('의견 하나뿐이다', () => {
    expect(DECISION_KNOWN_FIELDS).toEqual([DECISION_COMMENT_FIELD]);
  });

  it('계약이 두 본문에 쓰는 이름과 같다', () => {
    expect(toRejectBody('합성 반려 사유')).toHaveProperty(DECISION_COMMENT_FIELD);
    expect(toApproveBody('합성 승인 의견')).toHaveProperty(DECISION_COMMENT_FIELD);
  });
});

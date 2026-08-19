import { describe, expect, it } from 'vitest';

import {
  CANCEL_FORM_FIELDS,
  CANCEL_REASON_FIELD,
  readCancelReason,
  toCancelRequest,
} from './cancel-reason-draft';

describe('readCancelReason', () => {
  it('친 글자가 있으면 보낼 수 있다', () => {
    expect(readCancelReason('수량을 잘못 올렸습니다')).toEqual({
      kind: 'ready',
      reason: '수량을 잘못 올렸습니다',
    });
  });

  it('빈 값은 보낼 수 없다', () => {
    expect(readCancelReason('')).toEqual({ kind: 'empty' });
  });

  /**
   * ⭐ **공백만은 빈 값과 같다.** 서버가 통과시키면 승인 기록에 **빈 이력**이 남는데, 이 화면의
   * 취소는 그 기록이 곧 이력이라 그때 「왜 취소했는가」에 아무도 답할 수 없다.
   */
  it('공백만은 빈 값과 같다', () => {
    expect(readCancelReason('   \n\t ')).toEqual({ kind: 'empty' });
  });

  it('앞뒤 공백을 다듬어 보낸다', () => {
    expect(readCancelReason('  사유  ')).toEqual({ kind: 'ready', reason: '사유' });
  });

  /* 가운데 줄바꿈은 뜻을 나른다 — 여러 줄로 근거를 적는 것이 실제 형태다. */
  it('가운데 줄바꿈은 그대로 둔다', () => {
    expect(readCancelReason(' 첫 줄\n둘째 줄 ')).toEqual({
      kind: 'ready',
      reason: '첫 줄\n둘째 줄',
    });
  });

  /**
   * ⛔ **최소 길이를 강제하지 않는다**(질의 Q3의 기본값). 글자 수를 화면이 정하면 그것도
   * 지어내는 것이다 — 유도는 자리표시·보조 문구가 맡는다.
   */
  it('한 글자짜리 사유도 막지 않는다', () => {
    expect(readCancelReason('가')).toEqual({ kind: 'ready', reason: '가' });
  });
});

describe('toCancelRequest', () => {
  /** 본문에 **사유 하나뿐**이다 — 다른 값을 함께 실으면 계약 밖의 요청이 된다. */
  it('다듬은 사유 하나만 담는다', () => {
    expect(toCancelRequest('  잘못 등록했습니다  ')).toEqual({ reason: '잘못 등록했습니다' });
  });

  /** **보낼 수 없으면 만들지 않는다** — 버튼 잠금이 뚫려도 빈 사유가 승인에 오르지 않는다. */
  it('빈 사유로는 본문을 만들지 않는다', () => {
    expect(toCancelRequest('   ')).toBeNull();
  });
});

describe('필드 이름', () => {
  /**
   * 서버가 준 필드 오류가 **사유 칸 옆에** 붙는 열쇠다. 화면이 쓰는 이름과 계약이 부르는 이름이
   * 갈리면 그 오류가 배너로 밀려나 사용자가 어느 칸을 고쳐야 하는지 알 수 없다.
   */
  it('계약이 정한 이름과 같다', () => {
    expect(CANCEL_REASON_FIELD).toBe('reason');
  });

  /** 이 화면이 소유한 입력칸은 **사유 하나뿐**이다 — 더 적으면 붙일 칸 없는 오류가 사라진다. */
  it('아는 필드는 사유 하나뿐이다', () => {
    expect(CANCEL_FORM_FIELDS).toEqual([CANCEL_REASON_FIELD]);
  });
});

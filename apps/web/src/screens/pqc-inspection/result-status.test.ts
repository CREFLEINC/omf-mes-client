import { describe, expect, it } from 'vitest';

import { RESULT_STATUS } from './queries';

/**
 * 검사 결과 상태값이 **계약이 정한 영문 코드**인지 잰다.
 *
 * ⭐ **왜 값 하나에 감지기를 두는가.** 계약이 이 칸을 `string` 으로 열어 두었다 — 표시명이
 * 한국어·베트남어 2개국어라 enum 으로 못박으면 화면이 표시명을 갖게 되기 때문이다(K-5).
 * 그래서 **값이 틀려도 타입 검사가 통과한다.** 실제로 2026-09-02 계약 개정 전의 한국어 값
 * (`작성중`·`확정`)이 그대로 남아 있었고, 게이트는 전부 초록이었다.
 *
 * ⛔ **그 사이 실서버는 저장과 확정을 모두 거절했다.** 그런데 이 화면은 오프라인 대비로
 *    큐에 담고 **담기는 순간 성공을 말하므로**, 검사자는 저장된 줄 알고 다음 LOT 으로
 *    넘어갔다 — 실패가 사람에게 닿지 않는 자리라 값 하나가 검사 기록을 통째로 잃게 한다.
 *
 * ⚠ 이 감지기가 막는 것은 「계약이 또 바뀌는 것」이 아니라 **한국어로 되돌아가는 것**이다.
 *   계약이 바뀌면 여기도 함께 고친다 — 그때 이 시험이 바뀐 사실을 드러내 준다.
 */
describe('검사 결과 상태값은 계약의 영문 코드다 — #1004', () => {
  it('임시 저장은 DRAFT 다', () => {
    expect(RESULT_STATUS.draft).toBe('DRAFT');
  });

  it('검사 확정은 CONFIRMED 다', () => {
    expect(RESULT_STATUS.confirmed).toBe('CONFIRMED');
  });

  it('한국어 표시명을 코드 자리에 두지 않는다', () => {
    /* 정규식이 아니라 «한글이 섞였는가» 로 잰다 — 어떤 한국어든 이 자리에 오면 안 된다. */
    const hasHangul = (value: string): boolean => /[가-힣]/u.test(value);

    expect(hasHangul(RESULT_STATUS.draft)).toBe(false);
    expect(hasHangul(RESULT_STATUS.confirmed)).toBe(false);
  });
});

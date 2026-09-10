import { describe, expect, it } from 'vitest';

import { toLoginOutcome } from './login-outcome';

/**
 * 실패를 셋으로 가르는 규칙(#1034).
 *
 * 재는 것은 **하나의 규율**이다 — 갈래마다 사용자가 할 조치가 다르므로, **엉뚱한 갈래에
 * 떨어지면 할 수 없는 일을 하게 된다.** 「로그인 정보 오류」는 서버가 401로 그렇게 답했을
 * 때만 나오고, 잠긴 계정은 서버 오류에 섞이지 않는다.
 */
describe('toLoginOutcome', () => {
  it('401은 로그인 정보 오류다', () => {
    expect(toLoginOutcome(401)).toEqual({ kind: 'credentials' });
  });

  /**
   * ⛔ **423을 서버 오류로 접지 않는다.** 접으면 「잠시 뒤 다시 시도하세요」와 「다시 시도」
   * 버튼이 서는데, 잠긴 계정에는 다시 보내도 같은 답이 온다.
   */
  it('423은 잠긴 계정이다', () => {
    expect(toLoginOutcome(423)).toEqual({ kind: 'locked' });
  });

  /**
   * ⛔ **401·423 말고는 어느 것도 그 둘이 되지 않는다.**
   *
   * 목록에 400(검증 실패)이 들어 있는 것이 이 회차의 결정이다 — 앞 회차는 서버가 준 오류
   * 목록을 그대로 그렸다. 화면이 서버 문구를 옮기면 규율(어느 칸도 지목하지 않는다)이
   * 서버 쪽 문구 수정 한 번에 깨진다.
   */
  it.each([400, 403, 404, 409, 422, 429, 500, 502, 503])('%i는 서버 오류다', (status) => {
    expect(toLoginOutcome(status)).toEqual({ kind: 'server' });
  });

  /**
   * ⭐ **200이 여기 오는 길이 있다** — 본문 없는 200이다(`queries.ts`의 `hasSession`).
   * 그때도 자격이 틀렸다고 말하지 않는다.
   */
  it('200이어도 자격이 틀렸다고 말하지 않는다', () => {
    expect(toLoginOutcome(200)).toEqual({ kind: 'server' });
  });
});

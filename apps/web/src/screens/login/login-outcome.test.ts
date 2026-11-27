import { describe, expect, it } from 'vitest';

import { toLoginOutcome } from './login-outcome';

/**
 * 실패를 둘로 가르는 규칙.
 *
 * 재는 것은 **하나의 규율**이다 — 갈래마다 사용자가 할 조치가 다르므로, **엉뚱한 갈래에
 * 떨어지면 할 수 없는 일을 하게 된다.** 「로그인 정보 오류」는 서버가 401로 그렇게 답했을
 * 때만 나온다.
 */
describe('toLoginOutcome', () => {
  it('401은 로그인 정보 오류다', () => {
    expect(toLoginOutcome(401)).toEqual({ kind: 'credentials' });
  });

  /**
   * ⛔ **401 말고는 어느 것도 「로그인 정보 오류」가 되지 않는다.**
   *
   * 423 도 목록에 있다 — 서버가 계정 잠금을 없애(서버 #1165) 계약에서 빠진 코드라, 예전 서버가
   * 그 답을 주더라도 따로 가르지 않는다.
   *
   * 목록에 400(검증 실패)이 들어 있는 것이 이 회차의 결정이다 — 앞 회차는 서버가 준 오류
   * 목록을 그대로 그렸다. 화면이 서버 문구를 옮기면 규율(어느 칸도 지목하지 않는다)이
   * 서버 쪽 문구 수정 한 번에 깨진다.
   */
  it.each([400, 403, 404, 409, 422, 423, 429, 500, 502, 503])('%i는 서버 오류다', (status) => {
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

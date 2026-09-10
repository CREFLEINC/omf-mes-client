import { describe, expect, it } from 'vitest';

import { toLoginOutcome } from './login-outcome';

/**
 * 실패를 둘로 가르는 규칙(#1034).
 *
 * 재는 것은 **하나의 규율**이다 — 「로그인 정보 오류」는 **서버가 401로 그렇게 답했을 때만**
 * 나온다. 그 문장은 자격이 틀렸다는 **주장**이라, 근거 없이 붙이면 사용자가 맞는 자격을
 * 의심하며 시도를 되풀이하다 계정을 잠근다.
 */
describe('toLoginOutcome', () => {
  it('401은 로그인 정보 오류다', () => {
    expect(toLoginOutcome(401)).toEqual({ kind: 'credentials' });
  });

  /**
   * ⛔ **401 말고는 어느 것도 로그인 정보 오류가 되지 않는다.**
   *
   * 목록에 423(잠김)과 400(검증 실패)이 들어 있는 것이 이 회차의 결정이다 — 앞 회차는 둘을
   * 따로 그렸다. 둘 다 **사용자가 값을 고쳐 풀 수 없는** 일이라 서버 쪽으로 접었다.
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

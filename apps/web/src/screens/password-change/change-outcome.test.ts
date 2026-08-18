import { describe, expect, it } from 'vitest';

import { toChangeOutcome } from './change-outcome';
import { currentMismatchBody, mismatchBodyWithAttemptsHint } from './fixtures';

/** 응답이 없어 상태 코드를 붙일 수 없는 자리 — 시험도 제품과 같은 값을 쓴다. */
const NO_STATUS = 0;

describe('toChangeOutcome — 응답을 화면 갈래로 옮긴다', () => {
  /**
   * 401은 **상태 코드로만** 판정한다. 계약이 이 자리에 코드 enum을 주지 않았고 본문은 일반
   * 오류 형태라, 본문 문구로 가르면 서버가 말을 다듬을 때마다 갈래가 깨진다.
   */
  it('401이면 현재 비밀번호 불일치다', () => {
    expect(toChangeOutcome(401, currentMismatchBody())).toEqual({ kind: 'currentMismatch' });
  });

  /**
   * ⛔ **남은 시도 횟수를 읽지 않는다.** 계약이 이 경로에 그 필드를 두지 않았고(응답 본문은
   * `ErrorResponse`뿐이다) 이 화면은 계정을 잠그지 않는다. 서버가 실어 보내더라도 갈래에
   * 담기지 않아야 한다 — 담으면 「언젠가 쓸 값」이라는 잘못된 기대가 화면에 남는다.
   */
  it('401 본문에 남은 횟수가 실려 와도 갈래에 담지 않는다', () => {
    const outcome = toChangeOutcome(401, mismatchBodyWithAttemptsHint());

    expect(outcome).toEqual({ kind: 'currentMismatch' });
    expect(JSON.stringify(outcome)).not.toContain('remaining');
  });

  /** 응답이 없었던 자리. 상태 코드를 갖지 않으므로 코드로 가르는 갈래에 걸리지 않는다. */
  it('상태 코드가 없으면 통신 실패다', () => {
    expect(toChangeOutcome(NO_STATUS, null)).toEqual({ kind: 'network' });
  });

  /**
   * ⛔ **모르는 응답을 「현재 비밀번호가 틀렸다」로 꾸미지 않는다.** 그 문장은 자격이 틀렸다는
   * **주장**이라, 서버 장애에 붙이면 사용자가 맞는 비밀번호를 의심하며 시도를 되풀이한다.
   */
  it('가를 근거가 없으면 상태 코드를 안고 unknown으로 둔다', () => {
    expect(toChangeOutcome(500, null)).toEqual({ kind: 'unknown', status: 500 });
    expect(toChangeOutcome(403, currentMismatchBody())).toEqual({ kind: 'unknown', status: 403 });
  });

  /**
   * 400(서버 검증 실패)은 **다음 회차의 갈래**다. 그때까지는 뭉뚱그리되 **자격 문구로 꾸미지
   * 않는다** — 지금 400을 401과 같은 갈래로 두면 사용자가 고쳐야 할 값을 비밀번호로 오해한다.
   */
  it('400은 아직 자기 갈래가 없어 unknown으로 둔다', () => {
    expect(toChangeOutcome(400, currentMismatchBody())).toEqual({ kind: 'unknown', status: 400 });
  });
});

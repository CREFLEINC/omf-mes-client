import { describe, expect, it } from 'vitest';

import { errorResponseBody, loginFailureBody } from './fixtures';
import { toLoginOutcome } from './login-outcome';

/**
 * 상태 코드 → 화면 갈래. **본문 형태를 신뢰하지 않는다** — 서버·목·프록시가 계약과 다른 본문을
 * 주는 일이 실제로 있고, 그때 갈래를 잘못 고르면 화면이 **사실이 아닌 말**을 한다.
 */

describe('toLoginOutcome — 401', () => {
  it('아이디·비밀번호 불일치로 가른다', () => {
    expect(toLoginOutcome(401, loginFailureBody())).toEqual({ kind: 'mismatch' });
  });

  it('남은 시도 횟수가 실려 오면 갈래에 담는다', () => {
    const outcome = toLoginOutcome(401, loginFailureBody({ remainingAttempts: 3 }));

    expect(outcome).toEqual({ kind: 'mismatch', remainingAttempts: 3 });
  });

  /**
   * ⭐ **없는 계정에는 오지 않는 값이다**(계약이 선택 필드로 두고 그렇게 적었다).
   * 그것이 계정 존재를 드러내지 않으려는 설계이므로 **화면이 기본값을 메우면 안 된다.**
   */
  it('남은 시도 횟수가 없으면 키 자체를 두지 않는다', () => {
    /*
     * `toStrictEqual`이라야 「키가 없다」와 「키가 `undefined`다」를 가른다 — `toEqual`은 둘을
     * 같게 본다. 그리는 쪽이 `in` 검사나 전개로 값을 다룰 때 그 차이가 드러난다.
     */
    expect(toLoginOutcome(401, loginFailureBody())).toStrictEqual({ kind: 'mismatch' });
  });

  it('본문이 계약 형태가 아니어도 갈래는 그대로다', () => {
    expect(toLoginOutcome(401, null)).toEqual({ kind: 'mismatch' });
    expect(toLoginOutcome(401, '문자열 본문')).toEqual({ kind: 'mismatch' });
  });

  /**
   * ⛔ **숫자가 아닌 값을 숫자로 받아들이지 않는다.** 본문 형태를 신뢰하지 않는 규율이 이
   * 필드에도 걸린다 — 문자열이 그대로 실리면 화면이 「(2/5)」 자리에 이상한 글자를 그린다.
   *
   * 정수가 아닌 수와 음수도 버린다. 「1.5번 남았습니다」·「-2번 남았습니다」는 사용자에게
   * 아무 뜻도 없고, 지어낸 값보다 **말하지 않는 편**이 낫다.
   */
  it.each([
    ['문자열', '3'],
    ['참거짓', true],
    ['널', null],
    ['소수', 2.5],
    ['음수', -1],
    ['숫자가 아님', Number.NaN],
  ])('남은 시도 횟수가 %s이면 담지 않는다', (_label, value) => {
    const outcome = toLoginOutcome(401, {
      message: '합성 실패 문구입니다.',
      remainingAttempts: value,
    });

    expect(outcome).toStrictEqual({ kind: 'mismatch' });
  });

  it('0은 담는다 — 값의 뜻을 판정하는 것은 그리는 쪽이다', () => {
    expect(toLoginOutcome(401, { message: '합성 실패 문구입니다.', remainingAttempts: 0 })).toEqual(
      {
        kind: 'mismatch',
        remainingAttempts: 0,
      },
    );
  });
});

describe('toLoginOutcome — 423', () => {
  /**
   * **상태 코드로만 판정한다.** 계약이 423 본문에 코드 enum을 주지 않았다 — 본문 코드로 가르면
   * 서버가 문구만 바꿔도 갈래가 깨진다. 목 서버도 이 자리에 일반 오류 본문을 준다(실측).
   */
  it('잠긴 계정으로 가른다', () => {
    expect(toLoginOutcome(423, errorResponseBody())).toEqual({ kind: 'locked' });
    expect(toLoginOutcome(423, null)).toEqual({ kind: 'locked' });
  });
});

describe('toLoginOutcome — 400', () => {
  it('계약 형태의 오류 목록을 그대로 담는다', () => {
    const body = errorResponseBody();

    expect(toLoginOutcome(400, body)).toEqual({ kind: 'invalid', errors: body.errors });
  });

  /**
   * **모르는 본문을 「검증 실패」로 꾸미지 않는다.** 오류 목록이 없으면 화면이 낼 문장이 없고,
   * 빈 목록을 담으면 아래층이 「말할 것이 있다」고 읽어 빈 배너를 세운다.
   */
  it('계약 형태가 아니면 모르는 갈래로 떨어진다', () => {
    expect(toLoginOutcome(400, { message: '무엇인가' })).toEqual({ kind: 'unknown', status: 400 });
    expect(toLoginOutcome(400, { errors: [] })).toEqual({ kind: 'unknown', status: 400 });
    expect(toLoginOutcome(400, { errors: [{ 잘못된: '모양' }] })).toEqual({
      kind: 'unknown',
      status: 400,
    });
  });
});

describe('toLoginOutcome — 그 밖의 상태 코드', () => {
  it('상태 코드를 안은 채 모르는 갈래가 된다', () => {
    expect(toLoginOutcome(500, null)).toEqual({ kind: 'unknown', status: 500 });
    expect(toLoginOutcome(403, errorResponseBody())).toEqual({ kind: 'unknown', status: 403 });
  });

  /**
   * ⛔ **401·423을 제외한 어떤 코드도 「맞지 않습니다」가 되지 않는다.** 뭉뚱그린 실패 문구는
   * 자격이 틀렸다는 **주장**이라, 서버 장애나 권한 문제에 그 문장을 붙이면 사용자가 맞는
   * 자격을 의심하며 시도를 되풀이하다 계정을 잠근다.
   */
  it('불일치 갈래는 401에서만 나온다', () => {
    const others = [400, 403, 404, 409, 423, 500, 502, 503];

    for (const status of others) {
      expect(toLoginOutcome(status, loginFailureBody()).kind).not.toBe('mismatch');
    }
  });
});

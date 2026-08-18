import { describe, expect, it } from 'vitest';

import {
  PASSWORD_FORM_FIELDS,
  boundField,
  splitInvalidErrors,
  toChangeOutcome,
} from './change-outcome';
import {
  currentMismatchBody,
  errorItemsBody,
  fieldErrorBody,
  mismatchBodyWithAttemptsHint,
} from './fixtures';

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
   * ⛔ **400을 401과 같은 갈래로 두지 않는다.** 고쳐야 할 값을 비밀번호로 오해하게 만든다 —
   * 400은 이 회차부터 자기 갈래(`invalid`)를 갖는다. 화면 수준 오류만 실린 400도 마찬가지다.
   */
  it('400은 자격 갈래로 꾸미지 않는다', () => {
    expect(toChangeOutcome(400, currentMismatchBody()).kind).not.toBe('currentMismatch');
    expect(toChangeOutcome(400, currentMismatchBody()).kind).toBe('invalid');
  });
});

describe('boundField — 그 진술이 어느 칸에 매였는가', () => {
  /**
   * 서버가 **현재 비밀번호**를 두고 한 말이다. 그 칸의 값이 바뀔 때만 낡는다 — 새 비밀번호를
   * 고쳤다고 「현재 비밀번호가 맞지 않는다」가 거짓이 되지는 않는다.
   */
  it('현재 비밀번호 불일치는 그 칸에 매인다', () => {
    expect(boundField({ kind: 'currentMismatch' })).toBe('currentPassword');
  });

  /**
   * ⭐ **통신 실패는 어느 칸에도 매이지 않는다.** 새 비밀번호를 고쳐도 「응답이 오지 않았다」는
   * 사실은 그대로 낡는다 — 칸에 매인 것처럼 다루면, 배너가 서는 회차에 새 비밀번호만 고친
   * 사용자에게 **지나간 통신 실패 배너가 남는다.**
   */
  it('통신 실패와 가를 근거 없음은 어느 칸에도 매이지 않는다', () => {
    /* 양성 먼저 — 매이는 갈래가 실제로 있음을 잡은 뒤 매이지 않음을 잰다. */
    expect(boundField({ kind: 'currentMismatch' })).not.toBeNull();

    expect(boundField({ kind: 'network' })).toBeNull();
    expect(boundField({ kind: 'unknown', status: 500 })).toBeNull();
  });
});

describe('toChangeOutcome — 서버가 준 검증 오류(400)', () => {
  it('400에 쓸 만한 오류 목록이 있으면 그 목록을 안고 온다', () => {
    const body = fieldErrorBody('currentPassword');

    expect(toChangeOutcome(400, body)).toEqual({ kind: 'invalid', errors: body.errors });
  });

  /**
   * **본문 형태를 신뢰하지 않고 좁힌다.** 서버·목·프록시가 계약과 다른 본문을 주는 일이 실제로
   * 있고, 그때 형태를 믿으면 화면이 빈 배너를 세우거나 `undefined`를 그린다.
   */
  it('오류 목록이 없거나 형태가 다르면 가를 근거 없음으로 둔다', () => {
    /* 양성 먼저 — 쓸 만한 목록이 실제로 갈래를 만드는 것을 잡은 뒤 아닌 것들을 잰다. */
    expect(toChangeOutcome(400, fieldErrorBody()).kind).toBe('invalid');

    expect(toChangeOutcome(400, { errors: [] })).toEqual({ kind: 'unknown', status: 400 });
    expect(toChangeOutcome(400, { errors: [{ scope: 'nope' }] })).toEqual({
      kind: 'unknown',
      status: 400,
    });
    expect(toChangeOutcome(400, null)).toEqual({ kind: 'unknown', status: 400 });
  });
});

describe('splitInvalidErrors — 인라인과 배너를 가른다', () => {
  /**
   * ⭐ **입력칸이 있는 이름만 인라인으로 내린다**(전례 `approval-route`의 `ROUTE_FORM_FIELDS`
   * 규율). 입력칸 없는 이름을 인라인으로 흘리면 그 오류가 **어디에도 보이지 않는다.**
   */
  it('입력칸이 있는 이름은 그 칸에 붙는다', () => {
    const split = splitInvalidErrors(
      fieldErrorBody('newPassword', '합성 칸 오류 문구입니다.').errors,
    );

    expect(split.fieldErrors).toEqual({ newPassword: '합성 칸 오류 문구입니다.' });
    expect(split.bannerLines).toEqual([]);
  });

  it('모르는 이름은 배너로 올라간다 — 어디에도 안 보이는 경로가 없다', () => {
    const split = splitInvalidErrors(
      fieldErrorBody('confirmPassword', '합성 모르는 칸 문구입니다.').errors,
    );

    expect(split.fieldErrors).toEqual({});
    expect(split.bannerLines).toEqual(['합성 모르는 칸 문구입니다.']);
  });

  it('화면 수준 오류는 배너로 올라간다', () => {
    const split = splitInvalidErrors(currentMismatchBody().errors);

    expect(split.fieldErrors).toEqual({});
    expect(split.bannerLines).toEqual(['합성 실패 문구입니다.']);
  });

  /**
   * ⛔ **빈·공백 문구는 잇기 전에 항목별로 버린다**(v1.2 체크리스트). 잇고 나서 검사하면 항목이
   * 둘 다 비었을 때 이음쇠 공백 하나가 남아 빠져나가고, 인라인 쪽에서는 **빈 오류가 칸을 붉히기만**
   * 하고 아무 말도 하지 않는다.
   */
  it('빈 문구와 공백 문구는 인라인에도 배너에도 서지 않는다', () => {
    const split = splitInvalidErrors(
      errorItemsBody([
        { scope: 'field', field: 'newPassword', code: 'SYN_CODE_C', message: '   ' },
        { scope: 'screen', code: 'SYN_CODE_D', message: '' },
        { scope: 'screen', code: 'SYN_CODE_E', message: '합성 남은 문구입니다.' },
      ]).errors,
    );

    expect(split.fieldErrors).toEqual({});
    expect(split.bannerLines).toEqual(['합성 남은 문구입니다.']);
  });

  /** 한 칸에는 한 문장이다 — 같은 칸을 두 번 지목하면 먼저 온 것이 선다. */
  it('같은 칸을 두 번 지목하면 첫 문장만 선다', () => {
    const split = splitInvalidErrors(
      errorItemsBody([
        {
          scope: 'field',
          field: 'currentPassword',
          code: 'SYN_CODE_F',
          message: '합성 첫 문구입니다.',
        },
        {
          scope: 'field',
          field: 'currentPassword',
          code: 'SYN_CODE_G',
          message: '합성 둘째 문구입니다.',
        },
      ]).errors,
    );

    expect(split.fieldErrors).toEqual({ currentPassword: '합성 첫 문구입니다.' });
    expect(split.bannerLines).toEqual([]);
  });

  /**
   * ⛔ **확인 칸은 서버가 모르는 칸이다** — 요청 본문에 실리지 않으므로(T2) 서버가 그 이름으로
   * 오류를 줄 이유가 없고, 준다면 그것은 화면이 아는 이름이 아니다. 인라인으로 내리면 사용자가
   * 서버에 보내지도 않은 값을 고치게 된다.
   */
  it('확인 칸은 인라인 대상이 아니다', () => {
    expect(PASSWORD_FORM_FIELDS).toEqual(['currentPassword', 'newPassword']);
    expect(PASSWORD_FORM_FIELDS).not.toContain('confirmPassword');
  });
});

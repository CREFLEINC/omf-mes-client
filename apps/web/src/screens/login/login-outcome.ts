import type { ErrorItem } from '@omf-mes/api-client';

/**
 * 로그인 응답의 화면 갈래.
 *
 * **이 슬라이스가 오류를 직접 가른다** — 공통 정규화(`normalizeApiError`)를 쓰지 않는다.
 * 그쪽은 401 본문의 `remainingAttempts`를 버리고(계약 형태가 `ErrorResponse`가 아니라
 * 살아남는 것이 `message`뿐이다) 423 본문은 `ErrorResponse`라 **필드 오류처럼 분류한다.**
 * 남은 시도 횟수와 잠긴 계정은 이 화면에만 있는 갈래이므로 여기서 가르는 것이 맞다
 * (`patterns/`에 특정 화면 분기를 두지 않는다 — `work-splitting.md`).
 */
export type LoginOutcome =
  /**
   * 401 — 자격이 맞지 않는다.
   *
   * ⭐ `remainingAttempts`는 **있는 계정에만 온다**(계약이 선택 필드로 두고 그렇게 적었다).
   * 그것이 계정 존재를 드러내지 않으려는 설계이므로 **없을 때 기본값을 메우지 않는다.**
   */
  | { kind: 'mismatch'; remainingAttempts?: number }
  /** 423 — 실패가 쌓여 잠겼다. 스스로 풀 수 없다 */
  | { kind: 'locked' }
  /** 400 — 서버가 준 오류 목록이 있다 */
  | { kind: 'invalid'; errors: ErrorItem[] }
  /** 응답 자체가 없었다. 상태 코드를 갖지 않는다 */
  | { kind: 'network' }
  /**
   * 가를 근거가 없는 응답. 상태 코드를 안고 간다.
   *
   * ⭐ **잡은 값이 있으면 함께 안고 간다**(`cause`). 이 갈래에는 응답이 아니라 **이 앱의 코드가
   * 던진 것**이 떨어지는 길이 있다(성공 되먹임의 예외 — `queries.ts`). 원인을 여기서 버리면
   * 그 결함이 「서버가 이상하다」로 보이고 어디에도 흔적이 남지 않는다.
   *
   * ⛔ **그리지 않는다.** 배너는 `kind`만 본다 — 사용자에게 내부 오류를 보이지 않는다.
   */
  | { kind: 'unknown'; status: number; cause?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 계약의 오류 항목인가. **본문 형태를 신뢰하지 않고 좁힌다** — 서버·목·프록시가 계약과 다른
 * 본문을 주는 일이 실제로 있고, 그때 형태를 믿으면 화면이 빈 문구를 배너로 세운다.
 */
const isErrorItem = (value: unknown): value is ErrorItem =>
  isRecord(value) &&
  (value.scope === 'field' || value.scope === 'screen') &&
  typeof value.code === 'string' &&
  typeof value.message === 'string';

/**
 * 남은 시도 횟수를 꺼낸다. 꺼낼 수 없으면 `undefined` — **지어내지 않는다.**
 *
 * 0 이상의 **정수만** 받는다. 문자열·소수·음수·`NaN`이 그대로 실리면 화면이 「(2/5)」 자리에
 * 뜻 없는 글자를 그린다. 값의 **뜻**(0이면 무엇인가·임계값을 넘으면 무엇인가)을 판정하는 것은
 * 그리는 쪽이고, 여기서는 **숫자인가**까지만 본다.
 */
const readRemainingAttempts = (body: unknown): number | undefined => {
  if (!isRecord(body)) return undefined;

  const value = body.remainingAttempts;

  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
};

const readErrorItems = (body: unknown): ErrorItem[] | null => {
  if (!isRecord(body) || !Array.isArray(body.errors)) return null;
  if (body.errors.length === 0 || !body.errors.every(isErrorItem)) return null;

  return body.errors;
};

/**
 * 상태 코드와 본문에서 화면 갈래를 고른다.
 *
 * **401과 423은 상태 코드로만 판정한다.** 계약이 423 본문에 코드 enum을 주지 않았고(설명이
 * 「실패가 쌓여 잠겼다」뿐) 목 서버도 그 자리에 일반 오류 본문을 준다(실측). 본문 코드로
 * 가르면 서버가 문구만 바꿔도 갈래가 깨진다.
 *
 * ⛔ **모르는 응답을 「자격이 맞지 않는다」로 꾸미지 않는다.** 그 문장은 자격이 틀렸다는
 * **주장**이라, 서버 장애나 권한 문제에 붙이면 사용자가 맞는 자격을 의심하며 시도를 되풀이하다
 * 계정을 잠근다. 가를 근거가 없으면 `unknown`으로 두고 상태 코드를 안고 간다.
 */
export const toLoginOutcome = (status: number, body: unknown): LoginOutcome => {
  if (status === 401) {
    const remainingAttempts = readRemainingAttempts(body);

    /* 값이 없으면 **키 자체를 두지 않는다** — 「모른다」와 「0이다」가 같은 모양이 되지 않게. */
    return remainingAttempts === undefined
      ? { kind: 'mismatch' }
      : { kind: 'mismatch', remainingAttempts };
  }

  if (status === 423) return { kind: 'locked' };

  if (status === 400) {
    const errors = readErrorItems(body);

    /* 오류 목록이 없으면 낼 문장이 없다 — 빈 목록을 담으면 아래층이 빈 배너를 세운다. */
    return errors === null ? { kind: 'unknown', status } : { kind: 'invalid', errors };
  }

  return { kind: 'unknown', status };
};

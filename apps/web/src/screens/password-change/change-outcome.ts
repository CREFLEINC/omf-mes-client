import type { ErrorItem } from '@omf-mes/api-client';

import type { PasswordFieldErrors, PasswordFieldName } from './password-draft';

/**
 * 비밀번호 변경 응답의 화면 갈래.
 *
 * **이 슬라이스가 오류를 직접 가른다** — 공통 정규화(`normalizeApiError`)를 쓰지 않는다.
 * 그쪽은 실패를 `ApiError`로 정규화하는데, 이 화면은 401을 **특정 칸의 인라인**으로 옮겨야 하고
 * 무효화할 조회 캐시도 없다(전례 `login/`과 같은 판단이다).
 *
 * ⛔ **잠금 갈래가 없다.** 전례에는 423(잠긴 계정)과 남은 시도 횟수가 있지만 이 화면은 몇 번을
 * 틀려도 계정을 잠그지 않는다(스펙 §5-2) — 이미 인증된 본인이고, 잠그면 자가 복구 경로가 없다.
 * 계약도 이 경로에 401·400·204만 두었다.
 */
export type ChangeOutcome =
  /** 401 — 현재 비밀번호가 맞지 않는다. ⛔ 잠그지 않으므로 실을 것이 없다 */
  | { kind: 'currentMismatch' }
  /** 400 — 서버가 준 오류 목록이 있다. **실행 전 거부**라 값이 바뀐 것은 없다 */
  | { kind: 'invalid'; errors: ErrorItem[] }
  /** 응답 자체가 없었다. 상태 코드를 갖지 않는다 */
  | { kind: 'network' }
  /**
   * 가를 근거가 없는 응답. 상태 코드를 안고 간다.
   *
   * ⚠ 400이라도 **쓸 만한 오류 목록이 없으면** 여기 떨어진다 — 낼 문장이 없는 `invalid`는
   * 빈 배너를 세울 뿐이다. 그때는 공용 안내와 「다시 시도」가 선다.
   *
   * ⚠ **`cause`를 두지 않는다.** 전례(`login/login-outcome.ts`)는 성공 되먹임이 던질 수 있어
   * 잡은 값을 실었는데, 이 화면의 성공 되먹임에는 던지는 자리가 없다(실측 — `queries.ts`).
   * 쓰지 않는 것을 정의째 남기지 않는다.
   */
  | { kind: 'unknown'; status: number };

/** 응답이 없어 상태 코드를 붙일 수 없는 자리. 상태로 분기하는 갈래에 걸리지 않게 한다. */
export const NO_HTTP_STATUS = 0;

/**
 * 이 갈래가 **어느 칸에 매인 진술**인가. 매이지 않았으면 `null`.
 *
 * ⭐ **걷는 범위를 갈래의 성격이 정한다.** 서버가 특정 칸을 두고 한 말은 **그 칸의 값이 바뀔 때만**
 * 낡는다 — 새 비밀번호를 고쳤다고 「현재 비밀번호가 맞지 않는다」가 거짓이 되지는 않는다. 반대로
 * 통신 실패·가를 근거 없음은 **어느 칸에도 매이지 않은 화면 수준 진술**이라 무엇을 고쳐도 낡는다.
 *
 * 이 구분을 화면 밖으로 꺼내 둔 이유는 **잴 수 있게 하기 위해서다** — 칸에 매이지 않은 갈래를
 * 화면으로만 재려면 배너가 선 상태를 거쳐야 하고, 그러면 규칙과 표시가 한 시험에 묶인다.
 *
 * ⚠ **한 칸만 돌려준다 — 그 가정이 성립하는 갈래가 401 하나이기 때문이다.** 계약의 `errors`는
 * 배열이라 400은 여러 칸을 함께 지목할 수 있는데, 그 갈래는 **어느 칸을 고쳐도 걷는다**(`null`)
 * — 서버가 판정한 것은 보낸 본문 전체이고, 그중 무엇을 고쳐도 그 판정은 낡기 때문이다.
 * 여러 칸에 매인 진술을 「그 칸들 중 하나가 바뀔 때만」으로 다루려면 이 반환형을 집합으로
 * 넓혀야 한다 — 그런 갈래가 생기는 회차에 함께 고친다.
 */
export const boundField = (outcome: ChangeOutcome): PasswordFieldName | null =>
  outcome.kind === 'currentMismatch' ? 'currentPassword' : null;

/**
 * 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 **인라인으로 낼지 배너로 올릴지** 가르는 기준이다.
 *
 * **요청 본문에 실리는 두 칸만 담는다**(전례 `approval-route`의 `ROUTE_FORM_FIELDS` 규율).
 * 확인 재입력은 서버로 나가지 않으므로 서버가 그 이름으로 오류를 줄 이유가 없고, 준다 해도 화면이
 * 아는 이름이 아니다 — 인라인으로 내리면 사용자가 **보내지도 않은 값**을 고치게 된다.
 * ⛔ 여기 담기지 않은 이름을 인라인으로 흘리면 그 오류는 **어디에도 보이지 않는다.**
 */
export const PASSWORD_FORM_FIELDS: readonly string[] = ['currentPassword', 'newPassword'];

/** 서버가 준 오류 목록을 화면의 두 자리로 가른 결과. */
export interface InvalidErrorSplit {
  /** 입력칸이 있는 이름의 오류 — 그 칸에 인라인으로 선다 */
  fieldErrors: PasswordFieldErrors;
  /** 칸에 붙일 수 없는 오류 — 배너로 올라간다 */
  bannerLines: string[];
}

const isFormField = (field: string | undefined): field is PasswordFieldName =>
  field !== undefined && PASSWORD_FORM_FIELDS.includes(field);

/**
 * 서버가 준 오류를 **인라인 몫과 배너 몫으로 가른다.**
 *
 * ⛔ **빈·공백 문구는 잇기 전에 항목별로 버린다**(v1.2 체크리스트). 잇고 나서 검사하면 항목이
 * 둘 다 비었을 때 이음쇠 공백 하나가 남아 빠져나가고, 인라인 쪽에서는 **빈 오류가 칸을 붉히기만**
 * 하고 아무 말도 하지 않는다.
 *
 * **한 칸에는 한 문장이다** — 같은 칸을 두 번 지목하면 먼저 온 것이 선다.
 */
export const splitInvalidErrors = (errors: ErrorItem[]): InvalidErrorSplit => {
  const fieldErrors: PasswordFieldErrors = {};
  const bannerLines: string[] = [];

  for (const item of errors) {
    const message = item.message.trim();

    if (message === '') continue;

    if (item.scope === 'field' && isFormField(item.field)) {
      fieldErrors[item.field] ??= message;
      continue;
    }

    bannerLines.push(message);
  }

  return { fieldErrors, bannerLines };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 계약의 오류 항목인가. **본문 형태를 신뢰하지 않고 좁힌다** — 서버·목·프록시가 계약과 다른
 * 본문을 주는 일이 실제로 있고, 그때 형태를 믿으면 화면이 `undefined`를 그린다.
 */
const isErrorItem = (value: unknown): value is ErrorItem =>
  isRecord(value) &&
  (value.scope === 'field' || value.scope === 'screen') &&
  typeof value.code === 'string' &&
  typeof value.message === 'string';

const readErrorItems = (body: unknown): ErrorItem[] | null => {
  if (!isRecord(body) || !Array.isArray(body.errors)) return null;
  if (body.errors.length === 0 || !body.errors.every(isErrorItem)) return null;

  return body.errors;
};

/**
 * 상태 코드에서 화면 갈래를 고른다.
 *
 * **401은 상태 코드로만 판정한다.** 계약이 이 자리에 코드 enum을 주지 않았고 본문은 일반 오류
 * 형태뿐이라(실측), 본문 문구로 가르면 서버가 말을 다듬을 때 갈래가 깨진다.
 *
 * ⛔ **401 본문은 읽지 않는다.** 특히 남은 시도 횟수 — 계약이 이 경로에 그 필드를 두지 않았고
 * 이 화면에는 그 개념이 없다. 없는 값을 읽는 코드는 「언젠가 온다」는 잘못된 기대를 남긴다.
 * 본문을 읽는 자리는 **400 하나뿐**이며, 그때도 형태를 좁혀서 읽는다.
 */
export const toChangeOutcome = (status: number, body: unknown): ChangeOutcome => {
  if (status === NO_HTTP_STATUS) return { kind: 'network' };

  if (status === 401) return { kind: 'currentMismatch' };

  if (status === 400) {
    const errors = readErrorItems(body);

    /* 낼 문장이 없으면 `invalid`로 두지 않는다 — 아래층이 빈 배너를 세운다. */
    return errors === null ? { kind: 'unknown', status } : { kind: 'invalid', errors };
  }

  return { kind: 'unknown', status };
};

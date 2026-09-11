import type { components } from './generated/api';

export type ErrorItem = components['schemas']['ErrorItem'];

/**
 * `ConflictResponse.conflictCause`에서 이름을 땄지만 `ShipmentConflictResponse`·
 * `StockReinstatementConflictResponse`의 `conflictCause`도 같은 값 집합이고 이제 셋 다
 * 필수다(통보 221 — 「서버는 공용 충돌 봉투를 사용하므로 항상 이 키를 싣는다」). 세 스키마가
 * 이름만 다른 같은 축이라 아래 `isConflictCause`가 스키마 이름을 가리지 않고 값만 본다.
 */
export type ConflictCause = components['schemas']['ConflictResponse']['conflictCause'];

/**
 * 화면이 분기하는 오류 5갈래 — 공유계약 G-1.
 * conflict(409)는 재로드하면 풀리고, stateLocked는 재로드해도 안 풀린다.
 * 이 구분을 화면마다 다시 판정하지 않도록 여기서 한 번만 정규화한다.
 *
 * network는 응답 자체가 없는 실패라 상태 코드를 갖지 않는다 — 다른 변형과 구분해야
 * 화면이 「연결을 확인하세요」와 「서버가 거부했습니다」를 다르게 안내할 수 있다.
 */
export type ApiError =
  | {
      kind: 'conflict';
      cause: ConflictCause;
      /**
       * 업무 사유 코드 — `ALREADY_REINSTATED` 처럼 **다시 불러도 안 풀리는** 것이 있다.
       *
       * ⭐ `cause` 와 «다른 축»이다. `cause` 는 「누가 먼저 손댔는가」(사용자·ERP·워커)이고
       * 이것은 「무엇이 어긋났는가」다. 서버가 공용 충돌 봉투에 둘을 함께 싣는데(통보 221)
       * 여기서 코드를 버리면 화면은 원인만 보고 「다른 사용자가 먼저 수정했습니다」로 안내한다 —
       * 이미 재등록이 끝난 건에 그 말을 하면 사용자는 새로고침을 되풀이한다.
       */
      code?: string;
      message: string;
      currentLotStatusCode?: string;
    }
  | { kind: 'stateLocked'; errors: ErrorItem[] }
  | { kind: 'validation'; errors: ErrorItem[] }
  | { kind: 'http'; status: number; code?: string; message?: string; currentLotStatusCode?: string }
  | { kind: 'network' };

/**
 * fetch 자체가 실패했을 때(오프라인·DNS·CORS). 응답이 없어 상태 코드가 없다.
 * 값에 변화가 없으므로 매번 만들지 않고 하나를 공유한다.
 */
export const NETWORK_ERROR: ApiError = { kind: 'network' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const CONFLICT_CAUSES: readonly ConflictCause[] = ['user', 'erpSync', 'workerLease'];

const isConflictCause = (value: unknown): value is ConflictCause =>
  typeof value === 'string' && CONFLICT_CAUSES.includes(value as ConflictCause);

/**
 * 로그인 외 API가 「세션이 없다」고 답하는 상태 코드 — README 인증 공통 규칙 · 대응표 P0
 * 「세션 인증」. `POST /app/sessions`가 내린 `omf_session` 쿠키가 없거나 유효하지 않을 때
 * 481건 전부가 이 코드로 답한다.
 */
const HTTP_UNAUTHORIZED = 401;

/**
 * **잡은 값이 「세션이 끊겼다」인가** — 이 판정은 여기 한 곳뿐이다.
 *
 * 401은 입력을 고치라는 말이 아니라 「다시 로그인하라」는 말이라 `validation`과는 다른
 * 조치가 필요한데, 몸체 모양만 보면 `errors[]`를 가진 여느 400과 같아 보인다(아래
 * `normalizeApiError`가 몸체보다 상태 코드를 먼저 보는 이유). 화면·패턴마다 `status === 401`을
 * 다시 비교하게 두지 않으려고 그 판정을 여기 하나로 묶는다.
 *
 * ⛔ **로그인 자체의 401은 이 함수가 볼 대상이 아니다.** 그 401은 공용 `ErrorResponse`가
 * 아니라 `LoginFailure`이고(README), 로그인 화면은 `normalizeApiError`를 거치지 않고 상태
 * 코드로 직접 판정한다(`screens/login/login-outcome.ts`) — 여기서 같은 값을 다시 판정하면
 * 두 판정이 어긋날 자리가 생긴다.
 */
export const isUnauthenticated = (error: ApiError): boolean =>
  error.kind === 'http' && error.status === HTTP_UNAUTHORIZED;

/**
 * **기다리면 풀리는 상태 코드인가** — 408 요청 시간초과 · 429 요청 과다 · 5xx 서버 오류.
 *
 * 서버가 「지금은 못 받는다」고 말한 것이지 「이것은 안 된다」고 판정한 것이 아니다. 이 구분을
 * 오프라인 큐가 쓴다(`patterns/outbox-policy`) — 앞엣것은 큐에 남기고 뒤엣것만 내린다.
 *
 * ⛔ **이 판정을 다른 곳에 다시 쓰지 않는다.** 정규화와 큐가 서로 다른 기준으로 「일시적」을
 * 판정하면 한쪽만 고쳐졌을 때 조용히 어긋난다.
 */
export const isTransientStatus = (status: number): boolean =>
  status >= 500 || status === 429 || status === 408;

const isErrorItem = (value: unknown): value is ErrorItem =>
  isRecord(value) &&
  (value.scope === 'field' || value.scope === 'screen') &&
  typeof value.code === 'string' &&
  typeof value.message === 'string';

export const normalizeApiError = (status: number, body: unknown): ApiError => {
  const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
  const currentLotStatusCode =
    isRecord(body) &&
    typeof body.currentLotStatusCode === 'string' &&
    body.currentLotStatusCode.trim() !== ''
      ? body.currentLotStatusCode
      : undefined;

  if (status === 409 && isRecord(body) && isConflictCause(body.conflictCause)) {
    return {
      kind: 'conflict',
      cause: body.conflictCause,
      /* 원인과 함께 **코드도 남긴다** — 위 `code` 주석 참고. 화면이 둘 다 보고 갈라야 한다. */
      ...(code === undefined ? {} : { code }),
      message: typeof body.message === 'string' ? body.message : '',
      ...(currentLotStatusCode === undefined ? {} : { currentLotStatusCode }),
    };
  }

  /*
   * ⛔ **401도 몸체 모양과 무관하게 먼저 갈래를 정한다** — 대응표 P0 「세션 인증」.
   *
   * 로그인 외 API는 세션 쿠키가 없거나 유효하지 않으면 401 `ErrorResponse`(`errors[]`)를
   * 반환한다(README 인증 공통 규칙). 그 몸이 우연히 필드 오류 목록과 같은 모양이라 아래
   * `errors[]` 판정에 맡기면 `validation`으로 접히는데, 그러면 화면이 「입력을 고치세요」를
   * 안내한다 — 실제로 고칠 입력은 없고 다시 로그인해야 풀린다. #789가 5xx·429·408에 세운
   * 원칙(봉투보다 상태 코드가 먼저다)과 같은 이유로, 401도 몸체보다 상태 코드를 먼저 본다.
   *
   * `kind: 'http'`로 남기는 것은 기존과 같다 — 여기서 갈래를 새로 만들면(예: `unauthenticated`)
   * 화면마다 있는 `switch (error.kind)`가 전부 새 갈래를 받아야 한다. 상태 코드 판정은
   * `isUnauthenticated`로 이미 한 곳에 있으니 모양은 그대로 두고 분류만 바로잡는다.
   */
  if (status === HTTP_UNAUTHORIZED) {
    const message =
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : isRecord(body) && Array.isArray(body.errors) && isErrorItem(body.errors[0])
          ? body.errors[0].message
          : undefined;

    return {
      kind: 'http',
      status,
      ...(code === undefined ? {} : { code }),
      ...(message === undefined ? {} : { message }),
      ...(currentLotStatusCode === undefined ? {} : { currentLotStatusCode }),
    };
  }

  /*
   * ⛔ **봉투보다 상태 코드가 먼저다** — #789.
   *
   * 서버가 5xx·429·408 을 계약 오류 봉투(`errors[]`)에 담아 보내면, 모양만 보고 `validation`
   * 으로 접는 순간 상태 코드가 버려진다. 그러면 오프라인 큐가 「서버가 거부했다」로 판정해
   * 항목을 내리는데, 그 시점의 화면은 이미 「저장했습니다」를 띄우고 입력을 비운 뒤라
   * **작업자가 친 값을 되돌릴 방법이 없다.**
   *
   * 계약은 오류 봉투를 400·401·403·404·409·413·422·423 에만 두고 **5xx·429·408 응답은 한 건도
   * 정의하지 않았다**(실측 2026-09-04 · 계약 7벌 · 응답 정의 1,305건). 그래서 이 앞세움으로
   * 갈래가 바뀌는 계약 응답은 없다 — 계약 밖의 응답만 `http` 로 남는다.
   */
  if (
    !isTransientStatus(status) &&
    isRecord(body) &&
    Array.isArray(body.errors) &&
    body.errors.every(isErrorItem)
  ) {
    const errors = body.errors;
    if (errors.length > 0) {
      return errors.some((error) => error.code === 'STATE_LOCKED')
        ? { kind: 'stateLocked', errors }
        : { kind: 'validation', errors };
    }
  }

  // 계약 형태가 아니어도 서버가 message를 줬다면 그것이 사용자에게 남은 유일한 단서다.
  if (isRecord(body) && typeof body.message === 'string') {
    return {
      kind: 'http',
      status,
      ...(code === undefined ? {} : { code }),
      message: body.message,
      ...(currentLotStatusCode === undefined ? {} : { currentLotStatusCode }),
    };
  }

  return {
    kind: 'http',
    status,
    ...(code === undefined ? {} : { code }),
    ...(currentLotStatusCode === undefined ? {} : { currentLotStatusCode }),
  };
};

import type { components } from './generated/api';

export type ErrorItem = components['schemas']['ErrorItem'];
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
      message: typeof body.message === 'string' ? body.message : '',
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

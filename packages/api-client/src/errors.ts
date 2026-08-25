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
  | { kind: 'http'; status: number; message?: string; currentLotStatusCode?: string }
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

const isErrorItem = (value: unknown): value is ErrorItem =>
  isRecord(value) &&
  (value.scope === 'field' || value.scope === 'screen') &&
  typeof value.code === 'string' &&
  typeof value.message === 'string';

export const normalizeApiError = (status: number, body: unknown): ApiError => {
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

  if (isRecord(body) && Array.isArray(body.errors) && body.errors.every(isErrorItem)) {
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
      message: body.message,
      ...(currentLotStatusCode === undefined ? {} : { currentLotStatusCode }),
    };
  }

  return {
    kind: 'http',
    status,
    ...(currentLotStatusCode === undefined ? {} : { currentLotStatusCode }),
  };
};

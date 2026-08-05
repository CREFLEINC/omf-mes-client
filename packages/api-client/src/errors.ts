import type { components } from './generated/api';

export type ErrorItem = components['schemas']['ErrorItem'];
export type ConflictCause = components['schemas']['ConflictResponse']['conflictCause'];

/**
 * 화면이 분기하는 오류 4갈래 — 공유계약 G-1.
 * conflict(409)는 재로드하면 풀리고, stateLocked는 재로드해도 안 풀린다.
 * 이 구분을 화면마다 다시 판정하지 않도록 여기서 한 번만 정규화한다.
 */
export type ApiError =
  | { kind: 'conflict'; cause: ConflictCause; message: string }
  | { kind: 'stateLocked'; errors: ErrorItem[] }
  | { kind: 'validation'; errors: ErrorItem[] }
  | { kind: 'http'; status: number };

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
  if (status === 409 && isRecord(body) && isConflictCause(body.conflictCause)) {
    return {
      kind: 'conflict',
      cause: body.conflictCause,
      message: typeof body.message === 'string' ? body.message : '',
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

  return { kind: 'http', status };
};

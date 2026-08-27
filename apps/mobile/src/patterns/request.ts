import { NETWORK_ERROR, normalizeApiError, type ApiError } from '@omf-mes/api-client';

/**
 * openapi-fetch 호출의 반환 형태. HTTP 오류는 던지지 않고 error에 담겨 오고,
 * fetch 자체의 실패만 예외로 올라온다.
 */
export interface ApiCallResult<TData> {
  data?: TData;
  error?: unknown;
  response: Response;
}

/** HTTP 응답이 없었음을 나타내는 자리 — 상태 코드로 분기하는 화면이 어느 갈래에도 걸리지 않게 한다. */
const NO_HTTP_STATUS = 0;

/** 던지는 값은 Error 하위 클래스여야 하고, TanStack Query도 오류 타입을 Error로 둔다. */
export class ApiRequestError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError, options?: ErrorOptions) {
    super(`API 요청 실패 (${apiError.kind})`, options);
    this.name = 'ApiRequestError';
    this.apiError = apiError;
  }
}

/**
 * 요청 실행과 오류 변환의 유일한 지점.
 * 이 함수를 거치지 않은 호출은 화면마다 다른 실패 처리를 만든다.
 */
export const runRequest = async <TData>(
  call: () => Promise<ApiCallResult<TData>>,
): Promise<TData> => {
  let result: ApiCallResult<TData>;

  try {
    result = await call();
  } catch (cause) {
    // 응답이 없는 실패다. 상태 코드가 없으므로 http로 뭉뚱그리지 않는다.
    throw new ApiRequestError(NETWORK_ERROR, { cause });
  }

  if (!result.response.ok) {
    throw new ApiRequestError(normalizeApiError(result.response.status, result.error));
  }

  return result.data as TData;
};

/**
 * 요청 경로 밖에서 생긴 오류(렌더 중 예외 등)는 network로 다루지 않는다 —
 * 원인을 연결 문제로 오인시키면 사용자가 할 수 없는 조치를 하게 된다.
 */
export const toApiError = (error: unknown): ApiError =>
  error instanceof ApiRequestError ? error.apiError : { kind: 'http', status: NO_HTTP_STATUS };

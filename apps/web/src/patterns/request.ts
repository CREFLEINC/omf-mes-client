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

/**
 * 정규화된 오류를 실은 예외. 던지는 값은 Error 하위 클래스여야 하고(팀 TypeScript 규칙),
 * TanStack Query가 기본으로 Error를 오류 타입으로 두므로 그 계약과도 맞는다.
 */
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
    /*
     * ⛔ **이미 정규화된 실패를 연결 문제로 덮지 않는다.** 요청을 만들면서 「보낼 수 없다」고
     * 판정한 실패(예: 낙관적 잠금 토큰 없음)가 여기로 올라오는데, 그것을 network 로 바꾸면
     * 사용자는 **할 수 없는 조치**(연결 확인·재시도)를 하게 된다 — 실제로는 화면이 스스로
     * 멈춘 것이고 풀 방법이 따로 있다.
     */
    if (cause instanceof ApiRequestError) throw cause;

    // 응답이 없는 실패다. 상태 코드가 없으므로 http로 뭉뚱그리지 않는다.
    throw new ApiRequestError(NETWORK_ERROR, { cause });
  }

  if (!result.response.ok) {
    throw new ApiRequestError(normalizeApiError(result.response.status, result.error));
  }

  // 본문 없는 200(사용 중지 등)에서는 data가 undefined이며 그 자체가 정상 결과다.
  // 호출부는 그런 요청을 runRequest<void>로 부른다.
  return result.data as TData;
};

/**
 * 잡은 값에서 정규화 오류를 꺼낸다. 캐시·훅이 돌려주는 오류는 타입이 unknown이라
 * 화면마다 좁히기를 반복하지 않도록 여기서 한 번만 다룬다.
 *
 * 요청 경로 밖에서 생긴 오류(렌더 중 예외 등)는 network로 다루지 않는다 —
 * 원인을 연결 문제로 오인시키면 사용자가 할 수 없는 조치를 하게 된다.
 */
export const toApiError = (error: unknown): ApiError =>
  error instanceof ApiRequestError ? error.apiError : { kind: 'http', status: NO_HTTP_STATUS };

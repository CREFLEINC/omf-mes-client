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
  /**
   * 정규화 **전**의 HTTP 상태. 응답이 없었으면 `undefined` 다.
   *
   * ⭐ **`apiError` 에서 사라지는 값이라 여기 남긴다.** 서버가 4xx 를 계약 오류 봉투
   * (`errors[]`)에 담아 보내면 정규화가 그것을 `validation`·`stateLocked` 로 접으면서
   * 상태 코드를 버린다(401·5xx·429·408 만 앞세워 지킨다). 그래서 「403 이면 남의 것」 같은
   * 판정이 **한 번도 서지 못한 채** 조용히 죽어 있었다(리뷰 지적 · #999).
   *
   * ⛔ **이것으로 갈래를 새로 만들지 않는다.** 화면의 `switch (error.kind)` 는 그대로다 —
   *    상태 코드가 꼭 필요한 자리만 이 값을 «덧대어» 본다.
   */
  readonly httpStatus: number | undefined;

  constructor(apiError: ApiError, options?: ErrorOptions & { httpStatus?: number }) {
    super(`API 요청 실패 (${apiError.kind})`, options);
    this.name = 'ApiRequestError';
    this.apiError = apiError;
    this.httpStatus = options?.httpStatus;
  }
}

/**
 * 요청 실행과 오류 변환의 유일한 지점. **응답을 통째로** 돌려준다.
 *
 * 헤더까지 봐야 하는 호출이 이것을 쓴다 — 응답으로만 오는 값(낙관적 잠금 토큰 등)이 있고,
 * 그 값이 **어느 리소스의 것인지**가 중요할 때는 경로별 보관소에서 꺼내는 것으로 부족하다.
 * 실패 처리는 `runRequest` 와 한 몸이라 여기 한 곳에 둔다.
 */
export const runRequestWithResponse = async <TData>(
  call: () => Promise<ApiCallResult<TData>>,
): Promise<{ data: TData; response: Response }> => {
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
    throw new ApiRequestError(normalizeApiError(result.response.status, result.error), {
      httpStatus: result.response.status,
    });
  }

  // 본문 없는 200(사용 중지 등)에서는 data가 undefined이며 그 자체가 정상 결과다.
  // 호출부는 그런 요청을 runRequest<void>로 부른다.
  return { data: result.data as TData, response: result.response };
};

/**
 * 요청 실행과 오류 변환의 유일한 지점.
 * 이 함수를 거치지 않은 호출은 화면마다 다른 실패 처리를 만든다.
 */
export const runRequest = async <TData>(
  call: () => Promise<ApiCallResult<TData>>,
): Promise<TData> => (await runRequestWithResponse(call)).data;

/**
 * 잡은 값에서 정규화 오류를 꺼낸다. 캐시·훅이 돌려주는 오류는 타입이 unknown이라
 * 화면마다 좁히기를 반복하지 않도록 여기서 한 번만 다룬다.
 *
 * 요청 경로 밖에서 생긴 오류(렌더 중 예외 등)는 network로 다루지 않는다 —
 * 원인을 연결 문제로 오인시키면 사용자가 할 수 없는 조치를 하게 된다.
 */
export const toApiError = (error: unknown): ApiError =>
  error instanceof ApiRequestError ? error.apiError : { kind: 'http', status: NO_HTTP_STATUS };

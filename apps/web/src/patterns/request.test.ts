import { describe, expect, it } from 'vitest';

import { ApiRequestError, runRequest, toApiError } from './request';

const okResponse = (): Response => new Response(null, { status: 200 });
const errorResponse = (status: number): Response => new Response(null, { status });

describe('runRequest', () => {
  it('성공하면 응답 데이터를 그대로 돌려준다', async () => {
    // patterns는 리소스 이름을 알지 않는다 — 스텁 본문도 특정 리소스의 형태를 쓰지 않는다.
    const data = await runRequest(async () => ({
      data: { id: 1001 },
      response: okResponse(),
    }));

    expect(data).toEqual({ id: 1001 });
  });

  it('본문 없는 200도 성공으로 다룬다 — 사용 중지처럼 결과 본문이 없는 요청이 있다', async () => {
    const data = await runRequest<void>(async () => ({ response: okResponse() }));

    expect(data).toBeUndefined();
  });

  it('400 오류 본문을 validation으로 정규화해 던진다', async () => {
    const call = async () => ({
      error: {
        errors: [
          { scope: 'field' as const, field: 'code', code: 'REQUIRED', message: '필수 입력입니다' },
        ],
      },
      response: errorResponse(400),
    });

    await expect(runRequest(call)).rejects.toMatchObject({
      apiError: {
        kind: 'validation',
        errors: [{ field: 'code', message: '필수 입력입니다' }],
      },
    });
  });

  it('409 충돌 본문을 conflict로 정규화해 던진다', async () => {
    const call = async () => ({
      error: { conflictCause: 'user' as const, message: '이미 갱신됐습니다' },
      response: errorResponse(409),
    });

    await expect(runRequest(call)).rejects.toMatchObject({
      apiError: { kind: 'conflict', cause: 'user' },
    });
  });

  it('fetch 자체가 실패하면 network로 바꿔 던지고 원인을 cause로 보존한다', async () => {
    const cause = new TypeError('Failed to fetch');
    const call = async (): Promise<never> => {
      throw cause;
    };

    await expect(runRequest(call)).rejects.toMatchObject({
      apiError: { kind: 'network' },
      cause,
    });
  });

  it('던지는 값은 Error의 하위 클래스다 — 문자열이나 평범한 객체를 던지지 않는다', async () => {
    const call = async () => ({ error: undefined, response: errorResponse(500) });

    const thrown = await runRequest(call).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toBeInstanceOf(ApiRequestError);
  });
});

describe('toApiError', () => {
  it('ApiRequestError에서 정규화된 오류를 꺼낸다', () => {
    const error = new ApiRequestError({ kind: 'http', status: 403 });

    expect(toApiError(error)).toEqual({ kind: 'http', status: 403 });
  });

  it('요청 경로 밖에서 생긴 오류는 network로 다루지 않고 http로 남긴다 — 원인을 오프라인으로 오인하지 않는다', () => {
    expect(toApiError(new Error('렌더 중 예외'))).toEqual({ kind: 'http', status: 0 });
    expect(toApiError('문자열')).toEqual({ kind: 'http', status: 0 });
  });
});

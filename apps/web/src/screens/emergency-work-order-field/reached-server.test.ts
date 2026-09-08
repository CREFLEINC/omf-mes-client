import { NETWORK_ERROR, normalizeApiError } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { reachedServer } from './reached-server';

const failedWith = (error: unknown) => ({ isSuccess: false, isError: true, error });

describe('reachedServer', () => {
  it('성공하면 닿은 것이다', () => {
    expect(reachedServer({ isSuccess: true, isError: false, error: null })).toBe(true);
  });

  it('아직 답이 없으면 모른다 — 머리띠가 아무 말도 하지 않게 한다', () => {
    expect(reachedServer({ isSuccess: false, isError: false, error: null })).toBeUndefined();
  });

  it('응답이 없는 실패만 「닿지 못했다」다', () => {
    expect(reachedServer(failedWith(new ApiRequestError(NETWORK_ERROR)))).toBe(false);
  });

  /*
   * 이 이슈(#883)가 잡은 자리다. 실서버가 로그인을 요구하며 401 을 내렸는데 머리띠가
   * 「오프라인」으로 떴다 — 서버는 답을 보냈으므로 닿은 것이다.
   */
  it.each([401, 403, 404, 500, 503])('서버가 %d 로 답했으면 닿은 것이다', (status) => {
    const apiError = normalizeApiError(status, {
      errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '로그인이 필요합니다.' }],
    });

    expect(reachedServer(failedWith(new ApiRequestError(apiError)))).toBe(true);
  });

  it('요청 경로 밖의 오류는 모른다 — 틀린 안심을 주지 않는다', () => {
    expect(reachedServer(failedWith(new Error('렌더 중 예외')))).toBeUndefined();
  });
});

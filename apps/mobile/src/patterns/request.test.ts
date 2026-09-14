import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { noteServerAnswered, noteServerSilent, useServerReachable } from './online-status';
import { ApiRequestError, runRequest, type ApiCallResult } from './request';

/*
 * 연결 기록은 모듈 하나에 있고 공용 설정이 회차마다 되돌린다. 이 파일은 그 기록이 요청
 * 하나로 어떻게 바뀌는지를 재므로, 되돌린 뒤의 값에서 시작하는지 여기서 못박는다.
 */
beforeEach(() => {
  noteServerAnswered();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

const reachable = (): boolean => renderHook(() => useServerReachable()).result.current;

const answered = <T>(status: number, data: T): (() => Promise<ApiCallResult<T>>) => {
  const response = new Response(null, { status });

  return () => Promise.resolve({ data, response } as ApiCallResult<T>);
};

describe('요청이 남기는 연결 기록', () => {
  /* 못 닿는 사정은 online-status.ts 에 적어 두었다. */
  it('응답이 아예 없으면 닿지 못한 것으로 적는다', async () => {
    await expect(
      runRequest(() => Promise.reject(new TypeError('Failed to fetch'))),
    ).rejects.toBeInstanceOf(ApiRequestError);

    expect(reachable()).toBe(false);
  });

  /*
   * 오류 응답도 답이다. 서버가 받았다는 뜻이라 연결은 살아 있다 - 그것을 오프라인으로
   * 보이면 작업자가 망을 고치러 가는데, 고칠 것은 망이 아니다.
   *
   * 닿지 못한 자리에서 시작한다. 참에서 시작해 참을 재면 오류 응답에 아무것도 적지 않는
   * 코드도 통과한다 - 그 갈래가 이 화면이 지키려는 바로 그것이다.
   */
  it('오류 응답은 닿은 것으로 적는다', async () => {
    noteServerSilent();
    expect(reachable()).toBe(false);

    await expect(runRequest(answered(401, null))).rejects.toBeInstanceOf(ApiRequestError);

    expect(reachable()).toBe(true);
  });

  it('닿지 못한 뒤에 답이 오면 도로 닿은 것으로 적는다', async () => {
    await expect(
      runRequest(() => Promise.reject(new TypeError('Failed to fetch'))),
    ).rejects.toBeInstanceOf(ApiRequestError);
    expect(reachable()).toBe(false);

    await expect(runRequest(answered(200, { ok: true }))).resolves.toEqual({ ok: true });

    expect(reachable()).toBe(true);
  });
});

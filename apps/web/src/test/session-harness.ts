import type { Session } from '../patterns/session';

import { jsonResponse, type StubFetch, type StubRoute } from './api-harness';

/**
 * 세션 조회를 시험이 쥐는 자리.
 *
 * ⭐ **화면을 세우는 시험은 거의 다 이 조회를 지난다.** 세션 판정이 앱 전체 앞에 서기
 * 때문이다(`patterns/session`) — 회차마다 스텁을 손으로 적으면 「이 시험이 무엇을 재는가」보다
 * 준비가 길어진다.
 */

/**
 * ⚠ **합성값이다** — 계약의 예시값(`1001`·`hong.gd`·`홍길동`)을 쓰지 않는다(공개 저장소 경계).
 * 전례가 `app/layout.test.tsx`에 있고 같은 값을 쓴다.
 */
export const SYNTHETIC_SESSION: Session = {
  userId: 8101,
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 가',
  scopes: [{ businessUnitId: 8301, plantId: 8401 }],
};

const CURRENT_SESSION_PATH = '/app/sessions/current';

const isCurrentSession = (request: Request, method: string): boolean =>
  request.method === method && new URL(request.url).pathname.endsWith(CURRENT_SESSION_PATH);

/** 로그인된 채로 시작하는 회차. */
export const signedInRoute = (session: Session = SYNTHETIC_SESSION): StubRoute => ({
  match: (request) => isCurrentSession(request, 'GET'),
  respond: () => jsonResponse(session),
});

/**
 * 로그인하지 않은 회차.
 *
 * ⭐ **401은 실패가 아니라 답이다** — 판정은 `anonymous`로 떨어지고 「다시 시도」가 서지 않는다.
 */
export const signedOutRoute = (): StubRoute => ({
  match: (request) => isCurrentSession(request, 'GET'),
  respond: () => jsonResponse({ code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }, { status: 401 }),
});

/** 물어봤는데 답을 못 받은 회차 — 판정은 `unknown`이다. */
export const sessionUnavailableRoute = (status = 500): StubRoute => ({
  match: (request) => isCurrentSession(request, 'GET'),
  respond: () => jsonResponse({ code: 'SERVER_ERROR', message: '서버 오류' }, { status }),
});

/** 로그아웃 요청. 기본은 성공(204)이다. */
export const signOutRoute = (status = 204): StubRoute => ({
  match: (request) => isCurrentSession(request, 'DELETE'),
  respond: () =>
    status === 204
      ? new Response(null, { status })
      : jsonResponse({ code: 'SERVER_ERROR', message: '서버 오류' }, { status }),
});

/**
 * 세션 스텁을 **앞에 세우고** 나머지는 시험이 준 스텁에 넘긴다.
 *
 * ⛔ **넘길 곳이 없으면 던진다** — 하네스와 같은 규율이다(`createStubFetch`). 스텁을 빠뜨린
 * 시험이 「조회 실패」 경로를 도는 것처럼 통과하면 안 된다.
 */
export const withSessionStub =
  (route: StubRoute, rest?: StubFetch): StubFetch =>
  async (request: Request): Promise<Response> => {
    if (route.match(request)) return route.respond(request);

    if (rest === undefined) {
      throw new Error(`요청 스텁이 없습니다: ${request.method} ${request.url}`);
    }

    return rest(request);
  };

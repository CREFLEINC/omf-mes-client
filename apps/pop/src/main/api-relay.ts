/**
 * API 중계 — **요청을 브라우저 엔진 «대신» 셸이 보낸다.**
 *
 * ## 왜 필요한가
 *
 * 화면 주소가 `pop://app` 이라 백엔드는 언제나 «다른 출처» 다. 브라우저 엔진은 다른 출처의
 * 응답을 읽어도 되는지 서버에 확인하는데, 백엔드가 그 표시를 붙이지 않으면 서버가 멀쩡히
 * 200·401 을 돌려주는데도 화면은 아무것도 읽지 못한다(실측 2026-09-12: `curl` 은 401 을
 * 받는데 같은 요청이 화면에서는 `Failed to fetch`).
 *
 * ⭐ **모바일이 같은 사정을 같은 방식으로 풀었다**(`apps/mobile/capacitor.config.ts` ·
 *    `CAP_NATIVE_HTTP`). 「백엔드가 CORS 응답 헤더를 주지 않아 WebView 의 fetch 로는 닿지
 *    않는다 — 네이티브 요청에는 동일 출처 정책이 걸리지 않는다」와 글자 그대로 같은 문제다.
 *
 * ⭐ **개발 서버의 `/api` 프록시와 같은 구조다.** 화면은 자기 주소(`pop://app/api/...`)로만
 *    부르고 실제 통신은 셸이 한다 — 개발과 설치본이 같은 주소를 부르게 되는 것도 이득이다.
 *
 * ⛔ **접근 규칙을 끄지 않는다.** 렌더러의 `webSecurity` 는 그대로 켜져 있고, 브라우저의
 *    검사를 «통과시키는» 것이 아니라 검사가 애초에 없는 자리로 요청을 옮기는 것이다.
 *
 * ⚠ **기본은 꺼짐이다** — 모바일 스위치와 같다. `POP_API_TARGET` 을 주고 구운 설치본에서만
 *   서고, 주지 않으면 지금까지처럼 화면이 절대 주소를 그대로 부른다.
 *
 * 판단은 전부 여기 있고 `index.ts` 는 배선만 한다 — 그래야 Electron 없이 잴 수 있다.
 */

/** 백엔드로 넘길 경로의 접두. **슬래시까지가 접두다** — `/apiary.html` 을 넘기지 않는다. */
export const API_PREFIX = '/api/';

/**
 * 중계가 실어 보내지 **않는** 헤더.
 *
 * ⚠ 화면 «안»의 사정이라 서버가 알 필요가 없다. `pop://app` 이 출처로 그대로 나가면 서버가
 *   알 수 없는 출처로 보고 거절할 수 있다 — 중계는 셸 자신의 요청이다.
 *
 * ⚠ `content-length` 도 뗀다. 본문을 다시 실어 보내므로 원래 값과 어긋날 수 있고, 길이는
 *   보내는 쪽이 다시 센다.
 */
export const DROPPED_HEADERS = new Set([
  'origin',
  'referer',
  'host',
  'connection',
  'content-length',
]);

/** 이 요청을 백엔드로 넘길 것인가. 스위치가 꺼져 있으면 언제나 아니다. */
export const shouldRelay = (pathname: string, target: string): boolean =>
  target !== '' && pathname.startsWith(API_PREFIX);

/** 끝의 슬래시를 턴다 — 경로와 이어 붙일 때 `//` 가 생기지 않게 한다. */
export const normalizeTarget = (value: string | undefined): string =>
  (value ?? '').replace(/\/+$/, '');

export const relayHeaders = (source: Headers): Headers => {
  const headers = new Headers();

  source.forEach((value, key) => {
    if (!DROPPED_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  return headers;
};

/** 본문을 실을 수 없는 상태 코드. 여기에 본문을 주면 `Response` 생성이 던진다. */
const BODYLESS_STATUS = new Set([101, 103, 204, 205, 304]);

/**
 * 중계한 응답에 **「저장하지 말라」**를 붙인다.
 *
 * ⛔ **백엔드 응답을 화면이 다시 쓰면 안 된다.** 화면 주소가 `pop://app` 이고 중계 응답에
 *    캐시 지시가 없으면 렌더러(Chromium)가 그것을 제 캐시에 두고 다음 조회에 그대로 내준다 —
 *    **셸을 다시 띄워도 남는다**(디스크 캐시). 실측(WIP-CHAIN-01 D4): 단말·공정 권한을 DB 에서
 *    고치고 셸을 재기동했는데도 `GET /mdm/terminals/10/processes` 가 옛 값을 돌려줘, 열려야 할
 *    「생산 라벨 출력」이 사유 없이 잠겼다. 낡은 권한이 굳으면 «막아야 할 것이 열리는» 반대쪽도
 *    똑같이 일어난다.
 *
 * ⭐ **ETag 는 그대로 둔다.** 이 저장소의 낙관적 잠금이 그 값을 `If-Match` 로 되싣는다 —
 *    떼면 수정이 통째로 막힌다. 끄는 것은 «브라우저가 알아서 재사용하는 것» 한 축뿐이다.
 *
 * ⭐ 렌더러 쪽에도 같은 뜻의 장치가 있다(`packages/api-client` 의 `cache: 'no-store'`). 캐시는
 *    두 층이라 양쪽에 둔다 — 한쪽만 두면 그 층을 지나지 않는 경로에서 다시 굳는다.
 */
export const withNoStore = (response: Response): Response => {
  const headers = new Headers(response.headers);

  headers.set('Cache-Control', 'no-store');

  return new Response(BODYLESS_STATUS.has(response.status) ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * 실제로 넘긴다.
 *
 * ⛔ **실패를 «응답»으로 바꾸지 않는다.** 여기서 잡아 500 을 돌려주면 화면은 서버가 답한
 *    것으로 읽어 「이 토큰은 더 이상 쓸 수 없습니다」를 말한다 — 「닿지 못했다」와
 *    「거절당했다」를 가르려고 만든 갈래가 이 자리에서 무너진다(리뷰 지적). 던진 채로 두면
 *    화면의 fetch 가 실패하고 「서버에 연결하지 못했습니다」로 간다.
 */
export const relayToApi = async (
  fetchImpl: (input: string, init: RequestInit) => Promise<Response>,
  target: string,
  request: Request,
  pathname: string,
  search: string,
): Promise<Response> => {
  /* 본문 없는 메서드에 빈 본문을 실으면 400 으로 떨어뜨리는 서버가 있다. */
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  const relayed = await fetchImpl(`${target}${pathname}${search}`, {
    method: request.method,
    headers: relayHeaders(request.headers),
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  /* 메서드·상태를 가리지 않는다 — 쓰기 응답도 화면이 다시 쓰면 안 되는 값이다. */
  return withNoStore(relayed);
};

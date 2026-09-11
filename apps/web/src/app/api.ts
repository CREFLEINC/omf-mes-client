import { createApiClient, type ApiClient } from '@omf-mes/api-client';

import { currentTerminalToken } from '../patterns/pop-terminal-token';

/**
 * 기준 URL이 주어지지 않았을 때의 기본값 — 이 저장소의 로컬 목 서버 주소다.
 * tools/mock/serve.mjs가 같은 호스트·포트로 띄운다. 배포 대상의 주소가 아니다.
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:4010';

const resolveBaseUrl = (): string => {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL;
  return typeof configured === 'string' && configured !== '' ? configured : DEFAULT_BASE_URL;
};

/**
 * 앱 전역에서 공유하는 계약 클라이언트.
 * ETag 보관소를 함께 들고 있으므로 인스턴스를 여러 개 만들면 낙관적 잠금 토큰이 흩어진다.
 *
 * ⭐ **단말 토큰은 POP 셸에서만 나온다**(#999). 설계가 POP 요청을
 * `Authorization: Bearer <단말 토큰>` 으로 정했고, 그 토큰을 들고 있는 것은 셸뿐이다.
 *
 * 관리웹은 브라우저에서 도니 셸 통로가 없어 이 함수가 언제나 `null` 을 낸다 — 헤더가 붙지
 * 않으므로 관리웹 동작은 그대로다. POP 전용 클라이언트를 따로 만들지 않는 이유가 바로 위
 * 줄이다 — 인스턴스가 둘이면 ETag 보관소가 흩어진다.
 *
 * ⭐ **관리웹은 쿠키 세션으로 인증한다**(README 인증 공통 규칙 · 대응표 P0 「세션 인증」).
 * `POST /app/sessions` 가 내리는 `omf_session` 쿠키를 로그인 외 모든 요청이 실어야 하고,
 * 브라우저 기본값(`same-origin`)으로는 개발 환경의 교차 출처 호출(관리웹·목 서버가 다른
 * 포트)에서 쿠키가 빠진다. `credentials: 'include'`는 그 쿠키 축이고 `authToken`(POP 단말
 * 토큰)은 위 줄의 헤더 축이다 — 관리웹에서는 `authToken` 이 항상 `null` 을 내므로 두 축이
 * 부딪히지 않고 나란히 선다.
 */
export const apiClient: ApiClient = createApiClient({
  baseUrl: resolveBaseUrl(),
  credentials: 'include',
  authToken: currentTerminalToken,
});

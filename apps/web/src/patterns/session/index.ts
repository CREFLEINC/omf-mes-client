/**
 * 로그인 결과를 앱에 내려 주는 자리.
 *
 * 여기 있는 것은 **특정 화면을 알지 않는다** — 세션은 셸도 화면도 함께 읽는 값이라
 * 어느 슬라이스에도 둘 수 없고, 허용 의존 규칙이 `app/`에 두는 길도 막는다.
 */
export {
  SessionProvider,
  useSession,
  type Session,
  type SessionProviderProps,
  type SessionValue,
} from './session-context';

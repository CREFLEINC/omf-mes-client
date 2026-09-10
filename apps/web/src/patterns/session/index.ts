/**
 * 로그인 결과를 앱에 내려 주는 자리와, **그 결과로 길을 막는 겹**.
 *
 * 여기 있는 것은 **특정 화면을 알지 않는다** — 세션은 셸도 화면도 함께 읽는 값이라
 * 어느 슬라이스에도 둘 수 없고, 허용 의존 규칙이 `app/`에 두는 길도 막는다.
 */
export {
  SessionProvider,
  sessionKeys,
  useSession,
  type Session,
  type SessionProviderProps,
  type SessionStatus,
  type SessionValue,
} from './session-context';
export { GuestOnly, RequireSession } from './session-guards';
export {
  HOME_PATH,
  LOGIN_PATH,
  readReturnPath,
  resolveReturnPath,
  type SessionRedirectState,
} from './return-path';
export { useSignOut, type SignOutAction } from './use-sign-out';

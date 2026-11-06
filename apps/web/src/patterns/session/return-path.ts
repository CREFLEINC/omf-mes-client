/**
 * 로그인 화면이 성공 뒤에 갈 곳. **막힌 주소가 없으면 여기다.**
 *
 * 루트는 통합 대시보드로 넘긴다(`routes/index.tsx`) — 그 이름을 여기 적지 않는 것은 첫 화면이
 * 바뀔 때 고칠 자리를 둘로 늘리지 않기 위해서다.
 */
export const HOME_PATH = '/';

/** 로그인 화면 자신. 여기로 돌려보내면 로그인한 사람이 다시 로그인 화면에 선다. */
export const LOGIN_PATH = '/login';

/**
 * 가드가 로그인 화면으로 넘길 때 들려 보내는 값.
 *
 * ⭐ **주소 대신 이동 상태에 싣는다.** 질의 문자열(`?next=...`)에 실으면 그 주소가 방문 기록·
 * 프록시 로그·리퍼러에 남는다 — 업무 화면 주소에는 전표 번호 같은 식별자가 붙어 있다.
 */
export interface SessionRedirectState {
  from: string;
  /**
   * 그 주소를 **보고 있던 사람**. 세션이 만료되기 전에 로그인해 있던 사용자다(omf-all-around#188).
   *
   * ⭐ **로그인한 사람이 다르면 이 주소로 보내지 않는다.** 만료 뒤 같은 브라우저에 다른 사람이
   * 로그인하면, 앞사람이 보던 화면으로 들어가 권한이 다르면 오류만 남는다.
   *
   * 없으면 **누가 보던 주소인지 모른다** — 즐겨찾기로 깊은 화면을 처음 연 경우다. 그때는
   * 누가 로그인하든 그 주소로 보낸다(지금까지의 동작).
   */
  userId?: number;
}

/**
 * 들고 온 값에서 **돌아갈 수 있는 내부 주소만** 꺼낸다. 아니면 `null`.
 *
 * ⛔ **바깥으로 나가는 주소를 그대로 쓰지 않는다.** 이 값은 이동 상태에 실려 오지만 그 상태는
 * 브라우저 히스토리에 남는 값이라 **이 앱이 쓴 것이라고 단정할 수 없다.** 검사 없이 넘기면
 * 로그인 직후 남의 사이트로 나가는 길이 되고, 그 화면은 방금 로그인한 사람에게 우리 화면처럼
 * 보인다.
 *
 * 통과 조건은 셋이다.
 * - `/`로 시작한다 — 절대 주소(`https://…`)와 상대 주소를 함께 막는다.
 * - `//`로 시작하지 않는다 — `//evil.example`은 **프로토콜 상대 주소**라 바깥으로 나간다.
 * - 로그인 화면이 아니다 — 자기 자신으로 돌려보내면 로그인이 끝나지 않는다.
 */
export const readReturnPath = (state: unknown): string | null => {
  if (typeof state !== 'object' || state === null) return null;

  const from: unknown = (state as { from?: unknown }).from;

  if (typeof from !== 'string') return null;
  if (!from.startsWith('/') || from.startsWith('//')) return null;
  if (from === LOGIN_PATH || from.startsWith(`${LOGIN_PATH}?`)) return null;

  return from;
};

/** 들고 온 값에서 그 주소를 보던 사람을 꺼낸다. 없거나 모양이 틀리면 `null`(모른다). */
const readReturnOwner = (state: unknown): number | null => {
  if (typeof state !== 'object' || state === null) return null;

  const userId: unknown = (state as { userId?: unknown }).userId;

  return typeof userId === 'number' ? userId : null;
};

/**
 * 로그인 성공 뒤 갈 곳 — 막힌 주소가 있으면 그리로, 없으면 첫 화면으로.
 *
 * ⛔ **다른 사람이 보던 주소면 첫 화면으로 보낸다**(omf-all-around#188). `signedInUserId`는
 * 방금 로그인한(또는 이미 로그인해 있는) 사람이다.
 */
export const resolveReturnPath = (state: unknown, signedInUserId: number): string => {
  const path = readReturnPath(state);

  if (path === null) return HOME_PATH;

  const owner = readReturnOwner(state);

  return owner === null || owner === signedInUserId ? path : HOME_PATH;
};

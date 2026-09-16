import { WEB_SCREENS } from './web-screen-catalog';

/**
 * **이 사람이 갈 수 있는 관리웹 화면**을 판정한다.
 *
 * 세션이 기능 권한 코드를 그대로 내려준다(`Session.permissions`). 계약이 그 쓰임을 못 박았다 —
 * 「화면은 이 배열로 액션을 활성·비활성한다: 403 을 받아 보고 아는 것이 아니라 **누르기 전에**
 * 판정한다」. 코드는 **설계 화면 코드와 1:1**이고 그 대응표는 `web-screen-catalog.ts` 가 갖는다.
 *
 * ⚠ **「모른다」와 「없다」를 갈라 둔다.** 계약이 갈라 놓은 그대로다 — 필드가 **없으면** 값 목록이
 * 아직 정해지지 않았다는 뜻이라 **판정하지 않고**, **빈 배열**은 「아무 기능 권한도 없다」다.
 * 같게 다루면 목록을 못 받은 세션이 「권한 없음」으로 보여 원인이 가려진다.
 *
 * ⚠ **이 판정은 보안 경계가 아니다.** 막는 것은 서버이고(403), 여기서 하는 일은 **갈 수 없는
 * 자리를 메뉴에서 빼 주는 것**뿐이다. 그래서 모르는 주소는 **막지 않고 보인다**(아래 참조) —
 * 메뉴에서 조용히 사라진 화면은 사용자가 스스로 되찾을 방법이 없다.
 */

/**
 * 권한과 무관하게 늘 보이는 화면.
 *
 * ⛔ **여기를 늘리지 않는다.** 예외가 늘면 「허용된 화면만 보인다」는 말이 사실이 아니게 된다.
 * 지금 둘뿐인 것은 각각 **막으면 되돌릴 수 없는** 자리이기 때문이다 —
 * ① `W-CO-05` 통합 대시보드는 로그인이 착지하는 자리다. 빼면 로그인 직후 선 화면이 메뉴에 없다.
 * ② `W-CO-10` 비밀번호 변경은 **자기 계정** 화면이다. 빼면 권한 없는 사람이 자기 비밀번호를
 *    바꿀 길이 없고, 그 권한을 받으려면 관리자를 거쳐야 한다.
 */
export const ALWAYS_VISIBLE_SCREEN_CODES: readonly string[] = ['W-CO-05', 'W-CO-10'];

/**
 * 판정의 결과.
 *
 * - `unknown` 판정할 근거가 없다 — 세션이 권한 목록을 주지 않았다. **거르지 않는다.**
 * - `ready` 판정했다.
 */
export type WebAccessState = 'unknown' | 'ready';

export interface WebAccess {
  state: WebAccessState;
  /** 이 주소를 메뉴에 둘 것인가. */
  allows: (path: string) => boolean;
}

/** 주소 → 화면 코드. 감지기가 사이드바 항목 전건이 여기 있음을 못 박는다. */
const codeByPath = new Map(WEB_SCREENS.map((screen) => [screen.path, screen.code]));

const ALWAYS_VISIBLE = new Set(ALWAYS_VISIBLE_SCREEN_CODES);

/**
 * 세션의 권한 코드로 판정기를 만든다.
 *
 * ⭐ **모르는 주소는 보인다.** 대응표에 없는 주소를 막으면, 메뉴에 항목을 더하고 대응표를
 * 빠뜨린 날 그 화면이 **아무에게도 보이지 않는다** — 사용자가 알아차릴 방법도 되돌릴 방법도
 * 없다. 반대로 보이게 두면 눌렀을 때 서버가 403 으로 막고 그 사실이 화면에 드러난다.
 * 대응표의 빠짐 자체는 `routes/web-screen-catalog.test.ts` 가 먼저 잡는다.
 */
export const toWebAccess = (permissions: readonly string[] | undefined): WebAccess => {
  if (permissions === undefined) return { state: 'unknown', allows: () => true };

  const granted = new Set(permissions);

  return {
    state: 'ready',
    allows: (path) => {
      const code = codeByPath.get(path);

      if (code === undefined) return true;

      return ALWAYS_VISIBLE.has(code) || granted.has(code);
    },
  };
};

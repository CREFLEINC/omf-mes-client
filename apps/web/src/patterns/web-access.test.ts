import { describe, expect, it } from 'vitest';

import { ALWAYS_VISIBLE_SCREEN_CODES, toWebAccess } from './web-access';
import { WEB_SCREENS } from './web-screen-catalog';

/** 대응표에 실재하는 주소여야 판정이 의미를 갖는다 — 지어낸 주소는 「모르는 주소」 갈래로 샌다. */
const pathOf = (code: string): string => {
  const screen = WEB_SCREENS.find((entry) => entry.code === code);

  if (screen === undefined) throw new Error(`대응표에 ${code} 가 없습니다.`);

  return screen.path;
};

const USERS_ROLES = pathOf('W-CO-02');
const WAREHOUSE_LOCATION = pathOf('W-06-07');
const DASHBOARD = pathOf('W-CO-05');
const PASSWORD_CHANGE = pathOf('W-CO-10');

describe('toWebAccess', () => {
  /**
   * ⚠ **「모른다」와 「없다」를 가른다.** 계약이 갈라 놓은 그대로다 — 필드가 없으면 값 목록이
   * 아직 정해지지 않았다는 뜻이다. 같게 다루면 목록을 못 받은 세션이 텅 빈 메뉴를 보고
   * **원인이 가려진다.**
   */
  describe('권한 목록을 받지 못했을 때', () => {
    it('판정하지 않는다 — 무엇이든 보인다', () => {
      const access = toWebAccess(undefined);

      expect(access.state).toBe('unknown');
      expect(access.allows(USERS_ROLES)).toBe(true);
      expect(access.allows(WAREHOUSE_LOCATION)).toBe(true);
    });
  });

  describe('권한 목록을 받았을 때', () => {
    it('가진 코드의 화면만 보인다', () => {
      const access = toWebAccess(['W-CO-02']);

      expect(access.state).toBe('ready');
      expect(access.allows(USERS_ROLES)).toBe(true);
      expect(access.allows(WAREHOUSE_LOCATION)).toBe(false);
    });

    /** **빈 배열은 「아무 권한도 없다」다** — 「모른다」가 아니라 실제로 판정한 결과다. */
    it('빈 배열이면 예외 말고는 아무것도 보이지 않는다', () => {
      const access = toWebAccess([]);

      expect(access.state).toBe('ready');
      expect(access.allows(USERS_ROLES)).toBe(false);
      expect(access.allows(WAREHOUSE_LOCATION)).toBe(false);
    });

    /**
     * ⛔ **막으면 되돌릴 수 없는 자리 둘.** 대시보드는 로그인이 착지하는 곳이고, 비밀번호
     * 변경은 자기 계정 화면이라 막으면 본인이 비밀번호를 바꿀 길이 없다.
     */
    it('늘 보이는 화면 둘은 권한이 없어도 보인다', () => {
      const access = toWebAccess([]);

      expect(access.allows(DASHBOARD)).toBe(true);
      expect(access.allows(PASSWORD_CHANGE)).toBe(true);
    });

    /**
     * ⭐ **모르는 주소는 막지 않는다.** 막으면 메뉴에 항목을 더하고 대응표를 빠뜨린 날 그
     * 화면이 **아무에게도 보이지 않고** 사용자가 되찾을 방법이 없다. 보이게 두면 눌렀을 때
     * 서버가 403 으로 막고 그 사실이 화면에 드러난다. 빠짐 자체는 감지기가 먼저 잡는다.
     */
    it('대응표에 없는 주소는 막지 않는다', () => {
      expect(toWebAccess([]).allows('/syn/not-in-catalog')).toBe(true);
    });
  });

  /** ⛔ 예외가 늘면 「허용된 화면만 보인다」는 말이 사실이 아니게 된다. */
  it('늘 보이는 화면은 둘뿐이고 둘 다 대응표에 있다', () => {
    expect(ALWAYS_VISIBLE_SCREEN_CODES).toEqual(['W-CO-05', 'W-CO-10']);

    for (const code of ALWAYS_VISIBLE_SCREEN_CODES) {
      expect(WEB_SCREENS.some((screen) => screen.code === code)).toBe(true);
    }
  });
});

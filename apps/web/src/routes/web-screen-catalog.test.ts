import { describe, expect, it } from 'vitest';

import { appRouter } from './index';
import { NAV_ENTRIES } from '../app/nav-tree';
import { WEB_SCREENS } from '../patterns/web-screen-catalog';

/**
 * 관리웹 화면 이름표(`patterns/web-screen-catalog.ts`)가 사이드바·라우트 표와 어긋나지 않는지 잰다.
 *
 * ⭐ **어긋남이 양쪽으로 해롭다.** 이름표가 **빠지면** 그 메뉴 항목에는 대조할 화면 코드가 없어,
 * 권한 판정이 붙는 날 「권한이 있는데 안 보이는 항목」이나 「누구에게나 보이는 항목」 중 하나가
 * 된다 — 둘 다 조용하다. **남으면** 라우트가 걷힌 화면의 코드가 살아 있어, 없는 화면에 권한을
 * 주는 셈이 된다.
 *
 * ⚠ **시험이 `routes` 아래 있는 이유.** 이름표는 `patterns` 에 사는데 앱 내부 의존은
 * `routes → screens → patterns` 한 방향이라(`.dependency-cruiser.cjs` 「app-inner-direction」),
 * 이름표 옆에서 `NAV_ENTRIES` 나 `appRouter` 를 부르면 방향을 거스른다. 셋 다 부르는 것이
 * 허용되는 쪽에서 대조한다 — `pop-screen-catalog.test.ts` 가 같은 자리에 같은 이유로 섰다.
 */
describe('관리웹 화면 이름표', () => {
  /* 라우터가 실제로 받는 경로. 자식 라우트의 `path` 는 앞머리 `/` 가 없다(`index.test.tsx` 와 같다). */
  const routedPaths = (): string[] =>
    (appRouter.routes[0]?.children ?? [])
      .map((route) => route.path)
      .filter((path): path is string => path !== undefined)
      .map((path) => `/${path}`);

  /*
   * ⛔ **빈 통과를 막는다.** 목록을 비우면 아래 불변식이 **전부** 성립한다 — 중복도 없고 라우트
   * 밖 주소도 없고 형식이 틀린 코드도 없다. 같은 관례가 `app/nav-tree.test.ts` 맨 앞에 있다.
   */
  it('이름표가 비어 있지 않다 — 아래 불변식이 무언가를 재고 있다', () => {
    expect(WEB_SCREENS.length).toBeGreaterThan(1);
    expect(NAV_ENTRIES.length).toBeGreaterThan(1);
  });

  /**
   * ⛔ **사이드바 항목이 하나도 빠지지 않는다.** 이 시험이 이 파일의 본체다 — 메뉴에 항목을 더하고
   * 이름표를 잊는 것이 가장 흔한 사고이고, 화면은 멀쩡히 열리므로 다른 시험에 걸리지 않는다.
   * `NAV_ENTRIES` 는 섹션 밖 항목(`NAV_LEAD`)까지 합친 전건이라 그쪽도 함께 걸린다.
   */
  it('사이드바 항목 전부에 화면 코드가 있다', () => {
    const listed = new Set(WEB_SCREENS.map((screen) => screen.path));
    const missing = NAV_ENTRIES.map((entry) => entry.to).filter((to) => !listed.has(to));

    expect(missing).toEqual([]);
  });

  /*
   * 폐지된 화면이 이름표에만 남는 것을 잡는다 — 라우트가 없는 주소에는 줄 권한도 없다.
   * 라우트 표를 직접 보므로 사이드바에서만 걷어낸 화면도 걸린다.
   */
  it('라우트 표에 없는 주소를 담지 않는다', () => {
    const routed = new Set(routedPaths());
    const unrouted = WEB_SCREENS.map((screen) => screen.path).filter((path) => !routed.has(path));

    expect(unrouted).toEqual([]);
  });

  /**
   * ⛔ 주소가 겹치면 **한 화면에 코드가 둘**이 된다 — 읽는 쪽이 먼저 찾은 것을 쓰므로 어느 쪽이
   * 이기는지가 목록의 차례에 달리고, 그 사실은 어디에도 적혀 있지 않다.
   */
  it('주소가 겹치지 않는다', () => {
    const paths = WEB_SCREENS.map((screen) => screen.path);

    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });

  /**
   * ⛔ 코드가 겹치면 **한 권한이 두 화면을 연다.** 권한을 하나만 준 사람에게 보여선 안 될 화면이
   * 함께 열리고, 그 화면은 정상으로 보인다.
   */
  it('화면 코드가 겹치지 않는다', () => {
    const codes = WEB_SCREENS.map((screen) => screen.code);

    expect(codes.filter((code, index) => codes.indexOf(code) !== index)).toEqual([]);
  });

  /**
   * ⛔ **관리웹 코드는 `W-` 로 시작한다**(IA §1 — 화면 ID = 프로그램 + 도메인 + 일련).
   * POP·모바일 코드를 잘못 옮겨 붙이면 서버가 모르는 권한을 묻게 되고, 응답은 「권한 없음」이라
   * **사이드바가 통째로 비는** 모습으로만 드러난다. 도메인 자리(`01`~`06` 또는 `CO`)까지 잰다.
   */
  it('화면 코드가 관리웹 형식이다', () => {
    const malformed = WEB_SCREENS.filter((screen) => !/^W-(?:\d{2}|CO)-\d{2}$/.test(screen.code));

    expect(malformed).toEqual([]);
  });

  /* 이름이 비면 「왜 이 코드인가」를 되짚을 근거가 사라진다 — 코드만 남은 줄은 대조할 수 없다. */
  it('모든 항목에 설계 화면명이 있다', () => {
    expect(WEB_SCREENS.filter((screen) => screen.name.trim() === '')).toEqual([]);
  });
});

import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  POP_AREA_PATH_PREFIX,
  POP_AREAS,
  POP_HOME_PATH,
  POP_SCREENS,
  POP_TASK_GROUPS,
  popAreaAt,
  popAreaPath,
} from '../patterns/pop-screen-catalog';
import { popRoutes } from './pop';

/** 셸의 자리 — 홈과 부서 화면. 업무 화면이 아니라 화면 코드가 없고 권한으로 막지 않는다. */
const SHELL_PATHS = new Set([POP_HOME_PATH, `${POP_AREA_PATH_PREFIX}:area`]);

/**
 * 홈·부서 화면의 후보 목록이 라우트 표와 어긋나지 않는지 잰다.
 *
 * ⭐ **어긋남이 양쪽으로 해롭다.** 목록이 낡아 **빠지면** 권한이 있는데도 갈 수 없는 화면이
 * 생기고, **남으면** 통합·폐지된 화면이 후보에 떠 눌러도 홈으로 되돌아간다 — 둘 다 작업자에게는
 * 「고장」으로 보인다.
 *
 * ⚠ **시험이 `routes` 아래 있는 이유.** 목록은 `patterns` 에 사는데 앱 내부 의존은
 * `routes → screens → patterns` 한 방향이라, 목록 옆에서 `popRoutes` 를 부르면 방향을
 * 거스른다(`.dependency-cruiser.cjs`). 부르는 것이 허용되는 쪽에서 대조한다.
 */
describe('POP 화면 이름표', () => {
  it('홈·부서 화면을 뺀 POP 라우트를 하나도 빠뜨리지 않는다', () => {
    /* 홈·부서 화면은 업무 화면이 아니라 셸의 자리다 — 화면 코드가 없고 권한으로 막지 않는다. */
    const routed = popRoutes
      .flatMap((route) => (route.path === undefined ? [] : [route.path]))
      .filter((path) => !SHELL_PATHS.has(path))
      .sort();
    const listed = POP_SCREENS.map((screen) => screen.path).sort();

    expect(listed).toEqual(routed);
  });

  /* 폐지된 화면이 목록에만 남는 것을 잡는다 — 라우트가 없는 주소는 후보가 될 수 없다. */
  it('라우트 표에 없는 주소를 담지 않는다', () => {
    const routed = new Set(popRoutes.map((route) => route.path));

    for (const { path } of POP_SCREENS) expect(routed.has(path)).toBe(true);
  });

  /* 홈은 [홈] 단추가 늘 가는 자리라, 목록에 두어 권한으로 거르면 돌아갈 곳이 사라질 수 있다. */
  it('홈은 라우트에 있고 화면 목록에는 담지 않는다', () => {
    expect(popRoutes.map((route) => route.path)).toContain(POP_HOME_PATH);
    expect(POP_SCREENS.map((screen) => screen.path)).not.toContain(POP_HOME_PATH);
  });

  /* 부서 레일·홈 카드가 데려가는 자리 — 모든 부서 주소가 그 부서로 읽혀야 한다. */
  it('부서 화면은 라우트에 있고 모든 부서 주소가 그 부서로 읽힌다', () => {
    expect(popRoutes.map((route) => route.path)).toContain(`${POP_AREA_PATH_PREFIX}:area`);

    for (const area of POP_AREAS) expect(popAreaAt(popAreaPath(area))).toBe(area);
    expect(popAreaAt(`${POP_AREA_PATH_PREFIX}unknown`)).toBeNull();
    expect(popAreaAt(POP_HOME_PATH)).toBeNull();
  });

  /* 타일은 이름과 함께 한 줄 설명을 단다 — 빠진 화면은 이름만 덩그러니 선다. */
  it('모든 화면에 아이콘과 한 줄 설명이 있다', () => {
    for (const screen of POP_SCREENS) {
      expect(screen.icon).not.toBe('');
      expect(messages.popChrome.console.hints[screen.code]).toBeTruthy();
    }
  });

  /* 사번 입력은 상태바가 여는 창이다 — 페이지로 남으면 첫 화면이 다시 로그인처럼 보인다. */
  it('사번 입력 페이지(P-CO-01)를 라우트로 두지 않는다', () => {
    expect(popRoutes.map((route) => route.path)).not.toContain('/pop/worker-assignment');
  });

  /* 묶음이 영역 순서표에 없으면 홈·메뉴에서 그 화면이 통째로 사라진다. */
  it('모든 화면의 업무 묶음이 그 영역의 묶음 순서표에 있다', () => {
    for (const screen of POP_SCREENS) expect(POP_TASK_GROUPS[screen.area]).toContain(screen.group);
  });

  /* 화면 코드가 권한 대조의 열쇠다 — 겹치면 한 권한이 두 화면을 열고, 비면 아무것도 못 연다. */
  it('화면 코드가 서로 겹치지 않는다', () => {
    const codes = POP_SCREENS.map((screen) => screen.code);

    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).not.toBe('');
  });
});

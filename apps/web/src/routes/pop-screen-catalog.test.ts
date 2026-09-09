import { describe, expect, it } from 'vitest';

import { popRoutes } from './pop';
import { POP_ENTRY_SCREEN_PATH, POP_SCREENS } from '../patterns/pop-screen-catalog';

/**
 * 업무용 [화면 이동](G-34)의 후보 목록이 라우트 표와 어긋나지 않는지 잰다.
 *
 * ⭐ **어긋남이 양쪽으로 해롭다.** 목록이 낡아 **빠지면** 권한이 있는데도 갈 수 없는 화면이
 * 생기고, **남으면** 통합·폐지된 화면이 후보에 떠 눌러도 진입 화면으로 되돌아간다 — 둘 다
 * 작업자에게는 「고장」으로 보인다.
 *
 * ⚠ **시험이 `routes` 아래 있는 이유.** 목록은 `patterns` 에 사는데 앱 내부 의존은
 * `routes → screens → patterns` 한 방향이라, 목록 옆에서 `popRoutes` 를 부르면 방향을
 * 거스른다(`.dependency-cruiser.cjs`). 부르는 것이 허용되는 쪽에서 대조한다.
 */
describe('POP 화면 이름표', () => {
  it('진입 화면을 뺀 POP 라우트를 하나도 빠뜨리지 않는다', () => {
    const routed = popRoutes
      .map((route) => route.path)
      .filter((path) => path !== POP_ENTRY_SCREEN_PATH)
      .sort();
    const listed = POP_SCREENS.map((screen) => screen.path).sort();

    expect(listed).toEqual(routed);
  });

  /* 폐지된 화면이 목록에만 남는 것을 잡는다 — 라우트가 없는 주소는 후보가 될 수 없다. */
  it('라우트 표에 없는 주소를 담지 않는다', () => {
    const routed = new Set(popRoutes.map((route) => route.path));

    for (const { path } of POP_SCREENS) expect(routed.has(path)).toBe(true);
  });

  /* [사용자 전환]이 가는 화면이라 여기 두면 두 길이 어긋난다. */
  it('진입 화면은 담지 않는다', () => {
    expect(popRoutes.map((route) => route.path)).toContain(POP_ENTRY_SCREEN_PATH);
    expect(POP_SCREENS.map((screen) => screen.path)).not.toContain(POP_ENTRY_SCREEN_PATH);
  });

  /* 화면 코드가 권한 대조의 열쇠다 — 겹치면 한 권한이 두 화면을 열고, 비면 아무것도 못 연다. */
  it('화면 코드가 서로 겹치지 않는다', () => {
    const codes = POP_SCREENS.map((screen) => screen.code);

    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).not.toBe('');
  });
});

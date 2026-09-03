import { describe, expect, it } from 'vitest';

import { popRoutes } from './pop';
import { POP_DEV_ENTRY_PATH, POP_DEV_SCREENS } from '../patterns/pop-dev-screen-nav';

/**
 * 개발용 화면 이동 셀렉터의 목록이 라우트 표와 어긋나지 않는지 잰다.
 *
 * ⭐ **이 셀렉터의 쓸모가 「전부 갈 수 있다」에 있다.** 목록이 라우트 표보다 낡으면 새로 선
 * 화면이 조용히 빠지고, 그 순간 개발자는 「그 화면은 아직 없다」로 오해한다.
 *
 * ⚠ **시험이 `routes` 아래 있는 이유.** 셀렉터는 `patterns`에 살고 앱 내부 의존은
 * `routes → screens → patterns` 한 방향이라, 셀렉터 옆에서 `popRoutes`를 부르면 방향을
 * 거스른다(`.dependency-cruiser.cjs`). 부르는 것이 허용되는 쪽에서 대조한다.
 *
 * ⛔ **새 POP 라우트를 붙이면 여기서 걸린다.** 그때 목록에 한 줄을 더한다 — 걸리는 것이
 * 이 시험의 일이다.
 */
describe('개발용 화면 이동 목록', () => {
  it('진입 화면을 뺀 POP 라우트를 하나도 빠뜨리지 않는다', () => {
    const routed = popRoutes
      .map((route) => route.path)
      .filter((path) => path !== POP_DEV_ENTRY_PATH)
      .sort();
    const listed = POP_DEV_SCREENS.map((screen) => screen.path).sort();

    expect(listed).toEqual(routed);
  });

  /* 자기 자신으로 가는 항목은 목록에 둘 이유가 없다 — 셀렉터가 그 화면 위에 서 있다. */
  it('진입 화면은 담지 않는다', () => {
    expect(popRoutes.map((route) => route.path)).toContain(POP_DEV_ENTRY_PATH);
    expect(POP_DEV_SCREENS.map((screen) => screen.path)).not.toContain(POP_DEV_ENTRY_PATH);
  });

  /* 진입값은 주소에 실려 나가야 뜻이 있다 — 물음표를 빠뜨리면 경로의 일부가 된다. */
  it('진입값을 적은 화면은 물음표로 시작한다', () => {
    for (const { query } of POP_DEV_SCREENS) {
      if (query !== undefined) expect(query.startsWith('?')).toBe(true);
    }
  });
});

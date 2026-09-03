import { describe, expect, it } from 'vitest';

import { popRoutes } from './pop';
import { POP_DEV_SCREENS } from '../patterns/pop-dev-screen-nav';

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
  it('POP 라우트를 하나도 빠뜨리지 않는다', () => {
    const routed = popRoutes.map((route) => route.path).sort();
    const listed = POP_DEV_SCREENS.map((option) => option.value).sort();

    expect(listed).toEqual(routed);
  });
});

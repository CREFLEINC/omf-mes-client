import { describe, expect, it } from 'vitest';

import { appRouter } from './index';
import { popRoutes } from './pop';

/**
 * POP 라우트가 **실제로 라우터에 붙어 있는지**를 지킨다.
 *
 * `popRoutes`를 따로 두면 라우트 표와 라우터 사이에 「펼쳐 넣는다」는 한 단계가 생긴다.
 * 그 한 줄(`...popRoutes`)이 병합 중에 사라져도 타입 검사도 빌드도 통과한다 —
 * 배열은 여전히 옳고, 아무도 그것을 쓰지 않을 뿐이다. 증상은 런타임에 「POP 주소가
 * 관리웹 첫 화면으로 튕긴다」로만 나타난다(`*` 라우트가 `/`로 되돌린다).
 *
 * 그래서 화면을 그리지 않고 **라우트 표의 모양만** 본다. 렌더까지 가면 POP 화면의
 * 데이터·셸 의존을 전부 세워야 해서, 정작 지키려던 「붙어 있는가」가 다른 실패에 묻힌다.
 */
describe('POP 라우트 편입', () => {
  it('popRoutes의 모든 경로가 appRouter의 최상위 라우트로 서 있다', () => {
    const topLevelPaths = appRouter.routes.map((route) => route.path);

    expect(popRoutes.length).toBeGreaterThan(0);
    for (const { path } of popRoutes) {
      expect(topLevelPaths).toContain(path);
    }
  });

  it('POP 경로는 `/pop`으로 시작한다 — 관리웹 셸 주소와 섞이지 않는다', () => {
    for (const { path } of popRoutes) {
      expect(path).toMatch(/^\/pop\//);
    }
  });
});

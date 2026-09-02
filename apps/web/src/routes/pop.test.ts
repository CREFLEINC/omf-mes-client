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

  /**
   * ⚠ **위 둘은 「배열에 든 것」만 본다** — 배열에서 라우트가 통째로 빠지면 아무 일도
   * 일어나지 않는다(실측: 지워도 타입 검사·시험 전건 통과). 주소가 사라진 것은 그 화면을
   * 여는 사람만 알게 되고, POP은 그 사람이 현장에 있다.
   *
   * `P-CO-01`은 **단말을 켰을 때 맨 처음 서는 화면**이라 주소가 사라지면 단말이 아무 데도
   * 가지 못한다. 그래서 이 하나는 이름으로 못박는다.
   */
  it('P-CO-01 진입 주소가 서 있다', () => {
    expect(popRoutes.map(({ path }) => path)).toContain('/pop/worker-assignment');
  });

  /**
   * 같은 이유로 이 화면도 이름으로 못박는다 — 창고 단말이 고정으로 띄우는 주소라, 사라지면
   * 그 앞에 선 사람만 알게 된다.
   *
   * ⚠ **화면마다 자기 줄을 지킨다.** 여기에 전체 목록을 두면 새 POP 화면이 늘 때마다 남의
   * 시험을 고쳐야 하고, 그러다 빠뜨리면 지키는 것이 없어진다.
   */
  it('P-01-01 자재LOT 등록·라벨 발행 주소가 서 있다', () => {
    expect(popRoutes.map(({ path }) => path)).toContain('/pop/material-lot-label');
  });

  it('P-04-03 재작업 실적 등록 주소가 서 있다', () => {
    expect(popRoutes.map(({ path }) => path)).toContain('/pop/rework-results');
  });

  it('POP 경로는 `/pop`으로 시작한다 — 관리웹 셸 주소와 섞이지 않는다', () => {
    for (const { path } of popRoutes) {
      expect(path).toMatch(/^\/pop\//);
    }
  });
});

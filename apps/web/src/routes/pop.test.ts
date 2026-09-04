import { describe, expect, it } from 'vitest';

import { appRouter } from './index';
import { popRoutes } from './pop';

/**
 * POP 라우트가 **관리웹 라우트 표에 섞여 들어가지 않는지**를 지킨다.
 *
 * ⚠ **이 잣대는 전에 정반대를 지켰다.** `index.tsx`가 `...popRoutes`로 펼쳐 넣던 동안에는
 * 그 한 줄이 병합 중에 사라지는 것이 사고였다. #752 가 그 줄을 뺀 뒤로는 **되돌아오는 것**이
 * 사고다 — 관리웹 번들에 현장 단말 화면이 실리고, 브라우저에서 `/pop/...`이 관리웹 번들로
 * 열려 검증 대상이 실제 POP 셸이 아니게 된다.
 *
 * 되돌아오는 길은 조용하다. 새 P- 화면을 `index.tsx`에 직접 붙이거나, 병합 중에 옛 줄이
 * 되살아나도 타입 검사도 빌드도 통과한다. 그래서 화면을 그리지 않고 **라우트 표의 모양만**
 * 본다.
 *
 * POP 라우트가 실제로 서 있는 곳은 POP 진입점이며, 그쪽 배선은 `app/pop-main.test.ts`가
 * 지킨다.
 */
describe('POP 라우트 분리', () => {
  it('관리웹 라우터에 POP 경로가 하나도 없다', () => {
    const topLevelPaths = appRouter.routes.map((route) => route.path);

    expect(popRoutes.length).toBeGreaterThan(0);
    for (const { path } of popRoutes) {
      expect(topLevelPaths).not.toContain(path);
    }
  });

  /**
   * ⛔ **경로 앞머리로도 막는다.** 위 잣대는 `popRoutes`에 «든» 것만 본다 — 새 P- 화면을
   * `pop.tsx`가 아니라 `index.tsx`에 직접 붙이면 배열에 없으므로 걸리지 않는다.
   */
  it('관리웹 라우터에 `/pop`으로 시작하는 주소가 없다', () => {
    for (const route of appRouter.routes) {
      expect(route.path ?? '').not.toMatch(/^\/pop(\/|$)/);
    }
  });

  /**
   * ⚠ **아래는 「배열에 든 것」만 본다** — 배열에서 라우트가 통째로 빠지면 아무 일도
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

  it('P-02-08 포장 작업 주소가 서 있다', () => {
    expect(popRoutes.map(({ path }) => path)).toContain('/pop/packing-work');
  });

  it('POP 경로는 `/pop`으로 시작한다 — 관리웹 셸 주소와 섞이지 않는다', () => {
    for (const { path } of popRoutes) {
      expect(path).toMatch(/^\/pop\//);
    }
  });
});

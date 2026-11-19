import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { popRoutes } from './pop';
import {
  POP_ENTRY_SCREEN_PATH,
  POP_HIDDEN_SCREEN_PATHS,
  POP_HOME_PATH,
  POP_SCREENS,
} from '../patterns/pop-screen-catalog';

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
  /* 홈(#291)은 메뉴의 [홈] 단추로 가는 자리라 탭 목록에 넣지 않는다. */
  it('진입 화면·홈·감춘 화면을 뺀 POP 라우트를 하나도 빠뜨리지 않는다', () => {
    const hidden = new Set<string>(POP_HIDDEN_SCREEN_PATHS);
    const routed = popRoutes
      .map((route) => route.path)
      .filter(
        (path) =>
          path !== POP_ENTRY_SCREEN_PATH && path !== POP_HOME_PATH && !hidden.has(path ?? ''),
      )
      .sort();
    const listed = POP_SCREENS.map((screen) => screen.path).sort();

    expect(listed).toEqual(routed);
  });

  /*
   * Q21 피처 010 — 출하는 P-04-07 로 끝난다. 포장·재구성 라벨·출하 단위(P-04-01·P-04-04·P-04-05)는
   * 화면 이동 후보에서 감추고, 라우트는 남긴다(감춘 목록이 라우트에 있어야 이 예외가 낡지 않는다).
   */
  it('Q21 P-04-01·P-04-04·P-04-05 는 화면 이동 후보에 없고 라우트는 남는다', () => {
    const routed = new Set(popRoutes.map((route) => route.path));
    const listed = POP_SCREENS.map((screen) => screen.code);

    expect([...POP_HIDDEN_SCREEN_PATHS].sort()).toEqual(
      ['/pop/packing', '/pop/repack-label-issue', '/pop/shipping-units'].sort(),
    );
    for (const path of POP_HIDDEN_SCREEN_PATHS) expect(routed.has(path)).toBe(true);
    expect(listed).not.toContain('P-04-01');
    expect(listed).not.toContain('P-04-04');
    expect(listed).not.toContain('P-04-05');
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

  /* 목록에서 누른 이름과 열린 화면의 머리줄 이름이 같아야 한다(사용자 결정 2026-10-26 이름 변경). */
  it('작업 지시 목록(P-02-01)의 이름이 그 화면 머리줄 제목과 같다', () => {
    const workStart = POP_SCREENS.find((screen) => screen.code === 'P-02-01');

    expect(workStart?.name).toBe(messages.workStart.title);
    expect(workStart?.name).toBe('작업 지시 목록');
  });

  /* 피처 010 — 출하 묶음에 서고, 탭 끝 배지는 완료 대기 수(`shipmentCompletion`)다. */
  it('출하 완료(P-04-07)는 출하 묶음이고 이름이 그 화면 머리줄 제목과 같다', () => {
    const complete = POP_SCREENS.find((screen) => screen.code === 'P-04-07');

    expect(complete).toMatchObject({
      path: '/pop/shipment-complete',
      group: 'shipping',
      countKey: 'shipmentCompletion',
    });
    expect(complete?.name).toBe(messages.popShipmentComplete.title);
  });
});

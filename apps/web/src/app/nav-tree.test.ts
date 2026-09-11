import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, NAV_LEAD } from './nav-tree';

/**
 * ⚠ **중복은 `indexOf`로 잰다 — `Set.add` 의 반환값으로 가르지 않는다.** 이 감지기의 첫 판은
 * `filter((to) => !seen.add(to))` 로 썼는데, `Set.prototype.add` 는 불리언이 아니라 **Set 자신을
 * 돌려준다.** 늘 참이라 `!` 가 늘 거짓이고, 주소를 일부러 겹쳐 봐도 **초록이었다**(결함 재주입에서
 * 드러났다). 고친 쪽은 재주입 두 건에 실제로 막힌다.
 *
 * 메뉴 트리의 **불변식** — 렌더 감지기가 보지 못하는 것만 본다(#1079).
 *
 * `layout.test.tsx`의 전수 순서 감지기가 차례와 경로를 이미 못 박으므로 여기서 그것을 되풀이하지
 * 않는다. 대신 **데이터가 되면서 새로 생긴 사고 경로**를 막는다 — 항목을 복사해 붙이다 주소나
 * 묶음 이름이 겹치는 것이다. JSX 였을 때는 눈에 보였지만 450줄 배열에서는 보이지 않는다.
 */
describe('주 메뉴 트리', () => {
  const allEntries = [NAV_LEAD, ...NAV_GROUPS.flatMap((group) => group.items)];

  /**
   * ⛔ 주소가 겹치면 **두 항목이 동시에 선택 상태가 되고**(`NavItem`이 경로로 판정한다) React
   * 목록 키도 겹친다. 겹친 쪽이 둘 다 틀린 자리에 있다는 뜻이라 고를 수 있는 쪽이 없다.
   */
  it('주소가 겹치지 않는다', () => {
    const addresses = allEntries.map((entry) => entry.to);

    expect(addresses.filter((to, index) => addresses.indexOf(to) !== index)).toEqual([]);
  });

  /**
   * ⛔ 묶음 이름이 겹치면 DS 가 `role="group"`의 접근명으로 쓰는 값이 모호해지고, 화면을 이름으로
   * 찾는 시험과 보조기술이 **어느 묶음인지 가를 수 없다.** 목록 키도 이름이다.
   */
  it('묶음 이름이 겹치지 않는다', () => {
    const labels = NAV_GROUPS.map((group) => group.label);

    expect(labels.filter((label, index) => labels.indexOf(label) !== index)).toEqual([]);
  });

  /** 빈 묶음은 **제목만 있는 줄**로 그려진다 — 접기 손잡이까지 붙으면 눌러도 아무것도 안 열린다. */
  it('빈 묶음이 없다', () => {
    expect(NAV_GROUPS.filter((group) => group.items.length === 0)).toEqual([]);
  });

  /**
   * ⛔ 섹션 밖 항목이 어느 묶음에도 **중복해 들어가지 않는다.** 들어가면 같은 화면이 사이드바에
   * 두 번 서고, 그 둘이 동시에 선택 상태가 된다.
   */
  it('섹션 밖 항목이 묶음 안에 다시 들어 있지 않다', () => {
    const grouped = NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to);

    expect(grouped).not.toContain(NAV_LEAD.to);
  });

  /** 아이콘·이름이 빈 항목은 **누를 수는 있지만 무엇인지 알 수 없는 줄**이 된다. */
  it('모든 항목에 아이콘과 이름이 있다', () => {
    expect(allEntries.filter((entry) => entry.icon === '' || entry.label === '')).toEqual([]);
  });
});

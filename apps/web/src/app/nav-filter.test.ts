import { describe, expect, it } from 'vitest';

import type { WebAccess } from '../patterns/web-access';
import {
  filterNavGroups,
  filterNavGroupsByAccess,
  hasNoNavMatch,
  isNavEntryAllowed,
  matchesNavEntry,
} from './nav-filter';
import type { NavEntry, NavGroup } from './nav-tree';

/**
 * 사이드바 거르기(`nav-filter.ts`)를 **합성 트리**로 잰다.
 *
 * ⭐ **실제 트리를 쓰지 않는다.** 실제 트리로 재면 항목 이름이 바뀔 때마다 이 감지기가 깨지고,
 * 깨진 까닭이 「거르는 규칙이 틀렸다」인지 「이름이 바뀌었다」인지 갈리지 않는다. 화면에 그려진
 * 모양은 `layout.test.tsx` 의 검색·권한 감지기가 잰다.
 */

const PLAIN: NavEntry = { to: '/plain', icon: 'p', label: '평범한 화면', labelVi: 'Plain' };

/** 탭 묶음 — 묶음 이름과 탭 이름이 서로 다른 글자를 갖게 지었다(어느 쪽으로 걸렸는지 가르려고). */
const HUB: NavEntry = {
  to: '/hub/first',
  icon: 'h',
  label: '공구 묶음',
  labelVi: 'Tool hub',
  tabs: [
    { to: '/hub/first', label: '첫째 마스터', labelVi: 'First master' },
    { to: '/hub/second', label: '둘째 환산', labelVi: 'Second conversion' },
    { to: '/hub/third', label: '셋째 환산', labelVi: 'Third conversion' },
  ],
};

const GROUPS: readonly NavGroup[] = [
  { label: '가 섹션', labelVi: 'Section A', icon: 'a', items: [PLAIN, HUB] },
  {
    label: '나 섹션',
    labelVi: 'Section B',
    icon: 'b',
    items: [{ to: '/other', icon: 'o', label: '다른 화면', labelVi: 'Other' }],
  },
];

/** 허용 주소 목록으로 권한을 세운다 — `toWebAccess` 의 코드 대조는 `patterns/web-access` 가 잰다. */
const allowing = (...paths: string[]): WebAccess => ({
  state: 'ready',
  allows: (path) => paths.includes(path),
});

describe('filterNavGroups — 탭 묶음 검색', () => {
  it('빈 검색어는 원본을 같은 참조로 돌려준다', () => {
    expect(filterNavGroups(GROUPS, '   ')).toBe(GROUPS);
  });

  /**
   * ⭐ **묶음 이름으로 걸리면 묶음 그대로 선다** — 탭으로 펴지 않는다. 걸린 글자(「공구」)가 묶음
   * 줄에 그대로 보인다.
   */
  it('묶음 이름으로 걸리면 묶음 줄이 탭을 품은 채 선다', () => {
    const result = filterNavGroups(GROUPS, '공구');

    expect(result).toHaveLength(1);
    expect(result[0]?.items).toEqual([HUB]);
  });

  /**
   * ⭐ **탭 이름으로 걸리면 걸린 탭만 제 주소로 선다.** 묶음 이름만 서면 걸린 글자가 화면에 없어
   * 왜 걸렸는지 읽을 수 없다. 걸리지 않은 형제 탭은 서지 않고, 탭은 묶음의 아이콘을 물려받는다.
   */
  it('탭 이름으로 걸리면 걸린 탭들이 묶음의 아이콘으로 펼쳐져 선다', () => {
    const result = filterNavGroups(GROUPS, '환산');

    expect(result.map((group) => group.label)).toEqual(['가 섹션']);
    expect(result[0]?.items).toEqual([
      /* 보이는 이름은 「묶음 › 탭」이다 — 탭 이름만으로는 묶음 밖에서 무엇인지 모른다. */
      {
        to: '/hub/second',
        label: '공구 묶음 › 둘째 환산',
        labelVi: 'Tool hub › Second conversion',
        icon: 'h',
      },
      {
        to: '/hub/third',
        label: '공구 묶음 › 셋째 환산',
        labelVi: 'Tool hub › Third conversion',
        icon: 'h',
      },
    ]);
  });

  /** 묶음 이름과 탭 이름이 둘 다 걸리면 묶음이 이긴다 — 같은 화면이 두 줄로 서지 않는다. */
  it('묶음 이름과 탭 이름이 함께 걸리면 묶음 하나만 선다', () => {
    const both: NavEntry = { ...HUB, label: '환산 묶음' };
    const result = filterNavGroups(
      [{ label: '가 섹션', labelVi: 'A', icon: 'a', items: [both] }],
      '환산',
    );

    expect(result[0]?.items).toEqual([both]);
  });

  it('묶음 밖 항목은 종전대로 제 이름으로 걸린다', () => {
    expect(filterNavGroups(GROUPS, '평범')[0]?.items).toEqual([PLAIN]);
  });

  it('맞는 것이 없는 섹션은 빠진다', () => {
    expect(filterNavGroups(GROUPS, '다른').map((group) => group.label)).toEqual(['나 섹션']);
  });

  /** 대소문자·둘레 공백을 고른다 — 라벨에 영문이 섞여 있다. 탭 이름에도 같은 규칙이 선다. */
  it('탭 이름도 대소문자와 둘레 공백을 가리지 않는다', () => {
    const hub: NavEntry = {
      ...HUB,
      tabs: [
        { to: '/hub/first', label: 'IQC 기준', labelVi: 'IQC' },
        { to: '/hub/second', label: 'PQC 기준', labelVi: 'PQC' },
      ],
    };
    const result = filterNavGroups(
      [{ label: '가 섹션', labelVi: 'A', icon: 'a', items: [hub] }],
      '  pqc ',
    );

    expect(result[0]?.items.map((item) => item.to)).toEqual(['/hub/second']);
  });
});

describe('hasNoNavMatch — 탭 묶음', () => {
  /** 탭 이름으로만 걸려도 「하나도 없다」가 아니다 — 그러면 결과 옆에 「없음」 안내가 함께 선다. */
  it('탭 이름으로만 걸려도 결과가 있다고 본다', () => {
    expect(hasNoNavMatch([HUB], '둘째')).toBe(false);
  });

  it('묶음 이름으로 걸려도 결과가 있다고 본다', () => {
    expect(hasNoNavMatch([HUB], '공구')).toBe(false);
  });

  it('아무것도 걸리지 않으면 없다고 본다', () => {
    expect(hasNoNavMatch([HUB, PLAIN], '없는 이름')).toBe(true);
  });

  it('빈 검색어는 「없다」가 아니다', () => {
    expect(hasNoNavMatch([], '')).toBe(false);
  });
});

describe('matchesNavEntry', () => {
  it('빈 검색어면 늘 걸린다', () => {
    expect(matchesNavEntry(PLAIN, '')).toBe(true);
  });

  it('이름의 일부로 걸린다', () => {
    expect(matchesNavEntry(PLAIN, '평범')).toBe(true);
    expect(matchesNavEntry(PLAIN, '다른')).toBe(false);
  });
});

describe('filterNavGroupsByAccess — 탭 묶음', () => {
  /** 판정할 근거가 없으면 거르지 않는다 — 원본을 그대로 돌려준다. */
  it('권한을 모르면 원본을 같은 참조로 돌려준다', () => {
    expect(filterNavGroupsByAccess(GROUPS, { state: 'unknown', allows: () => false })).toBe(GROUPS);
  });

  it('탭을 전부 볼 수 있으면 묶음이 그대로 남는다', () => {
    const result = filterNavGroupsByAccess(
      GROUPS,
      allowing('/plain', '/hub/first', '/hub/second', '/hub/third', '/other'),
    );

    expect(result[0]?.items[1]).toEqual(HUB);
  });

  /**
   * ⭐ **볼 수 있는 탭만 남기고, 그 첫 탭으로 건다.** 첫 탭을 못 보는 사람에게 묶음 주소(첫 탭)를
   * 그대로 걸면 누르는 순간 막힌 화면이 선다.
   */
  it('볼 수 있는 탭만 남기고 묶음 주소를 볼 수 있는 첫 탭으로 바꿔 건다', () => {
    const result = filterNavGroupsByAccess(GROUPS, allowing('/hub/second', '/hub/third'));

    expect(result.map((group) => group.label)).toEqual(['가 섹션']);
    expect(result[0]?.items).toEqual([
      {
        ...HUB,
        to: '/hub/second',
        tabs: [
          { to: '/hub/second', label: '둘째 환산', labelVi: 'Second conversion' },
          { to: '/hub/third', label: '셋째 환산', labelVi: 'Third conversion' },
        ],
      },
    ]);
  });

  /** 한 탭만 남아도 묶음 줄은 선다 — 그 한 탭을 건다(탭 막대를 세울지는 셸이 정한다). */
  it('한 탭만 볼 수 있으면 그 탭 하나를 품은 묶음으로 남는다', () => {
    const result = filterNavGroupsByAccess(GROUPS, allowing('/hub/third'));

    expect(result[0]?.items).toEqual([
      {
        ...HUB,
        to: '/hub/third',
        tabs: [{ to: '/hub/third', label: '셋째 환산', labelVi: 'Third conversion' }],
      },
    ]);
  });

  /** 볼 수 있는 탭이 없으면 묶음째 감춘다 — 누를 곳이 없는 줄을 세우지 않는다. */
  it('볼 수 있는 탭이 하나도 없으면 묶음이 빠진다', () => {
    const result = filterNavGroupsByAccess(GROUPS, allowing('/plain'));

    expect(result[0]?.items).toEqual([PLAIN]);
  });

  /**
   * ⚠ **묶음 자신의 주소로 판정하지 않는다.** 묶음 주소(첫 탭)가 막혀도 다른 탭이 열려 있으면
   * 묶음은 산다 — 묶음 주소로 재면 다른 탭으로 가는 길이 통째로 사라진다.
   */
  it('묶음 주소가 막혀도 다른 탭이 열려 있으면 묶음이 남는다', () => {
    const result = filterNavGroupsByAccess(GROUPS, allowing('/hub/second'));

    expect(result[0]?.items.map((item) => item.label)).toEqual(['공구 묶음']);
  });

  it('남은 항목이 없는 섹션은 빠진다', () => {
    expect(filterNavGroupsByAccess(GROUPS, allowing('/other')).map((group) => group.label)).toEqual(
      ['나 섹션'],
    );
  });

  /** 권한으로 거른 결과를 검색하면 볼 수 없는 탭은 검색으로도 되살아나지 않는다. */
  it('권한으로 거른 뒤 검색하면 볼 수 없는 탭이 걸리지 않는다', () => {
    const allowed = filterNavGroupsByAccess(GROUPS, allowing('/hub/second'));

    expect(filterNavGroups(allowed, '셋째')).toEqual([]);
    expect(filterNavGroups(allowed, '둘째')[0]?.items.map((item) => item.to)).toEqual([
      '/hub/second',
    ]);
  });
});

describe('isNavEntryAllowed', () => {
  it('항목 주소로 판정한다', () => {
    expect(isNavEntryAllowed(PLAIN, allowing('/plain'))).toBe(true);
    expect(isNavEntryAllowed(PLAIN, allowing('/other'))).toBe(false);
  });
});

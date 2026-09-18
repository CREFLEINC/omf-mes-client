import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * 이 부품이 쓰는 클래스가 **CSS 에 정의돼 있는가.**
 *
 * ⛔ **정의 없는 클래스는 조용히 간격 0 이 된다.** 이 대화상자는 조회 줄에 `filter-row` 를
 *    적어 두었는데 그 클래스는 저장소 어디에도 없었다 — 유형·검색어·찾기와 표·쪽 이동이 맨
 *    블록으로 쌓여 서로 붙어 섰고, 값을 고칠 대상이 아예 없었다(실측 2026-09-18).
 *
 * ⚠ **기존 POP 감지기(`app/pop-classes.test.ts`)가 이 자리를 못 본다.** 그쪽은 POP 화면과
 *   `pop-`·`pack-work-` 접두어만 훑는다 — `patterns/` 의 공용 부품이 쓰는 비접두어 클래스는
 *   아무도 지키지 않고, 이번 것이 그 구멍으로 새어 나온 첫 사례다.
 *
 * ⭐ **여기서는 이 부품만 지킨다.** 저장소 전체로 넓히는 것은 범위가 크고(디자인 시스템이
 *    내려 주는 클래스와 전역 CSS 를 함께 가려야 한다) 별건으로 올렸다 — 그 전까지 적어도
 *    이 자리가 다시 비지는 않게 한다.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = join(HERE, '..', '..');

const CSS = ['app/app.css', 'app/pop.css']
  .map((relative) => readFileSync(join(WEB_SRC, relative), 'utf8'))
  .join('\n')
  /* 주석 안의 이름은 정의가 아니다 — 지운 규칙을 설명하는 글에 이름이 남아 있다. */
  .replace(/\/\*[\s\S]*?\*\//gu, '');

const SOURCE = readFileSync(join(HERE, 'dialog.tsx'), 'utf8');

/**
 * 이 부품이 «스스로» 적은 클래스 이름.
 *
 * ⚠ 디자인 시스템이 제 안에서 붙이는 이름은 여기 잡히지 않는다 — 그쪽은 DS 가 지킨다.
 */
const usedClassNames = (): string[] => {
  const used = new Set<string>();

  for (const [, quoted] of SOURCE.matchAll(/className=(?:"([^"]*)")/gu)) {
    for (const name of (quoted ?? '').split(/\s+/u)) {
      if (name !== '') used.add(name);
    }
  }

  return [...used];
};

describe('품목 선택 대화상자가 쓰는 클래스', () => {
  /** ⛔ 빈 통과를 막는다 — 모을 것이 없으면 아래 감지기가 저절로 성립한다. */
  it('세는 것이 있다', () => {
    expect(usedClassNames().length).toBeGreaterThan(0);
  });

  it('CSS 에 전부 정의돼 있다 — 없으면 간격이 조용히 0 이 된다', () => {
    const missing = usedClassNames().filter(
      (name) => !new RegExp(`\\.${name}(?![\\w-])`, 'u').test(CSS),
    );

    expect(missing).toEqual([]);
  });
});

/**
 * ⭐ **창 크기를 처음부터 고정한다**(사용자 지시 2026-09-18) — 빈 상태로 작게 떴다가 결과가
 *    오면 자라는 모양이었다. 검색을 되풀이하면 창이 눈앞에서 커졌다 줄었다 한다.
 *
 * ⚠ **jsdom 은 배치를 재지 못한다.** 실제 높이가 고정됐는지는 여기서 잴 수 없어 **선언이 있는지**를
 *   붙든다 — 요구를 담고 있는 것이 그 선언이고, 그것이 지워지면 요구가 사라진다. 실제로 그렇게
 *   보이는지는 실기 확인의 몫이다.
 */
describe('품목 선택 대화상자의 크기', () => {
  const ruleOf = (selector: string): string => {
    const found = new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'u').exec(CSS);

    return found?.[1] ?? '';
  };

  it('본문 높이를 고정한다 — 결과 수에 따라 창이 커졌다 줄었다 하지 않는다', () => {
    expect(ruleOf('item-picker-body')).toMatch(/\bblock-size:/u);
  });

  /* 상한이 없으면 작은 화면에서 창이 화면을 넘는다 — 바닥과 상한을 함께 둔다. */
  it('작은 화면에서 화면을 넘지 않게 상한을 함께 둔다', () => {
    expect(ruleOf('item-picker-body')).toMatch(/min\(/u);
  });

  /*
   * ⛔ **넘치는 것은 결과 표»만«이다.** 조회 줄과 쪽 이동 줄은 늘 같은 자리에 남아야 한다 —
   *    `min-block-size: 0` 이 없으면 플렉스 자식이 내용보다 작아지지 못해 스크롤이 생기지 않고
   *    창이 늘어난다.
   */
  it('결과 표만 그 안에서 스크롤한다', () => {
    const rule = ruleOf('item-picker-results');

    expect(rule).toMatch(/overflow-y:\s*auto/u);
    expect(rule).toMatch(/min-block-size:\s*0/u);
  });
});

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

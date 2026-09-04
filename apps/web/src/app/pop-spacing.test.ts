import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * POP 바닥 여백 감지기 — **「마지막 자식이 무엇인가」에 기대지 않는지** 본다.
 *
 * 렌더 테스트로는 잡히지 않는다. `vitest.config.ts`가 `css: false`라 스타일이 테스트에
 * 도달하지 않고, 화면은 여백이 0이어도 멀쩡히 뜬다 — 게이트가 전부 초록인 채로 단말에서만
 * 본문이 화면 바닥에 붙는다.
 *
 * 실측으로 겪은 것: 바닥 여백을 `.pop-ui > :last-child`의 `margin-block-end`로 주었더니,
 * 닫힌 `<dialog>`를 끝에 단 화면(인식표 발행·재포장 라벨)에서 **여백이 보이지 않는 요소로
 * 갔다.** 창은 화면 어디에나 붙을 수 있으므로 그릇이 자기 안쪽에 자리를 잡아 둬야 한다.
 */
const cssSource = readFileSync(resolve(process.cwd(), 'src/app/pop.css'), 'utf8');

/** 주석을 걷어낸 규칙 원문 — 주석에 적힌 선택자가 규칙으로 잡히지 않게 한다. */
const rules = cssSource.replace(/\/\*[\s\S]*?\*\//gu, '');

describe('POP 바닥 여백', () => {
  it('그릇이 자기 안쪽에 잡아 둔다 — `.pop-ui`에 바닥 안쪽 여백이 있다', () => {
    expect(rules).toMatch(/\.pop-ui\s*\{[^}]*padding:\s*0\s+0\s+var\(--pop-pad\)/u);
  });

  it('덮개도 같은 방식으로 잡아 둔다', () => {
    expect(rules).toMatch(
      /\.pop-ui\s*>\s*\.pop-overlay\s*\{[^}]*padding:\s*0\s+0\s+var\(--pop-pad\)/u,
    );
  });

  /**
   * ⛔ 되돌아가는 것을 막는다. `:last-child`로 주면 닫힌 창이 여백을 가져간다.
   * (`.banner-slot` 안쪽처럼 «구획 내부»를 겨냥하는 `:last-child`는 대상이 아니다 —
   * 여기서 막는 것은 화면 최상위 자식을 겨냥하는 형태 하나뿐이다.)
   */
  it('최상위 자식의 `:last-child`에 바닥 바깥여백을 주지 않는다', () => {
    expect(rules).not.toMatch(/\.pop-ui\s*>\s*:last-child\s*\{[^}]*margin-block-end/u);
    expect(rules).not.toMatch(
      /\.pop-ui\s*>\s*\.pop-overlay\s*>\s*:last-child\s*\{[^}]*margin-block-end/u,
    );
  });
});

/**
 * 덮개 감지기 — **덮개가 화면 배치 규칙에서 빠져 있는지** 본다.
 *
 * 덮개(`position: fixed`)는 자기 세로 예산을 스스로 잰다. `.pop-ui`의 「남는 높이를 나눠
 * 갖는다」 규칙이 덮개 «안»까지 들어가면 `min-height: 0`이 얹혀 그 예산이 무너진다
 * (실측: 판정 칸 152 → 64px).
 */
describe('POP 덮개', () => {
  it('머리줄 규격이 덮개의 머리줄까지 닿는다', () => {
    expect(rules).toContain('.pop-ui > .pop-overlay > .pop-header');
  });

  /**
   * 겨냥 대상은 **최상위 자식을 `:not(…)` 목록으로 잡는 규칙**이다 — 「무엇이 늘어나지
   * 않는가」를 적는 그 형태. 그 목록에 덮개가 빠져 있으면 덮개가 화면 구획으로 취급된다.
   */
  it('최상위 자식을 겨냥하는 규칙은 모두 덮개를 뺀다', () => {
    const childRules = rules
      .split('}')
      .filter((block) => /\.pop-ui\s*>\s*:not\(/u.test(block));

    expect(childRules.length).toBeGreaterThan(0);

    for (const block of childRules) {
      expect(block).toContain(':not(.pop-overlay)');
    }
  });
});

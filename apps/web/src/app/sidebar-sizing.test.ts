import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 사이드바 항목 높이 감지기 — **섹션 밖 항목이 줄어들지 않는지** 본다(#1077).
 *
 * 렌더 테스트로는 잡히지 않는다. `vitest.config.ts`가 `css: false`라 스타일이 테스트에
 * 도달하지 않고, jsdom 은 애초에 레이아웃을 계산하지 않아 높이를 물어도 0 을 준다. 게이트가
 * 전부 초록인 채로 브라우저에서만 한 줄이 절반으로 찌그러진다.
 *
 * 실측으로 겪은 것(헤드리스 Chrome 1440×900): 섹션 밖 항목 **24px** · 섹션 안 항목 69개
 * **48px**. 사이드바 목록이 세로 flex 이고 내용(4208px)이 상자(749px)를 넘기므로, 스크롤로
 * 넘기기 **전에** flex 가 항목을 줄인다 — 섹션 안 항목은 섹션의 자식이라 그 계산에 직접
 * 노출되지 않고 직계 항목만 찌그러진다.
 *
 * 짝이 되는 렌더 감지기는 `layout.test.tsx`가 갖는다 — 그쪽은 **클래스가 그 항목에 붙는지**를
 * 보고, 이쪽은 **그 클래스가 실제로 막는지**를 본다. 둘 중 하나만으로는 닿지 않는다.
 */
const cssSource = readFileSync(resolve(process.cwd(), 'src/app/app.css'), 'utf8');

/** 주석을 걷어낸 규칙 원문 — 주석에 적힌 선택자가 규칙으로 잡히지 않게 한다. */
const rules = cssSource.replace(/\/\*[\s\S]*?\*\//gu, '');

describe('사이드바 항목 높이', () => {
  /**
   * **철자가 아니라 「줄어듦이 막혔는가」를 잰다.** `flex: none`과 `flex-shrink: 0`은 이 자리에서
   * 동작이 **완전히 같다** — DS 항목에 `flex` 계열 선언이 하나도 없어 `flex: none`이 실제로
   * 바꾸는 것은 `flex-shrink: 1 → 0` 하나뿐이다(`web-ui.css` 확인). 상류가 어느 쪽 철자로
   * 고쳐지든 앱 쪽 우회를 그에 맞춰 좁힐 수 있어야 하고, 그때 이 감지기가 회귀를 알리면 안 된다.
   */
  it('섹션 밖 항목은 목록의 넘침에 줄어들지 않는다 — `.sidebar-lead`가 flex 축소를 막는다', () => {
    expect(rules).toMatch(/\.sidebar-lead\s*\{[^}]*(?:flex:\s*none|flex-shrink:\s*0)/u);
  });

  /**
   * ⛔ 되돌아가는 것을 막는다. 높이를 직접 적어 막으면 DS 토큰(`--control-height-lg`)과
   * 값이 갈라져, 토큰이 바뀌는 날 이 한 줄만 옛 높이로 남는다. 막아야 하는 것은 **줄어듦**이다.
   */
  it('높이를 직접 적어 막지 않는다', () => {
    expect(rules).not.toMatch(/\.sidebar-lead\s*\{[^}]*height:/u);
  });
});

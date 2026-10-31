import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * POP 머리줄의 보조 동작([사용자 전환], [화면 이동], [단말 재등록])은 테두리 버튼이다
 * (화면 구성 규범 C-3, C-19: 채움과 빨강은 화면의 주 동작 하나에만 쓴다).
 *
 * 부품의 `variant` 를 바꿔도 CSS 가 바탕과 글자색을 덮어쓰면 화면은 그대로다. 실제로
 * `.pop-logout button` 이 바탕을 빨강으로 칠해 [사용자 전환]이 채움 버튼으로 남았다. 이 시험은
 * 보조 동작 버튼을 겨냥한 CSS 규칙이 모양(바탕, 글자색, 테두리)을 덮어쓰지 않는지 잰다.
 */
const SECONDARY_SELECTORS = ['.pop-logout', '.pop-screen-nav', '.pop-terminal-header__reregister'];
const LOOK_PROPERTIES = /(?:^|;|\s)(background(?:-color)?|color|border(?:-color)?|box-shadow)\s*:/u;

const rulesOf = (file: string): { selector: string; body: string }[] =>
  readFileSync(resolve(process.cwd(), file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .split('}')
    .map((chunk) => {
      const [selector = '', body = ''] = chunk.split('{');
      return { selector: selector.trim(), body };
    })
    .filter(({ body }) => body.trim() !== '');

const sources = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('POP 머리줄 보조 동작은 테두리 버튼으로 그려진다', () => {
  it.each(['src/app/pop.css', 'src/app/app.css'])(
    '%s 가 보조 동작 버튼의 바탕, 글자색, 테두리를 덮어쓰지 않는다',
    (file) => {
      const overrides = rulesOf(file).filter(
        ({ selector, body }) =>
          SECONDARY_SELECTORS.some((target) => selector.includes(target)) &&
          /button|__reregister/u.test(selector) &&
          LOOK_PROPERTIES.test(body),
      );

      expect(overrides.map(({ selector }) => selector)).toEqual([]);
    },
  );

  it.each([
    ['src/patterns/pop-logout.tsx', 'variant="outlined"'],
    ['src/screens/worker-assignment/screen.tsx', 'variant="outlined"'],
  ])('%s 의 보조 동작은 테두리 변형이다', (path, variant) => {
    expect(sources(path)).toContain(variant);
    expect(sources(path)).not.toMatch(
      /variant="filled"[\s\S]{0,80}pop-terminal-header__reregister/u,
    );
  });
});

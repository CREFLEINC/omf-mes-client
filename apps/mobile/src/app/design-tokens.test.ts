import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');
const DS = join(HERE, '..', '..', 'node_modules', '@crefle', 'web-ui');

const filesUnder = (root: string, ext: string): string[] => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (path.endsWith(ext)) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
};

const declaredTokens = (): Set<string> => {
  const names = new Set<string>();
  for (const css of [...filesUnder(join(DS, 'styles'), '.css'), join(DS, 'dist', 'web-ui.css')]) {
    for (const match of readFileSync(css, 'utf-8').matchAll(/(--[a-z0-9-]+)\s*:/g)) {
      names.add(match[1]!);
    }
  }
  return names;
};

/*
 * 디자인 시스템이 아니라 Capacitor(SystemBars)가 실행 중에 문서에 넣어 주는 변수다.
 * 시스템 바 높이라 우리가 정할 값이 아니고, CSS 파일에는 선언이 없다.
 */
const PLATFORM_VARIABLES = new Set([
  '--safe-area-inset-top',
  '--safe-area-inset-right',
  '--safe-area-inset-bottom',
  '--safe-area-inset-left',
]);

/*
 * 디자인 시스템이 아니라 앱이 실행 중에 재어 넣는 값이다. 숫자판이 선 높이를 알려야 그만큼
 * 아래를 비울 수 있는데, 그 높이는 머리줄 길이에 따라 달라져 CSS 에 적어 둘 수 없다.
 */
const MEASURED_VARIABLES = new Set(['--docked-pad-height']);

/**
 * 없는 토큰은 조용히 대체값으로 떨어진다.
 *
 * 화면은 그럴듯하게 보이지만 디자인 시스템을 따르지 않는 값이 되고, 토큰이 바뀌어도 그 자리만
 * 안 바뀐다. 실제로 글자 크기만 바꾸고 줄 높이를 놓쳐 카드 위쪽 여백이 사라진 적이 있다.
 */
describe('디자인 토큰', () => {
  it('디자인 시스템에 없는 토큰을 쓰지 않는다', () => {
    const declared = declaredTokens();
    const offenders: string[] = [];

    for (const css of filesUnder(SRC, '.css')) {
      for (const match of readFileSync(css, 'utf-8').matchAll(/var\((--[a-z0-9-]+)/g)) {
        if (
          !declared.has(match[1]!) &&
          !PLATFORM_VARIABLES.has(match[1]!) &&
          !MEASURED_VARIABLES.has(match[1]!)
        ) {
          offenders.push(`${css.slice(SRC.length + 1)} :: ${match[1]!}`);
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });
});

/**
 * 디자인 시스템이 부품 속에 그리는 태그.
 *
 * 부품의 겉을 꾸미는 것은 정당하다 - 창을 시스템 바 밖으로 밀 때 `dialog` 를 고르는 것이
 * 그렇다. 문제는 속에 닿는 것이다. 창의 머리와 바닥은 부르는 쪽이 겨냥한 적 없는데 닿는다.
 *
 * `p` 처럼 더 흔한 태그도 속에 있지만 화면 CSS 여러 곳이 이미 그것으로 고른다. `main` 은
 * 랜드마크이나 셸이 직접 그려 자기 것이다.
 */
const DS_TAGS = ['header', 'footer', 'nav'];

const selectorsIn = (css: string): string[] =>
  [...css.replaceAll(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map((match) =>
    match[1]!.trim(),
  );

/**
 * 우리 것으로 좁히지 않고 태그만으로 고른 자리.
 *
 * `header.mobile-shell__topbar` 처럼 클래스나 아이디로 좁힌 것은 남의 부품에 닿지 않는다.
 * 맨 `header` 와 `header:first-of-type` · `header[role]` · `:is(header, main)` 은 닿는다 -
 * 도달 범위가 같은데 글자만 다르다.
 *
 * `:not()` 과 `:has()` 안은 겨냥이 아니라 조건이라 펴지 않는다.
 */
const unscopedTagsIn = (selector: string): string[] => {
  const opened = selector.replaceAll(/:(not|has)\([^)]*\)/g, ' ').replaceAll(/[():,]/g, ' ');

  return opened
    .split(/[\s>+~]+/)
    .filter((part) => !/[.#]/.test(part))
    .map((part) => /^[a-z][a-z0-9]*/.exec(part)?.[0])
    .filter((tag): tag is string => tag !== undefined);
};

/**
 * 디자인 시스템이 그리는 태그를 우리 것으로 좁히지 않고 고르지 않는다.
 *
 * 앱바를 `.mobile-shell header` 로 꾸몄더니 디자인 시스템이 창의 머리도 header 로 그려, 셸 안의
 * 모든 창이 그 여백을 뒤집어썼다 - 제목이 상태바에 붙었다. 부품 안을 겨냥하지 않았는데 닿는
 * 것이라 화면을 열어 보기 전에는 드러나지 않는다.
 */
describe('선택자 범위', () => {
  it('디자인 시스템이 그리는 태그를 좁히지 않고 고르지 않는다', () => {
    const offenders: string[] = [];

    for (const css of filesUnder(SRC, '.css')) {
      for (const selector of selectorsIn(readFileSync(css, 'utf-8'))) {
        if (selector.startsWith('@')) {
          continue;
        }

        if (unscopedTagsIn(selector).some((tag) => DS_TAGS.includes(tag))) {
          offenders.push(`${css.slice(SRC.length + 1)} :: ${selector}`);
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });

  /* 이 시험 자체가 글자만 다른 같은 결함을 놓치면 아무것도 막지 못한다. */
  it('좁힌 것과 좁히지 않은 것을 가른다', () => {
    const reaching = [
      '.mobile-shell header',
      '.mobile-shell header:first-of-type',
      '.mobile-shell header[role]',
      '.mobile-shell header::before',
      '.mobile-shell :is(header, main)',
    ];
    const scoped = [
      '.mobile-shell header.mobile-shell__topbar',
      '.mobile-shell header.x > *:first-child',
      '.mobile-shell :not(header)',
      '.mobile-shell .x:has(header)',
      '.mobile-shell [data-x=header]',
      '0%',
    ];

    /* 목록을 거쳐 판정한다. 태그를 목록에서 빼는 것도 감지기를 끄는 일이다. */
    const reaches = (selector: string) =>
      unscopedTagsIn(selector).some((tag) => DS_TAGS.includes(tag));

    for (const selector of reaching) {
      expect([selector, reaches(selector)]).toEqual([selector, true]);
    }

    for (const selector of scoped) {
      expect([selector, reaches(selector)]).toEqual([selector, false]);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');

const cssFiles = (): string[] => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (path.endsWith('.css')) {
        found.push(path);
      }
    }
  };
  walk(SRC);
  return found;
};

/**
 * `@media` 같은 감싸개를 벗겨 규칙만 남긴다.
 *
 * 벗기지 않으면 감싸개의 여는 중괄호에서 블록 나누기가 멎어 그 안의 규칙을 한 번도 보지
 * 못한다. 검사가 초록인 까닭이 「없다」가 아니라 「못 본다」가 된다.
 */
const flattened = (css: string): string => {
  let text = css;

  for (let round = 0; round < 5; round += 1) {
    const next = text.replace(/@[a-z-]+[^{};]*\{([\s\S]*?)\n\}/g, '$1');

    if (next === text) {
      break;
    }

    text = next;
  }

  return text;
};

/** 선택자와 선언부를 한 덩어리로 자른다. 한 줄에 규칙이 여럿이어도 각각 잡는다. */
const blocksOf = (css: string): { 선택자: string; 선언: string }[] =>
  [...flattened(css).matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((match) => ({
    선택자: (match[1] ?? '').trim().replace(/\s+/g, ' '),
    선언: match[2] ?? '',
  }));

/** 화면 아래에 붙였는가. 논리속성과 `inset` 단축도 같은 뜻이다. */
const stuckToBottom = (declarations: string): boolean =>
  /(^|[\s;{])(bottom|inset-block-end)\s*:\s*0/.test(declarations) ||
  /(^|[\s;{])inset\s*:[^;]*\s0\s*;?\s*$/m.test(declarations);

/**
 * 화면 아래에 붙는 것은 기기의 내비게이션 바에 깔린다.
 *
 * 홈·뒤로가기 버튼이 화면 안에 있는 단말에서는 그 띠가 화면 맨 아래를 차지한다. 비우지 않으면
 * 맨 아랫줄이 그 아래로 들어가 눌리지 않는다.
 */
describe('하단 안전영역', () => {
  it('화면 아래에 고정되는 것은 안전영역만큼 비운다', () => {
    const offenders: string[] = [];

    for (const file of cssFiles()) {
      for (const block of blocksOf(readFileSync(file, 'utf-8'))) {
        if (!/position:\s*fixed/.test(block.선언) || !stuckToBottom(block.선언)) {
          continue;
        }

        if (!/safe-area-inset-bottom/.test(block.선언)) {
          offenders.push(`${file.slice(SRC.length + 1)} :: ${block.선택자}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /*
   * Capacitor 가 변수를 넣어 주지 않는 자리가 있다. 브라우저로 여는 개발 화면이 그렇다.
   * `env()` 로 이어 두지 않으면 그 자리에서 여백이 통째로 0 이 된다.
   */
  it('안전영역 변수는 같은 이름의 env 로 이어 둔다', () => {
    const offenders: string[] = [];

    for (const file of cssFiles()) {
      const css = readFileSync(file, 'utf-8');

      for (const match of css.matchAll(/var\(--safe-area-inset-([a-z]+)\s*,([^)]*\)?[^)]*)\)/g)) {
        const side = match[1] ?? '';

        if (!new RegExp(`env\\(safe-area-inset-${side}`).test(match[2] ?? '')) {
          offenders.push(`${file.slice(SRC.length + 1)} :: ${match[0]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

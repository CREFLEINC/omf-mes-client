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

/** 규칙 하나를 통째로 잘라 온다. 중괄호 안에 다른 규칙이 없는 평범한 CSS 만 다룬다. */
const ruleOf = (css: string, selector: string): string | null => {
  const at = css.indexOf(selector);

  if (at === -1) {
    return null;
  }

  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);

  return open === -1 || close === -1 ? null : css.slice(open + 1, close);
};

/**
 * 화면 아래에 붙는 것은 기기의 내비게이션 바에 깔린다.
 *
 * 홈·뒤로가기 버튼이 화면 안에 있는 단말에서는 그 띠가 화면 맨 아래를 차지한다. 비우지 않으면
 * 맨 아랫줄이 그 아래로 들어가 눌리지 않는다. 셸의 다른 고정 요소는 이미 비우고 있다.
 */
describe('하단 안전영역', () => {
  it('화면 아래에 고정되는 것은 안전영역만큼 비운다', () => {
    const offenders: string[] = [];

    for (const file of cssFiles()) {
      const css = readFileSync(file, 'utf-8');

      for (const match of css.matchAll(/(^|\n)([^{}\n]*\{[^{}]*)/g)) {
        const block = match[2] ?? '';

        if (!/position:\s*fixed/.test(block) || !/bottom:\s*0/.test(block)) {
          continue;
        }

        if (!/safe-area-inset-bottom/.test(block)) {
          offenders.push(`${file.slice(SRC.length + 1)} :: ${block.split('{')[0]?.trim() ?? ''}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /* 값이 없는 단말도 있다. 대체값이 없으면 계산 전체가 무효가 되어 여백이 통째로 사라진다. */
  it('안전영역을 읽을 때 대체값을 함께 둔다', () => {
    const offenders: string[] = [];

    for (const file of cssFiles()) {
      const css = readFileSync(file, 'utf-8');

      for (const match of css.matchAll(/var\(--safe-area-inset-[a-z]+([^)]*)\)/g)) {
        if (!(match[1] ?? '').includes(',')) {
          offenders.push(`${file.slice(SRC.length + 1)} :: ${match[0]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

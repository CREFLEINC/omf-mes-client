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

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 스캔한 코드는 띄어쓰기가 없는 한 덩어리다. 접히지 않으면 상자 밖으로 나가 뒷자리가 잘리고,
 * 잘렸다는 표시가 없어 작업자는 보이는 데까지를 번호 전체로 읽는다. 실제로 34자리 자재 LOT 이
 * 360dp 화면에서 카드 밖으로 나가 있었다.
 */
describe('코드 줄바꿈', () => {
  it('본문 전체에 줄바꿈을 허용한다', () => {
    const css = stripComments(readFileSync(join(SRC, 'app', 'app.css'), 'utf-8'));
    const rule = /\.mobile-shell\s*>\s*main\s*\{[^}]*overflow-wrap:\s*anywhere/;

    expect(css).toMatch(rule);
  });

  /**
   * 되돌리는 선언 하나면 그 화면만 다시 넘친다. 셸에 건 규칙은 상속이라, 화면 CSS 가
   * normal 로 덮으면 조용히 꺼진다.
   */
  it('화면 CSS 가 줄바꿈을 되돌리지 않는다', () => {
    const offenders: string[] = [];

    for (const path of cssFiles()) {
      const css = stripComments(readFileSync(path, 'utf-8'));
      for (const match of css.matchAll(/overflow-wrap:\s*([a-z-]+)/g)) {
        if (match[1] === 'normal') {
          offenders.push(`${path.slice(SRC.length + 1)} — overflow-wrap: ${match[1]}`);
        }
      }
      for (const match of css.matchAll(/word-break:\s*([a-z-]+)/g)) {
        if (match[1] === 'keep-all') {
          offenders.push(`${path.slice(SRC.length + 1)} — word-break: ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

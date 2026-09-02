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
        if (!declared.has(match[1]!)) {
          offenders.push(`${css.slice(SRC.length + 1)} :: ${match[1]!}`);
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });
});

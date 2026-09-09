import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENS = join(HERE, '..', 'screens');

const screenFiles = (): string[] => {
  const found: string[] = [];

  for (const entry of readdirSync(SCREENS)) {
    const path = join(SCREENS, entry, 'screen.tsx');

    if (statSync(join(SCREENS, entry)).isDirectory()) {
      try {
        statSync(path);
        found.push(path);
      } catch {
        /* 화면 파일 이름이 다른 폴더는 건너뛴다. */
      }
    }
  }

  return found;
};

/**
 * 숫자판을 쓰는 화면은 단말 키보드를 함께 부르지 않는다.
 *
 * 설계가 장갑 낀 손을 위해 큰 숫자판을 요구하는데, 그 칸에 inputMode 를 남겨 두면 누를 때
 * 단말 키보드까지 올라와 화면 절반이 덮이고 키가 둘로 갈린다. 두 자리를 각각 만든 사람이
 * 서로를 보지 못해 생긴다 - 화면마다 반복되므로 여기서 한 번에 막는다.
 */
describe('숫자판 칸', () => {
  it('숫자판을 쓰는 화면에는 단말 키보드를 부르는 칸이 없다', () => {
    const offenders: string[] = [];

    for (const path of screenFiles()) {
      const source = readFileSync(path, 'utf8');

      if (!source.includes('NumberPad')) {
        continue;
      }

      if (/inputMode="(?:decimal|numeric|tel)"/.test(source)) {
        offenders.push(path.slice(path.indexOf('screens')));
      }
    }

    expect(offenders).toEqual([]);
  });
});

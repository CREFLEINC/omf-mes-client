import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENS = join(HERE, '..', 'screens');

const screenSources = (): { path: string; source: string }[] => {
  const found: { path: string; source: string }[] = [];

  for (const entry of readdirSync(SCREENS)) {
    if (!statSync(join(SCREENS, entry)).isDirectory()) {
      continue;
    }

    for (const file of readdirSync(join(SCREENS, entry))) {
      if (!file.endsWith('.tsx') || file.includes('.test.')) {
        continue;
      }

      const path = join(SCREENS, entry, file);
      found.push({ path: path.slice(path.indexOf('screens')), source: readFileSync(path, 'utf8') });
    }
  }

  return found;
};

/**
 * 손 입력이 더할 것이 없는 화면.
 *
 * 이 둘은 스캔한 코드를 서버에 묻지 않고 미리 받아 둔 설비 목록에서 맞춘다. 목록이 오면
 * 선택칸으로 고를 수 있고, 목록이 안 오면 손으로 쳐도 맞출 데가 없다.
 */
const EXEMPT = ['equipment-failure', 'equipment-inspection'];

/**
 * 손으로 넣는 길은 스캔 칸 그 자리에서 연다.
 *
 * 스캐너 어댑터는 스캔 칸 요소에만 붙는다. 칸을 따로 세우면 열었을 때 포커스가 그리로
 * 옮겨 가고, 그 칸에는 어댑터가 없어 치는 도중 들어온 스캔이 손으로 친 글자 뒤에 그대로
 * 이어 붙는다. 스캔값이 이기는 동작이 서지 않는다.
 *
 * 화면마다 되풀이되는 자리라 여기서 한 번에 막는다.
 */
describe('수동 입력 칸', () => {
  it('스캔 칸과 나란히 두 번째 입력 칸을 세우지 않는다', () => {
    const offenders = screenSources()
      .filter(({ source }) => /<ManualEntry\b/.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('스캔 칸을 쓰는 화면은 그 칸을 손 입력으로 여는 길을 갖는다', () => {
    const offenders = screenSources()
      .filter(({ source }) => source.includes('useScanField'))
      /* 폴더 이름을 통째로 맞춘다. 부분 문자열로 재면 이름이 겹치는 새 화면이 조용히 빠진다. */
      .filter(({ path }) => !EXEMPT.some((name) => path.split(/[\\/]/).includes(name)))
      .filter(({ source }) => !source.includes('openManual'))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

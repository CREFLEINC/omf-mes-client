import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { popRoutes } from './pop';

const SOURCE_ROOT = resolve(process.cwd(), 'src');
const routeSource = readFileSync(join(SOURCE_ROOT, 'routes/pop.tsx'), 'utf8');
const screenDirectories = [
  ...new Set(
    [...routeSource.matchAll(/from '\.\.\/screens\/([^/]+)\/screen';/gu)].flatMap(
      ([, directory]) => (directory === undefined ? [] : [join(SOURCE_ROOT, 'screens', directory)]),
    ),
  ),
];

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name) ? [path] : [];
  });

describe('POP 공개 라우트 공통 규칙', () => {
  it('통합 뒤 고정 설계 범위의 공개 화면 17개를 모두 점검한다', () => {
    expect(popRoutes).toHaveLength(17);
  });

  it('모든 공개 화면의 루트가 관리웹 기본 밀도 겹을 쓴다', () => {
    const missing = screenDirectories
      .map((directory) => join(directory, 'screen.tsx'))
      .filter((path) => !readFileSync(path, 'utf8').includes('pop-ui'))
      .map((path) => path.slice(SOURCE_ROOT.length + 1));

    expect(missing).toEqual([]);
  });

  it('공개 POP 화면은 DS 드롭다운을 직접 쓰지 않고 G-34 팝업을 쓴다', () => {
    const directSelectImports = screenDirectories
      .flatMap(sourceFiles)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        const imports = source.match(/^import[\s\S]*?from '@crefle\/web-ui';/gmu) ?? [];

        return imports.some((statement) => /\bSelect\b/u.test(statement));
      })
      .map((path) => path.slice(dirname(SOURCE_ROOT).length + 1));

    expect(directSelectImports).toEqual([]);
  });
});

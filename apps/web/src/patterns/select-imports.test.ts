import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 관리웹의 선택 칸은 `patterns/select.tsx` 를 쓴다 — 선택지가 5개를 넘으면 목록 맨 위에 검색창이 서는 규칙
 * (사용자 지시 2026-10-28)이 화면마다 새지 않게, 디자인 시스템 `Select` 를 바로 가져오는 파일을 찾는다.
 *
 * ⚠ 막으려는 것은 실수다 — 별칭으로 다시 내보내는 우회까지는 잡지 않는다.
 */

/** 시험은 앱 패키지(`apps/web`)를 작업 디렉터리로 돈다. */
const SOURCE_ROOT = resolve(process.cwd(), 'src');
const WRAPPER = 'patterns/select.tsx';

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });

const DS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'@crefle\/web-ui'/g;

const importsDsSelect = (source: string): boolean =>
  [...source.matchAll(DS_IMPORT)].some((match) =>
    (match[1] ?? '')
      .split(',')
      .map((name) => name.trim())
      .includes('Select'),
  );

describe('선택 칸은 공용 Select 를 쓴다', () => {
  it('디자인 시스템 Select 를 바로 가져오는 화면이 없다', () => {
    const files = sourceFiles(SOURCE_ROOT);
    expect(files.length).toBeGreaterThan(100);

    const offenders = files
      .map((file) => relative(SOURCE_ROOT, file))
      .filter((file) => file !== WRAPPER)
      .filter((file) => importsDsSelect(readFileSync(join(SOURCE_ROOT, file), 'utf8')));

    expect(offenders).toEqual([]);
  });
});

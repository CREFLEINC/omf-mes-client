import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ko, vi, type Messages } from '@omf-mes/i18n';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');

const HANGUL = /[가-힣]/;

/** 모바일 화면이 실제로 읽는 문구 묶음. 웹·POP 몫은 이 화면들이 쓰지 않는다. */
const usedSlices = (): string[] => {
  const names = new Set<string>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);

      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }

      if (!/\.tsx?$/.test(entry) || entry.includes('.test.')) {
        continue;
      }

      for (const match of readFileSync(path, 'utf8').matchAll(/messages\.([a-zA-Z]+)/g)) {
        names.add(match[1]!);
      }
    }
  };

  walk(SRC);
  return [...names].filter((name) => name in ko);
};

/** 잎까지 내려가며 화면에 나가는 문자열을 모은다. 함수 문구는 부르지 않고는 볼 수 없다. */
const leaves = (value: unknown, path: string, found: [string, string][]): void => {
  if (typeof value === 'string') {
    found.push([path, value]);
    return;
  }

  if (typeof value === 'function') {
    /* 자리값을 채워 부른다. 템플릿 안 한국어는 부르지 않으면 드러나지 않는다. */
    const probe = (value as (...args: unknown[]) => unknown).length;
    const args = Array.from({ length: probe }, () => '0');

    try {
      const made = (value as (...args: unknown[]) => unknown)(...args);

      if (typeof made === 'string') {
        found.push([`${path}()`, made]);
      }
    } catch {
      /* 부를 수 없는 모양이면 건너뛴다. 여기서 막으면 나머지를 못 잰다. */
    }

    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      leaves(inner, path === '' ? key : `${path}.${key}`, found);
    }
  }
};

/**
 * 베트남어를 고른 사람에게 한국어가 보이지 않는가.
 *
 * 슬라이스를 통째로 빠뜨리거나 한 파일 안에서 몇 줄만 옮기다 만 것이 조용히 지나가면,
 * 현장은 절반이 읽히지 않는 화면을 받는다. 값 하나까지 내려가 센다.
 */
describe('베트남어 문구', () => {
  const slices = usedSlices();

  it('모바일이 쓰는 슬라이스를 하나도 빠뜨리지 않는다', () => {
    const untouched = slices.filter(
      (name) => vi[name as keyof Messages] === ko[name as keyof Messages],
    );

    expect(untouched).toEqual([]);
  });

  it('화면에 나가는 값에 한국어가 남지 않는다', () => {
    const offenders: string[] = [];

    for (const name of slices) {
      const found: [string, string][] = [];
      leaves(vi[name as keyof Messages], name, found);

      for (const [path, text] of found) {
        if (HANGUL.test(text)) {
          offenders.push(`${path} — ${text}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * 모바일이 쓰지 않는 슬라이스 — **옮겼으면 끝까지 옮겼는가.**
   *
   * ⚠ **이 자리는 원래 「한국어 그대로 둔다」였다.** 그때는 베트남어를 고르는 셸이 모바일뿐이라
   * 남의 슬라이스를 건드리는 것이 헛손질이었지만, 관리웹이 언어 선택을 갖게 되면서(#1113) 그
   * 전제가 뒤집혔다 — 이제 그 단언은 **다른 셸의 정당한 번역을 막는 빗장**이 된다.
   *
   * 막을 값이 남아 있어 지우지는 않는다: 어느 셸이 옮기든 **반쯤 옮긴 슬라이스**는 사고다.
   * 한 화면에 두 언어가 섞이면 안 옮긴 화면보다 읽기 어렵다.
   */
  it('모바일이 쓰지 않는 슬라이스도 옮겼으면 한국어가 남지 않는다', () => {
    const mobile = new Set(slices);
    const offenders: string[] = [];

    for (const name of Object.keys(ko) as (keyof Messages)[]) {
      if (mobile.has(name) || vi[name] === ko[name]) continue;

      const found: [string, string][] = [];
      leaves(vi[name], name, found);

      for (const [path, text] of found) {
        if (HANGUL.test(text)) offenders.push(`${path} — ${text}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

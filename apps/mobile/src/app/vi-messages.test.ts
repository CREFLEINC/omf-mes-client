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

  /* 웹·POP 몫은 건드리지 않는다. 그쪽은 베트남어를 고르지 않아 옮기면 손만 간다. */
  it('모바일이 쓰지 않는 슬라이스는 한국어 그대로 둔다', () => {
    const mobile = new Set(slices);
    const changed = Object.keys(ko).filter(
      (name) => !mobile.has(name) && vi[name as keyof Messages] !== ko[name as keyof Messages],
    );

    expect(changed).toEqual([]);
  });
});

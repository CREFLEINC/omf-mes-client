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
 * 구획 제목 규칙이 갈라지면 그 화면만 조용히 다른 크기로 선다.
 *
 * 같은 규칙이 세 파일에 복제돼 있었고, 그중 하나가 본문 크기에 묶여 그 화면만 제목이 서지
 * 않았다. 파일을 열어 보면 셋 다 그럴듯해 보여, 기기에서 재기 전까지 아무도 몰랐다.
 *
 * 예외를 두려면 여기에 적는다 - 적히지 않은 예외는 복제와 구별되지 않는다.
 */
const ALLOWED = [
  /* 화면 구획이 아니라 라벨과 값의 짝이다. 안내 패널 안이라 본문 크기로 둔다. */
  'app/../screens/device-registration/screen.css :: .device-registration__info h2',
];

describe('구획 제목', () => {
  it('규칙을 한 자리에만 둔다', () => {
    const offenders: string[] = [];

    for (const path of cssFiles()) {
      const name = path.slice(SRC.length + 1);
      for (const match of readFileSync(path, 'utf-8').matchAll(
        /^([^{}\n]*\bh[1-6]\b[^{}\n]*)\{/gm,
      )) {
        const selector = match[1]!.trim();
        if (selector === 'section > h2') continue;
        if (ALLOWED.some((each) => each.endsWith(`:: ${selector}`))) continue;
        offenders.push(`${name} :: ${selector}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

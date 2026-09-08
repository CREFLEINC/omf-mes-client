import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { popTouchClass, type PopTouchGrade } from '../patterns/pop-touch';

const appCss = readFileSync(resolve(process.cwd(), 'src/app/app.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
);
const popCss = readFileSync(resolve(process.cwd(), 'src/app/pop.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
);
const GRADES: PopTouchGrade[] = ['normal', 'primary', 'critical', 'destructive'];

describe('POP 관리웹 기본 밀도', () => {
  it('큰 컨트롤 변형도 관리웹 기본 md 높이로 수렴한다', () => {
    for (const token of ['lg', 'xl', '2xl']) {
      expect(popCss).toMatch(
        new RegExp(`--control-height-${token}:\\s*var\\(--control-height-md\\)`, 'u'),
      );
    }
  });

  it('폐기된 56~72px 터치 하한을 다시 선언하지 않는다', () => {
    const touchRules = appCss
      .split('}')
      .filter((block) => /\.pop-touch(?:-|\s|\{)/u.test(block))
      .join('}');

    expect(touchRules).not.toMatch(/(?:56|60|64|72)px/u);
    expect(touchRules).not.toContain('--pop-touch-size');
  });

  it('업무 중요도 등급은 서로 다른 의미 클래스로 남는다', () => {
    const classes = GRADES.map(popTouchClass);

    expect(new Set(classes).size).toBe(GRADES.length);
    for (const className of classes) {
      for (const name of className.split(' ')) expect(appCss).toContain(`.${name}`);
    }
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { popTouchClass, type PopTouchGrade } from '../patterns/pop-touch';

/**
 * CSS 원문. **파일에서 직접 읽는다.**
 *
 * `import './app.css?raw'`는 쓸 수 없다 — `css: false` 설정이 CSS 모듈을 빈 문자열로
 * 돌려주어 검사가 조용히 무력해진다(실측: 여섯 단언이 전부 빈 문자열에 걸렸다).
 *
 * 기준은 vitest 루트(= `apps/web`)다. `pnpm -r test`도 패키지 디렉터리에서 돈다.
 */
const cssSource = readFileSync(resolve(process.cwd(), 'src/app/app.css'), 'utf8');

/**
 * 터치 치수 감지기 — **CSS 값을 소스로 읽어 잰다.**
 *
 * 이 검사가 렌더가 아니라 파일 읽기인 이유: `vitest.config.ts`가 `css: false`이고 `app.css`는
 * `main.tsx`에서만 import된다. 즉 **어떤 렌더 테스트에도 이 값이 도달하지 않는다.** 실측으로
 * 네 등급을 전부 8px로 무너뜨려도 15,339건이 전부 통과했다.
 *
 * 치수는 제품이 임시로 채우는 값이라(디자인 시스템 `Button`이 `xl`=60px까지) 걷어낼 때까지
 * 아무도 보지 않는 자리에 남는다. 그 사이 이 블록이 잘못 고쳐지거나 잘못 걷혀도 게이트가
 * 초록이면, 그 위에 POP 화면들이 그대로 얹힌다.
 */

/**
 * 등급별 최소 높이(px). 값의 근거는 터치 단말 규격 네 등급이다 —
 * 일반 56↑ · 주요 64↑ · 핵심 72 · 위험 72↑.
 *
 * ⚠ 이것은 **하한**이지 치수의 정본이 아니다. 정본은 `app.css`이며 여기는 「그 아래로
 * 내려가면 안 된다」만 말한다. 두 곳에 같은 값을 적으면 한쪽만 고쳐진다.
 */
const MINIMUM_HEIGHT_PX: Record<PopTouchGrade, number> = {
  normal: 56,
  primary: 64,
  critical: 72,
  destructive: 72,
};

const GRADES = Object.keys(MINIMUM_HEIGHT_PX) as PopTouchGrade[];

/** 등급 클래스가 내는 `--pop-touch-size`. 정의가 없으면 `null`이다. */
const declaredHeightPx = (grade: PopTouchGrade): number | null => {
  const block = new RegExp(
    `\\.pop-touch-${grade}\\s*\\{[^}]*--pop-touch-size:\\s*(\\d+)px`,
    'u',
  ).exec(cssSource);

  return block === null ? null : Number(block[1]);
};

describe('POP 터치 치수', () => {
  it.each(GRADES)('%s 등급이 최소 높이를 만족한다', (grade) => {
    expect(declaredHeightPx(grade)).toBeGreaterThanOrEqual(MINIMUM_HEIGHT_PX[grade]);
  });

  it('등급 클래스가 CSS에 전부 정의돼 있다 — 오타는 조용히 치수를 없앤다', () => {
    const missing = GRADES.filter((grade) => declaredHeightPx(grade) === null);

    expect(missing).toEqual([]);
  });

  it('`popTouchClass`가 내는 이름이 CSS에 정의된 클래스와 같다', () => {
    for (const grade of GRADES) {
      const [common, gradeClass] = popTouchClass(grade).split(' ');

      expect(cssSource).toContain(`.${common} {`);
      expect(cssSource).toContain(`.${gradeClass} {`);
    }
  });
});

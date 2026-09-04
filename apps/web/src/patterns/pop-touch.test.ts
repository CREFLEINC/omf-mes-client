import { describe, expect, it } from 'vitest';

import { popTouchClass, type PopTouchGrade } from './pop-touch';

const GRADES: PopTouchGrade[] = ['normal', 'primary', 'critical', 'destructive'];

describe('popTouchClass', () => {
  it('등급마다 공통 클래스와 등급 클래스를 함께 낸다', () => {
    expect(popTouchClass('primary')).toBe('pop-touch pop-touch-primary');
  });

  it('네 등급이 서로 다른 클래스를 낸다 — 등급이 뭉치면 치수 구분이 사라진다', () => {
    const classes = GRADES.map(popTouchClass);

    expect(new Set(classes).size).toBe(GRADES.length);
  });

  it('모든 등급이 공통 클래스를 갖는다 — 걷어낼 때 한 이름으로 셀 수 있어야 한다', () => {
    for (const grade of GRADES) {
      expect(popTouchClass(grade).split(' ')).toContain('pop-touch');
    }
  });
});

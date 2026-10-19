import { describe, expect, it } from 'vitest';

import { inDataScope } from './lookups';

/* 서버 장부 P-62 와 같은 규칙 — 공장이 있는 줄은 그 공장, 사업부만 있는 줄은 그 사업부 공장 모두, 줄이 없으면 전체. */
describe('inDataScope (omf-all-around#120)', () => {
  const pl11 = { plantId: 11, businessUnitId: 1 };
  const pl13 = { plantId: 13, businessUnitId: 3 };

  it('범위가 없으면 모든 공장', () => {
    expect([pl11, pl13].filter((plant) => inDataScope(plant, []))).toEqual([pl11, pl13]);
  });

  it('공장 지정 줄은 그 공장만', () => {
    expect(
      [pl11, pl13].filter((plant) => inDataScope(plant, [{ businessUnitId: 3, plantId: 13 }])),
    ).toEqual([pl13]);
  });

  it('사업부만 지정한 줄은 그 사업부의 공장 모두', () => {
    const sameUnit = { plantId: 14, businessUnitId: 3 };
    expect(
      [pl11, pl13, sameUnit].filter((plant) => inDataScope(plant, [{ businessUnitId: 3 }])),
    ).toEqual([pl13, sameUnit]);
  });

  it('사업부가 없는 공장은 사업부 줄로 열리지 않는다', () => {
    expect(inDataScope({ plantId: 20, businessUnitId: null }, [{ businessUnitId: 3 }])).toBe(false);
  });
});

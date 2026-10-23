import { describe, expect, it } from 'vitest';

import { coversOaPlant } from './oa-access';

/** omf-all-around#89 — 사업부(VIETNAM)가 부품 PL11·OA PL13 을 함께 가져 공장 코드로 OA 를 가린다(서버와 같은 규칙). */
const PLANTS = [
  { plantId: 1, plantCode: 'PL11', businessUnitId: 1 },
  { plantId: 2, plantCode: 'PL13', businessUnitId: 1 },
];
const OA = new Set(['PL13']);

describe('OA 공장 범위', () => {
  it('OA 공장 범위 계정은 OA 다', () => {
    expect(coversOaPlant([{ businessUnitId: 1, plantId: 2 }], PLANTS, OA)).toBe(true);
  });

  it('부품 공장 범위만 있으면 OA 가 아니다', () => {
    expect(coversOaPlant([{ businessUnitId: 1, plantId: 1 }], PLANTS, OA)).toBe(false);
  });

  it('공장 없이 사업부만 있는 범위는 그 사업부의 모든 공장이다', () => {
    expect(coversOaPlant([{ businessUnitId: 1 }], PLANTS, OA)).toBe(true);
  });

  it('OA 공장 코드가 없으면 아무도 OA 가 아니다', () => {
    expect(coversOaPlant([{ businessUnitId: 1 }], PLANTS, new Set())).toBe(false);
  });
});

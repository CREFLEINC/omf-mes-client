import { describe, expect, it } from 'vitest';

import {
  coversBothPlantKinds,
  coversOaPlant,
  plantsInScope,
  scopeBusinessUnitIds,
} from './oa-access';

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

  /* omf-all-around#336 — 범위 줄이 없으면 제한 없음(모든 공장). */
  it('범위 줄이 없으면 OA 다 — 모든 공장', () => {
    expect(coversOaPlant([], PLANTS, OA)).toBe(true);
  });

  it('범위 줄이 없으면 모든 공장이 범위 안이다', () => {
    expect(plantsInScope([], PLANTS)).toEqual(PLANTS);
    expect(plantsInScope([{ businessUnitId: 1, plantId: 1 }], PLANTS)).toEqual([PLANTS[0]]);
  });

  it('검사표 사업부 후보 — 범위가 있으면 그 사업부, 없으면 OA 공장들의 사업부', () => {
    expect(scopeBusinessUnitIds([{ businessUnitId: 7 }], PLANTS, OA)).toEqual([7]);
    expect(scopeBusinessUnitIds([], PLANTS, OA)).toEqual([1]);
    expect(scopeBusinessUnitIds([], PLANTS, new Set())).toEqual([]);
  });

  /* omf-all-around#336 — OA·부품 공장을 모두 가진 계정만 상단 바에서 동작을 고른다. */
  it('OA·부품 공장을 모두 가졌는가 — 범위 없음 · 사업부 통째는 둘 다, 한 공장만이면 아니다', () => {
    expect(coversBothPlantKinds([], PLANTS, OA)).toBe(true);
    expect(coversBothPlantKinds([{ businessUnitId: 1 }], PLANTS, OA)).toBe(true);
    expect(coversBothPlantKinds([{ businessUnitId: 1, plantId: 2 }], PLANTS, OA)).toBe(false);
    expect(coversBothPlantKinds([{ businessUnitId: 1, plantId: 1 }], PLANTS, OA)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { currentRackLayout, planRackLayout } from './rack-layout';
import type { Location } from './types';

const location = (
  locationId: number,
  locationCode: string,
  locationName: string,
  parentLocationId: number | null,
): Location =>
  ({
    locationId,
    warehouseId: 1,
    parentLocationId,
    locationCode,
    locationName,
    locationTypeCode: 'RACK',
    allowMixedItem: true,
    allowMixedLot: true,
    isActive: true,
  }) as Location;

const zone = location(1, 'Z01', 'A구역', null);
const rack = location(2, 'Z01-R001', '1번 랙', 1);

describe('planRackLayout', () => {
  it('빈 랙이면 층을 먼저, 그 층의 셀을 뒤에 둔다', () => {
    const plan = planRackLayout(rack, [zone, rack], 2, 2);

    expect(plan.map((entry) => [entry.kind, entry.locationCode, entry.parentCode])).toEqual([
      ['LEVEL', 'Z01-R001-L01', null],
      ['CELL', 'Z01-R001-L01-C01', 'Z01-R001-L01'],
      ['CELL', 'Z01-R001-L01-C02', 'Z01-R001-L01'],
      ['LEVEL', 'Z01-R001-L02', null],
      ['CELL', 'Z01-R001-L02-C01', 'Z01-R001-L02'],
      ['CELL', 'Z01-R001-L02-C02', 'Z01-R001-L02'],
    ]);
    expect(plan[0]?.parentLocationId).toBe(2);
    // 이름은 짧게 — 별칭으로도 함께 실린다.
    expect(plan.map((entry) => entry.locationName)).toEqual([
      '1층',
      '1번',
      '2번',
      '2층',
      '1번',
      '2번',
    ]);
  });

  it('있는 층에는 모자란 셀만 그 층 번호로 단다', () => {
    const level = location(3, 'Z01-R001-L01', '1층', 2);
    const cell = location(4, 'Z01-R001-L01-C01', '1번', 3);
    const plan = planRackLayout(rack, [zone, rack, level, cell], 1, 3);

    expect(plan.map((entry) => [entry.locationCode, entry.parentLocationId])).toEqual([
      ['Z01-R001-L01-C02', 3],
      ['Z01-R001-L01-C03', 3],
    ]);
  });

  it('창고 안에서 이미 쓰는 코드는 건너뛴다', () => {
    const taken = location(9, 'Z01-R001-L01', '다른 데 쓰는 코드', 1);
    const plan = planRackLayout(rack, [zone, rack, taken], 1, 0);

    expect(plan.map((entry) => entry.locationCode)).toEqual(['Z01-R001-L02']);
  });

  it('지금 모양과 같으면 만들 것이 없다', () => {
    const items = [zone, rack, location(3, 'Z01-R001-L01', '1층', 2), location(4, 'C', 'c', 3)];

    expect(currentRackLayout(rack, items)).toEqual({ levelCount: 1, cellCount: 1 });
    expect(planRackLayout(rack, items, 1, 1)).toEqual([]);
  });
});

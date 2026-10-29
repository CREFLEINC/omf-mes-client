import { describe, expect, it } from 'vitest';

import { planRackLayout, planRackRemovals, rackLayoutGrid } from './rack-layout';
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

  it('새 층은 있는 층 가운데 가장 큰 번호 다음 — 빈 번호를 채우지 않는다', () => {
    const level = location(3, 'Z01-R001-L02', '2층', 2);
    const plan = planRackLayout(rack, [zone, rack, level], 2, 0);

    expect(plan.map((entry) => entry.locationCode)).toEqual(['Z01-R001-L03']);
  });

  it('지금 모양과 같으면 만들 것이 없다', () => {
    const items = [zone, rack, location(3, 'Z01-R001-L01', '1층', 2), location(4, 'C', 'c', 3)];

    expect(planRackLayout(rack, items, 1, 1)).toEqual([]);
  });
});

describe('rackLayoutGrid', () => {
  it('행은 층(위층이 위), 열은 셀 — 있는 칸과 새로 만들 칸을 가른다', () => {
    const level = location(3, 'Z01-R001-L01', '1층', 2);
    const cell = location(4, 'Z01-R001-L01-C01', '1번', 3);
    const items = [zone, rack, level, cell];
    const grid = rackLayoutGrid(rack, items, planRackLayout(rack, items, 2, 2));

    expect(
      grid.map((row) => [row.levelNo, row.isNew, row.cells.map((c) => [c.locationCode, c.isNew])]),
    ).toEqual([
      [
        2,
        true,
        [
          ['Z01-R001-L02-C01', true],
          ['Z01-R001-L02-C02', true],
        ],
      ],
      [
        1,
        false,
        [
          ['Z01-R001-L01-C01', false],
          ['Z01-R001-L01-C02', true],
        ],
      ],
    ]);
  });
});

describe('planRackRemovals', () => {
  it('줄이면 위층부터 넘치는 층, 남는 층에서는 뒤 번호부터 넘치는 셀을 지운다', () => {
    const l1 = location(3, 'Z01-R001-L01', '1층', 2);
    const l2 = location(4, 'Z01-R001-L02', '2층', 2);
    const l3 = location(5, 'Z01-R001-L03', '3층', 2);
    const cells = [1, 2, 3].map((n) =>
      location(10 + n, `Z01-R001-L01-C0${String(n)}`, `${String(n)}번`, 3),
    );
    const items = [zone, rack, l1, l2, l3, ...cells];

    expect(planRackRemovals(rack, items, 1, 1).map((item) => item.locationCode)).toEqual([
      'Z01-R001-L03',
      'Z01-R001-L02',
      'Z01-R001-L01-C03',
      'Z01-R001-L01-C02',
    ]);
    // 지울 칸은 표에서 가른다.
    const grid = rackLayoutGrid(rack, items, [], planRackRemovals(rack, items, 1, 1));
    expect(grid.map((row) => row.isRemoved)).toEqual([true, true, false]);
    expect(grid[2]?.cells.map((cell) => cell.isRemoved)).toEqual([false, true, true]);
  });
});

import { describe, expect, it } from 'vitest';

import { toRecommendationChips } from './resource-recommendation';

describe('toRecommendationChips', () => {
  it('설비·금형 후보를 셋까지만 칩으로 바꾸고 비가동을 사용 중보다 먼저 알린다', () => {
    const equipment = (id: number, extra: { inService?: boolean; busy?: boolean } = {}) => ({
      equipmentId: id,
      equipmentCode: `EQ${String(id)}`,
      equipmentName: '사출기',
      productionLineId: 7,
      source: 'MAPPED' as const,
      inService: extra.inService ?? true,
      busy: extra.busy ?? false,
    });
    const chips = toRecommendationChips({
      equipments: [
        equipment(1, { inService: false, busy: true }),
        equipment(2, { busy: true }),
        equipment(3),
        equipment(4),
      ],
      molds: [{ moldId: 9, moldCode: 'M9', moldName: '금형', source: 'DEFAULT', inService: true }],
    });

    expect(
      chips.plannedEquipmentId.map((chip) => [chip.value, chip.warning, chip.productionLineId]),
    ).toEqual([
      ['1', 'outOfService', '7'],
      ['2', 'busy', '7'],
      ['3', null, '7'],
    ]);
    expect(chips.plannedMoldId).toEqual([
      {
        value: '9',
        code: 'M9',
        label: 'M9 · 금형',
        source: 'DEFAULT',
        productionLineId: null,
        warning: null,
      },
    ]);
  });

  it('교대·작업자는 서버 순서대로 이름을 칩 글자로, 이력은 「최근」·자격은 「자격」으로 읽는다', () => {
    const chips = toRecommendationChips({
      equipments: [],
      molds: [],
      shifts: [
        {
          shiftId: 1,
          shiftCode: 'D',
          shiftName: '주간',
          startTime: '08:00:00',
          endTime: '20:00:00',
          busy: false,
        },
        {
          shiftId: 2,
          shiftCode: 'N',
          shiftName: '야간',
          startTime: '20:00:00',
          endTime: '08:00:00',
          busy: true,
        },
      ],
      workers: (['EQUIPMENT', 'LINE', 'PROCESS', 'QUALIFIED'] as const).map((source, index) => ({
        workerId: 10 + index,
        workerNo: `W-${String(index)}`,
        workerName: `작업자${String(index)}`,
        source,
        busy: index === 3,
      })),
    });

    expect(chips.plannedShiftId).toEqual([
      {
        value: '1',
        code: '주간',
        label: 'D · 주간 (08:00 ~ 20:00)',
        source: null,
        productionLineId: null,
        warning: null,
      },
      expect.objectContaining({ value: '2', code: '야간', warning: 'busy' }),
    ]);
    expect(
      chips.responsibleWorkerId.map((chip) => [chip.code, chip.label, chip.source, chip.warning]),
    ).toEqual([
      ['작업자0', 'W-0 · 작업자0', 'RECENT', null],
      ['작업자1', 'W-1 · 작업자1', 'RECENT', null],
      ['작업자2', 'W-2 · 작업자2', 'RECENT', null],
      ['작업자3', 'W-3 · 작업자3', 'QUALIFIED', 'busy'],
    ]);
  });

  it('추천을 아직 못 받았거나 교대·작업자를 싣지 않은 서버면 빈 목록이다', () => {
    const empty = {
      plannedEquipmentId: [],
      plannedMoldId: [],
      plannedShiftId: [],
      responsibleWorkerId: [],
    };
    expect(toRecommendationChips(undefined)).toEqual(empty);
    expect(toRecommendationChips({ equipments: [], molds: [] })).toEqual(empty);
  });
});

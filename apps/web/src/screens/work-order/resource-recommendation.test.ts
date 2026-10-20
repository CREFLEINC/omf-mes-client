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

  it('추천을 아직 못 받았으면 빈 목록이다', () => {
    expect(toRecommendationChips(undefined)).toEqual({ plannedEquipmentId: [], plannedMoldId: [] });
  });
});

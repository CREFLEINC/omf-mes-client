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
        label: '금형 (M9)',
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
        label: '주간 (D) 08:00 ~ 20:00',
        source: null,
        productionLineId: null,
        warning: null,
      },
      expect.objectContaining({ value: '2', code: '야간', warning: 'busy' }),
    ]);
    expect(
      chips.responsibleWorkerId.map((chip) => [chip.code, chip.label, chip.source, chip.warning]),
    ).toEqual([
      ['작업자0', '작업자0 (W-0)', 'RECENT', null],
      ['작업자1', '작업자1 (W-1)', 'RECENT', null],
      ['작업자2', '작업자2 (W-2)', 'RECENT', null],
      ['작업자3', '작업자3 (W-3)', 'QUALIFIED', 'workerBusy'],
    ]);
  });

  it('편집 중인 설비·교대·계획 시작이 저장값과 다르면 교대·작업자의 사용 중 표식을 뗀다', () => {
    const data = {
      equipments: [
        {
          equipmentId: 1,
          equipmentCode: 'EQ1',
          equipmentName: '사출기',
          productionLineId: 7,
          source: 'MAPPED' as const,
          inService: true,
          busy: true,
        },
      ],
      molds: [],
      shifts: [
        {
          shiftId: 2,
          shiftCode: 'N',
          shiftName: '야간',
          startTime: '20:00:00',
          endTime: '08:00:00',
          busy: true,
        },
      ],
      workers: [
        { workerId: 3, workerNo: 'W-3', workerName: '홍길동', source: 'LINE' as const, busy: true },
      ],
    };
    const warnings = (slotChanged: boolean) => {
      const chips = toRecommendationChips(data, { slotChanged });
      return [
        chips.plannedEquipmentId[0]?.warning,
        chips.plannedShiftId[0]?.warning,
        chips.responsibleWorkerId[0]?.warning,
      ];
    };

    expect(warnings(false)).toEqual(['busy', 'busy', 'workerBusy']);
    expect(warnings(true)).toEqual(['busy', null, null]);
  });

  it('이름이 같은 작업자 칩에만 사번을 붙인다', () => {
    const worker = (workerId: number, workerName: string) => ({
      workerId,
      workerNo: `W-${String(workerId)}`,
      workerName,
      source: 'QUALIFIED' as const,
      busy: false,
    });
    const chips = toRecommendationChips({
      equipments: [],
      molds: [],
      workers: [worker(1, '김민수'), worker(2, '이영희'), worker(3, '김민수')],
    });

    expect(chips.responsibleWorkerId.map((chip) => chip.code)).toEqual([
      '김민수 (W-1)',
      '이영희',
      '김민수 (W-3)',
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

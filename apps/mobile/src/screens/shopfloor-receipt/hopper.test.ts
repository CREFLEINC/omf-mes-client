import { describe, expect, it } from 'vitest';

import type { Equipment } from '../../patterns/equipments';
import {
  HOPPER_MEASUREMENT,
  adjustmentQtyOf,
  canRecordHopper,
  hasHopper,
  hopperLocationOf,
  isMeasured,
  measureProblemOf,
  toHopperDraft,
  type HopperStock,
  type InventoryAdjustmentCreate,
} from './hopper';

const equipment = (overrides: Partial<Equipment> = {}): Equipment =>
  ({
    equipmentId: 7,
    plantId: 1,
    equipmentCode: 'EQ-01',
    equipmentName: '사출 1호',
    equipmentTypeCode: 'INJECTION',
    locationId: 55,
    statusCode: 'IN_SERVICE',
    calibrationRequired: false,
    isActive: true,
    ...overrides,
  }) as Equipment;

const stock = (overrides: Partial<HopperStock> = {}): HopperStock => ({
  itemId: 31,
  lotId: 4,
  onHandQty: 120,
  uomId: 9,
  ...overrides,
});

describe('호퍼 위치', () => {
  /* 설비가 위치를 직접 가리킨다. 고르면 그 자리가 정해진다. */
  it('고른 설비의 위치를 호퍼로 삼는다', () => {
    expect(hopperLocationOf(equipment())).toBe(55);
  });

  /* 매핑이 없으면 잴 자리가 없다. 지어낸 자리에 적으면 어느 호퍼인지가 사라진다. */
  it('매핑이 없는 설비는 호퍼가 없다', () => {
    expect(hasHopper(equipment({ locationId: null }))).toBe(false);
    expect(hopperLocationOf(equipment({ locationId: null }))).toBeNull();
  });

  it('설비를 고르기 전에는 호퍼가 없다', () => {
    expect(hopperLocationOf(null)).toBeNull();
  });
});

describe('실측값', () => {
  it('숫자가 아니면 막는다', () => {
    expect(measureProblemOf('열둘')).toBe('notNumber');
  });

  it('0보다 작을 수 없다', () => {
    expect(measureProblemOf('-1')).toBe('negative');
  });

  it('비어 있는 것은 아직 안 적은 것이다', () => {
    expect(measureProblemOf('')).toBeNull();
  });

  /*
   * 사람이 넣는 것은 잰 값이고 뺀 값이 아니다. 차이를 사람에게 계산시키면 부호를 뒤집어 적는
   * 순간 재고가 반대로 움직인다.
   */
  it('장부에서 잰 값을 빼 증감량을 만든다', () => {
    expect(adjustmentQtyOf(stock(), '100')).toBe(-20);
    expect(adjustmentQtyOf(stock(), '150')).toBe(30);
  });

  /* 0 을 보내면 움직이지 않은 조정이 이력에 쌓인다. */
  it('장부와 같으면 적을 것이 없다', () => {
    expect(isMeasured(stock(), '120')).toBe(false);
    expect(isMeasured(stock(), '100')).toBe(true);
  });
});

describe('기록 조건', () => {
  it('설비를 고르고 한 줄이라도 재야 기록할 수 있다', () => {
    expect(canRecordHopper(55, [stock()], { 31: '100' }, true)).toBe(true);
  });

  it('호퍼가 없으면 기록할 수 없다', () => {
    expect(canRecordHopper(null, [stock()], { 31: '100' }, true)).toBe(false);
  });

  it('아무것도 재지 않았으면 기록할 수 없다', () => {
    expect(canRecordHopper(55, [stock()], {}, true)).toBe(false);
  });

  /* 누가 잰 것인지 없이 기록을 남길 수 없다. */
  it('사번이 없으면 기록할 수 없다', () => {
    expect(canRecordHopper(55, [stock()], { 31: '100' }, false)).toBe(false);
  });
});

describe('조정 본문', () => {
  const NOW = new Date(2026, 8, 10, 9, 12);

  it('잰 줄만 싣고 호퍼 실측 사유로 보낸다', () => {
    const entry = toHopperDraft(
      55,
      [stock(), stock({ itemId: 32, onHandQty: 50 })],
      { 31: '100' },
      NOW,
      '100027',
    );
    const body = entry.body as InventoryAdjustmentCreate;

    expect(entry.path).toBe('/inventory/adjustments');
    expect(entry.workerNo).toBe('100027');
    expect(body.reasonCode).toBe(HOPPER_MEASUREMENT);
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      locationId: 55,
      itemId: 31,
      lotId: 4,
      adjustmentQty: -20,
      uomId: 9,
      reasonCode: HOPPER_MEASUREMENT,
    });
  });
});

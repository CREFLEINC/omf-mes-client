import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { dateTimeText, hasNoAssignment, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

const t = messages.emergencyWorkOrderField.detail;

const base: WorkOrder = {
  workOrderId: 1,
  workOrderNo: 'SYN-WO-E-0001',
  productionPlanId: 2,
  routingOperationId: 3,
  itemId: 4,
  orderQty: 10,
  uomId: 11,
  workOrderTypeCode: 'EMERGENCY',
  statusCode: 'SYN',
  priorityNo: 1,
};

describe('발행 시각 표시', () => {
  it('계약이 준 오프셋을 다시 계산하지 않고 글자 그대로 읽는다', () => {
    /* 브라우저 시간대가 달라도 같은 값이 보여야 한다 — Date 로 바꾸면 여기서 흔들린다. */
    expect(dateTimeText('2026-08-31T14:20:00+09:00')).toBe('2026-08-31 14:20');
  });

  it('안 온 값을 빈칸으로 두지 않는다', () => {
    expect(dateTimeText(undefined)).toBe(t.unknown);
  });

  it('읽을 수 없는 모양이면 받은 대로 보인다', () => {
    expect(dateTimeText('언제인지 모를 값')).toBe('언제인지 모를 값');
  });
});

describe('수량·품목 표시', () => {
  it('안 온 수량을 0으로 떨어뜨리지 않는다', () => {
    expect(qtyText(undefined)).toBe(t.unknown);
  });

  it('품목 코드가 비면 빈칸이 아니라 모른다고 적는다', () => {
    expect(itemText({ ...base, itemCode: '   ' })).toBe(t.unknown);
  });
});

describe('배정 없음 판정', () => {
  it('설비·금형·교대가 전부 비었을 때만 배정 없음이다', () => {
    expect(hasNoAssignment(base)).toBe(true);
  });

  it.each([
    ['설비', { plannedEquipmentId: 1 }],
    ['금형', { plannedMoldId: 1 }],
    ['교대', { plannedShiftId: 1 }],
  ])('%s 하나만 배정돼 있어도 배정 없음이 아니다', (_label, assigned) => {
    expect(hasNoAssignment({ ...base, ...assigned })).toBe(false);
  });
});

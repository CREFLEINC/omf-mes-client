import { describe, expect, it } from 'vitest';
import { appendProductionPlanRow } from '../../production-plan/editor-state';
import { planQuantities } from './plan-quantities';
const row = (qty: string) =>
  appendProductionPlanRow([], 'new-1', {
    plannedQty: qty,
    planDate: '2099-01-01',
    plannedLineId: '1',
    bomId: '1',
    routingId: '1',
  });
describe('단건·복수 공통 계획 수량', () => {
  it('확정·미확정 계획을 한 번씩 차감하고 초과를 별도로 반환한다', () => {
    expect(planQuantities(100, 20, row('30'))).toEqual({
      confirmed: 20,
      draft: 30,
      remaining: 50,
      excess: 0,
    });
    expect(planQuantities(100, 20, row('90'))).toEqual({
      confirmed: 20,
      draft: 90,
      remaining: 0,
      excess: 10,
    });
  });
  it('서버 합계를 우선하고 누락된 경우에만 화면 합계를 사용한다', () => {
    const rows = row('100').map((row) => ({ ...row, confirmed: true }));
    expect(planQuantities(100, 0, rows).remaining).toBe(100);
    expect(planQuantities(100, undefined, rows).remaining).toBe(0);
    expect(planQuantities(100, 100, rows).confirmed).toBe(100);
  });
  it('소수 수량의 부동소수점 오차를 정리한다', () => {
    expect(planQuantities(0.3, 0.1, row('.2')).remaining).toBe(0);
    expect(planQuantities(0.3, 0.1, row('.2')).excess).toBe(0);
  });
});

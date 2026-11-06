import { describe, expect, it } from 'vitest';
import { appendProductionPlanRow } from '../../production-plan/editor-state';
import { manualPlanDefaults, recommendedPlanDate } from './manual-plan-defaults';
const revisions = { bomId: '1', routingId: '2' };
const lines = [{ id: 3, code: 'L', name: 'Line' }];
describe('직접 편성 추천값', () => {
  it('ERP 시작일과 미편성 수량을 적용하고 입력한 계획은 변경하지 않는다', () => {
    const rows = appendProductionPlanRow([], 'draft', {
      ...revisions,
      planDate: '2026-11-08',
      plannedQty: '15',
      plannedLineId: '3',
    });
    const before = JSON.stringify(rows);
    expect(
      manualPlanDefaults(
        { orderQty: 100, confirmedPlanQty: 20, plannedStartDate: '2026-11-10' },
        rows,
        lines,
        revisions,
        '2026-11-06',
      ),
    ).toEqual({ ...revisions, planDate: '2026-11-10', plannedQty: '65', plannedLineId: '3' });
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('과거·누락 시작일은 오늘을 추천하고 복수 생산 라인을 임의 선택하지 않는다', () => {
    expect(recommendedPlanDate('2026-10-01', '2026-11-06')).toBe('2026-11-06');
    expect(recommendedPlanDate(undefined, '2026-11-06')).toBe('2026-11-06');
    expect(
      manualPlanDefaults(
        { orderQty: 100 },
        [],
        [...lines, { id: 4, code: 'B', name: 'Other' }],
        revisions,
        '2026-11-06',
      ).plannedLineId,
    ).toBe('');
  });
  it('유일한 활성 생산 라인을 추천하며 전량 편성 뒤 수량은 0이다', () => {
    expect(
      manualPlanDefaults(
        { orderQty: 100, confirmedPlanQty: 100 },
        [],
        lines,
        revisions,
        '2026-11-06',
      ),
    ).toMatchObject({ plannedQty: '0', plannedLineId: '3' });
  });
});

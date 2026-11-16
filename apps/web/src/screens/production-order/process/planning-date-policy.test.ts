import { describe, expect, it } from 'vitest';
import {
  isPastPlanningDate,
  pastUnreleasedPlans,
  validatePlanningDraft,
} from './planning-date-policy';
const today = '2026-11-16';
const row = (confirmed = false, date = '2026-11-15') => ({
  productionPlanId: confirmed ? 1 : null,
  confirmed,
  draft: { planDate: date },
});
describe('생산계획 날짜 제한', () => {
  it('오늘은 허용하고 공장 날짜 기준 어제만 지난 날짜로 판정한다', () => {
    expect(isPastPlanningDate('2026-11-15', today)).toBe(true);
    expect(isPastPlanningDate(today, today)).toBe(false);
    expect(isPastPlanningDate('2026-11-17', today)).toBe(false);
  });
  it('저장된 작성중 계획도 날짜가 지나면 차단한다', () => {
    expect(pastUnreleasedPlans([row()], [], today)).toHaveLength(1);
    expect(pastUnreleasedPlans([row(false, today)], [], today)).toEqual([]);
  });
  it('확정된 미배포 계획은 차단하되 취소·배포 완료 이력은 제외한다', () => {
    for (const statusCode of ['PLANNED', 'CONFIRMED'])
      expect(
        pastUnreleasedPlans([row(true)], [{ productionPlanId: 1, statusCode }], today),
      ).toHaveLength(1);
    for (const statusCode of [
      'CANCELLED',
      'RELEASED',
      'IN_PROGRESS',
      'SUSPENDED',
      'COMPLETED',
      'CLOSED',
    ])
      expect(
        pastUnreleasedPlans([row(true)], [{ productionPlanId: 1, statusCode }], today),
      ).toEqual([]);
  });
  it('같은 계획의 일부 작업지시가 미배포이면 지난 날짜 차단을 유지한다', () => {
    expect(
      pastUnreleasedPlans(
        [row(true)],
        [
          { productionPlanId: 1, statusCode: 'RELEASED' },
          { productionPlanId: 1, statusCode: 'CONFIRMED' },
        ],
        today,
      ),
    ).toHaveLength(1);
  });
  it('과거 날짜 입력을 달력 외 경로로 넣어도 저장 검증에서 차단한다', () => {
    expect(
      validatePlanningDraft({
        planDate: '2000-01-01',
        plannedQty: '1',
        bomId: '1',
        routingId: '1',
        plannedLineId: '1',
        remarks: '',
      }).planDate,
    ).toEqual(expect.objectContaining({ message: expect.stringContaining('계획일이 지났습니다') }));
  });
});

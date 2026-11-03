import { shiftPlanDate } from './plan-view-model';

export interface DistributionOptions {
  start: string;
  end: string;
  lineId: string;
  dailyQty: number;
}
export interface ScheduledDraft {
  planDate: string;
  plannedLineId: string;
  plannedQty: string;
}
export interface DistributionDemand {
  id: string;
  remaining: number;
}

/** 일별 공통 상한에서 기존 편성을 빼고 선택 순서대로 미계획 수량만 배분한다. */
export const distributePlans = (
  demands: readonly DistributionDemand[],
  options: DistributionOptions,
  occupied: readonly ScheduledDraft[] = [],
): { drafts: (ScheduledDraft & { owner: string })[]; pending: number } => {
  if (
    !options.lineId ||
    !Number.isSafeInteger(options.dailyQty) ||
    options.dailyQty <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(options.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(options.end) ||
    shiftPlanDate(options.start, 0) !== options.start ||
    shiftPlanDate(options.end, 0) !== options.end ||
    options.start > options.end
  )
    throw new Error('기간, 라인, 일일 편성 수량을 확인하세요.');
  if (
    demands.some((demand) => !Number.isSafeInteger(demand.remaining) || demand.remaining < 0) ||
    occupied.some(
      (row) => !Number.isSafeInteger(Number(row.plannedQty)) || Number(row.plannedQty) < 0,
    )
  )
    throw new Error('기존 계획과 분배 대상의 수량을 확인하세요.');
  const dates: string[] = [];
  for (let date = options.start; date <= options.end; date = shiftPlanDate(date, 1)) {
    if (dates.length >= 366) throw new Error('분배 기간은 최대 366일입니다.');
    dates.push(date);
  }
  const available = new Map(
    dates.map((date) => [
      date,
      Math.max(
        0,
        options.dailyQty -
          occupied
            .filter((row) => row.planDate === date && row.plannedLineId === options.lineId)
            .reduce((sum, row) => sum + Number(row.plannedQty), 0),
      ),
    ]),
  );
  const drafts: (ScheduledDraft & { owner: string })[] = [];
  let pending = 0;
  for (const demand of demands) {
    let left = Math.max(0, demand.remaining);
    if (!Number.isSafeInteger(left)) throw new Error('미계획 수량은 정수여야 합니다.');
    for (const date of dates) {
      const qty = Math.min(left, available.get(date) ?? 0);
      if (qty > 0) {
        drafts.push({
          owner: demand.id,
          planDate: date,
          plannedLineId: options.lineId,
          plannedQty: String(qty),
        });
        available.set(date, (available.get(date) ?? 0) - qty);
        left -= qty;
      }
      if (left === 0) break;
    }
    pending += left;
  }
  return { drafts, pending };
};

import type { PlanningComponents } from '@omf-mes/api-client';
import { jsonResponse } from './api-harness';
export const planningDayFixture = (
  date: string,
  statusCode: PlanningComponents['schemas']['PlanningCalendarDay']['statusCode'] = 'UNDETERMINED',
): PlanningComponents['schemas']['PlanningCalendarDay'] => ({
  date,
  statusCode,
  sourceCode: statusCode === 'UNDETERMINED' ? 'NOT_CONFIGURED' : 'PLANT_CALENDAR',
  workCalendarId: statusCode === 'UNDETERMINED' ? null : 1,
  calendarCode: null,
  appliedProductionLineId: null,
  reasonCode: statusCode === 'HOLIDAY' ? 'PUBLIC_HOLIDAY' : null,
  remarks: null,
  startTime: null,
  endTime: null,
  weeklyWorkingDays: null,
});
export const planningDaysResponse = async (
  request: Request,
  status: (
    date: string,
  ) => PlanningComponents['schemas']['PlanningCalendarDay']['statusCode'] = () => 'UNDETERMINED',
) => {
  const body = (await request.json()) as {
    targets: { plantId: number; productionLineId?: number | null; from: string; to: string }[];
  };
  return jsonResponse({
    items: body.targets.map((target) => {
      const days = [];
      for (let date = target.from; date <= target.to;) {
        days.push(planningDayFixture(date, status(date)));
        const next = new Date(date + 'T12:00:00Z');
        next.setUTCDate(next.getUTCDate() + 1);
        date = next.toISOString().slice(0, 10);
      }
      return { ...target, productionLineId: target.productionLineId ?? null, days };
    }),
  });
};

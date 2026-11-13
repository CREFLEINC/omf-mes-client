import { useQuery } from '@tanstack/react-query';
import type { ApiClient, PlanningComponents } from '@omf-mes/api-client';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { shiftPlanDate } from './plan-view-model';

export type PlanningDay = PlanningComponents['schemas']['PlanningCalendarDay'];
export interface PlanningDayTarget {
  plantId: number;
  productionLineId?: number | null;
  from: string;
  to: string;
}
export const planningDayKey = (plantId: number, lineId: number | null | undefined, date: string) =>
  `${plantId}:${lineId ?? ''}:${date}`;
export const resolvePlanningDays = async (
  client: ApiClient['client'],
  targets: readonly PlanningDayTarget[],
) => {
  const ranges: PlanningDayTarget[] = [];
  for (const target of targets) {
    if (
      shiftPlanDate(target.from, 0) !== target.from ||
      shiftPlanDate(target.to, 0) !== target.to ||
      target.from > target.to
    )
      throw new Error('휴일 조회 기간을 확인하세요.');
    for (let from = target.from; from <= target.to; from = shiftPlanDate(from, 92))
      ranges.push({ ...target, from, to: [shiftPlanDate(from, 91), target.to].sort()[0]! });
  }
  const unique = [...new Map(ranges.map((t) => [JSON.stringify(t), t])).values()];
  const result = new Map<string, PlanningDay>();
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const data = await runRequest(() =>
      client.POST('/planning/working-days:resolve', { body: { targets: batch } }),
    );
    for (const target of batch) {
      const item = data.items.find(
        (r) =>
          r.plantId === target.plantId &&
          r.productionLineId === (target.productionLineId ?? null) &&
          r.from === target.from &&
          r.to === target.to,
      );
      if (!item) throw new Error('휴일 판정 결과를 모두 받지 못했습니다. 다시 조회하세요.');
      const byDate = new Map(item.days.map((day) => [day.date, day]));
      for (let date = target.from; date <= target.to; date = shiftPlanDate(date, 1)) {
        const day = byDate.get(date);
        if (!day) throw new Error('휴일 판정 결과에 누락된 날짜가 있습니다. 다시 조회하세요.');
        result.set(planningDayKey(target.plantId, target.productionLineId, date), day);
      }
    }
  }
  return result;
};
export const usePlanningDays = (targets: readonly PlanningDayTarget[]) => {
  const { client } = useApiClient();
  const unique = [
    ...new Map(
      targets
        .filter(
          (t) =>
            t.from &&
            t.to &&
            shiftPlanDate(t.from, 0) === t.from &&
            shiftPlanDate(t.to, 0) === t.to,
        )
        .map((t) => [JSON.stringify(t), t]),
    ).values(),
  ];
  return useQuery({
    queryKey: ['planning-working-days', unique],
    enabled: unique.length > 0,
    queryFn: () => resolvePlanningDays(client, unique),
    retry: false,
    staleTime: 0,
  });
};
export const planningDayMessage = (day?: PlanningDay): string | null => {
  if (!day) return null;
  if (day.statusCode === 'HOLIDAY') {
    const names: Record<string, string> = {
      PUBLIC_HOLIDAY: '공휴일',
      COMPANY_FOUNDING_DAY: '창립기념일',
      SUMMER_VACATION: '하계휴가',
      PLANNED_MAINTENANCE: '계획 정비',
      MAKEUP_WORKING_DAY: '대체 근무',
      OTHER: '기타',
    };
    const reason =
      day.remarks ||
      (day.reasonCode
        ? (names[day.reasonCode] ?? day.reasonCode)
        : day.sourceCode === 'WEEKLY_POLICY'
          ? '정기 휴무'
          : '');
    return `휴일입니다${reason ? ` (${reason})` : ''}`;
  }
  if (day.statusCode === 'UNDETERMINED') return '근무일 판정 불가 (미설정)';
  if (day.statusCode === 'PARTIAL')
    return `부분 가동${day.startTime && day.endTime ? ` (${day.startTime.slice(0, 5)} ~ ${day.endTime.slice(0, 5)})` : ''}`;
  return null;
};
export const PlanningDayNotice = ({ day }: { day?: PlanningDay }) => {
  const message = planningDayMessage(day);
  return message ? (
    <p
      className={`erp-wo-planning-day-notice ${day?.statusCode === 'HOLIDAY' ? 'is-holiday' : ''}`}
      role="status"
    >
      {message}
    </p>
  ) : null;
};

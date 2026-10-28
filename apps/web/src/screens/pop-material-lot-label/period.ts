import { receiptWhen } from './pending';
import { shiftDate } from './queries';
import type { TargetRow } from './types';

/**
 * 발행 대기의 **입하 기간**(사용자 지시 2026-10-27) — 오늘 · 이번 주 · 이번 달 · 전체, 기본은 이번 주.
 *
 * ⭐ **기간보다 먼저 입하됐는데 아직 발행하지 않은 줄을 숨긴 채 두지 않는다.** 화면이 그 줄을 따로
 *    세어 띠로 알리고, 띠의 「보기」로 그 줄만 모아 본다 — 기간을 좁혔다고 지난 자재를 그냥 지나치지 않게.
 * ⛔ 지난 줄을 기간 목록에 섞지 않는다 — 대기 줄은 미래 날짜가 없어 섞으면 늘 대기 전부가 보이고,
 *    기간을 고르는 뜻이 없어진다(사용자 결정 2026-10-27 「경고 띠 + 보기」).
 *
 * 날짜는 **공장 달력**이다 — 입하 시각을 공장 시각으로 바꾼 날짜를 기간 첫날과 견준다.
 */
export type Period = 'today' | 'week' | 'month' | 'all';

export const PERIODS: readonly Period[] = ['today', 'week', 'month', 'all'];

export const DEFAULT_PERIOD: Period = 'week';

/** 기간의 첫날(`YYYY-MM-DD`). **주는 월요일부터**다. 「전체」는 첫날이 없다(`null`). */
export const periodStart = (period: Period, today: string): string | null => {
  switch (period) {
    case 'today':
      return today;
    case 'week': {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();

      return shiftDate(today, -((weekday + 6) % 7));
    }
    case 'month':
      return `${today.slice(0, 8)}01`;
    case 'all':
      return null;
  }
};

export interface PeriodSplit {
  /** 기간 안에 입하된 줄. */
  inPeriod: TargetRow[];
  /** 기간 첫날보다 먼저 입하됐는데 아직 남은 줄 — 띠로 알린다. */
  past: TargetRow[];
}

/**
 * 줄을 기간 안과 지난 것으로 가른다.
 *
 * ⚠ 입하 시각을 읽지 못한 줄은 기간 안에 둔다 — 날짜를 모른다고 숨기면 그 줄은 어디에도 서지 않는다.
 */
export const splitByPeriod = (rows: readonly TargetRow[], start: string | null): PeriodSplit => {
  const inPeriod: TargetRow[] = [];
  const past: TargetRow[] = [];

  for (const row of rows) {
    const date = receiptWhen(row.receiptDatetime)?.date;

    if (start !== null && date !== undefined && date < start) past.push(row);
    else inPeriod.push(row);
  }

  return { inPeriod, past };
};

/** 줄들의 입하일 범위(`MM-DD`) — 띠에 적는다. 읽을 수 있는 날짜가 없으면 `null`. */
export const dayRange = (rows: readonly TargetRow[]): { from: string; to: string } | null => {
  const dates = rows.flatMap((row) => receiptWhen(row.receiptDatetime)?.date ?? []).sort();
  const first = dates[0];
  const last = dates.at(-1);

  return first === undefined || last === undefined
    ? null
    : { from: first.slice(5), to: last.slice(5) };
};

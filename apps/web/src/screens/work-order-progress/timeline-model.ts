import { PLANT_UTC_OFFSET } from '../../patterns/plant-time';

import type { WorkOrderRow } from './row-view';

/**
 * 일정 보기의 날짜 축과 막대 자리.
 *
 * ⭐ **축은 공장 시각의 하루로 나눈다.** 표가 계획 시작 · 종료를 공장 시각으로 적으므로, 축의 날 경계가
 * 다른 시간대면 「11-27 08:00」 막대가 11-26 칸에 걸쳐 그려진다.
 *
 * **자리는 축 폭에 대한 비율(0~100)이다.** 화면 폭을 재지 않아도 되고, 폭이 바뀌어도 다시 계산하지 않는다.
 *
 * **순수 함수만 둔다.** 「지금」은 화면이 보이고 있는 기준 시각을 받는다(L-5).
 */
export interface TimelineAxis {
  /** 축에 놓인 날들(`YYYY-MM-DD`). */
  days: readonly string[];
  startMs: number;
  endMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 조회 기간의 날들로 축을 만든다. 날이 없거나 읽을 수 없으면 `null` — 일정을 그리지 않는다. */
export const toTimelineAxis = (days: readonly string[]): TimelineAxis | null => {
  const first = days[0];
  if (first === undefined) return null;

  const startMs = Date.parse(`${first}T00:00:00${PLANT_UTC_OFFSET}`);
  if (Number.isNaN(startMs)) return null;

  return { days, startMs, endMs: startMs + days.length * DAY_MS };
};

export interface TimelineSpan {
  /** 축 왼쪽 끝에서 떨어진 자리(0~100). */
  left: number;
  /** 폭(0~100). 계획 종료를 모르면 0 이다 — 시작 자리만 표시한다. */
  width: number;
}

export interface TimelineBar {
  /** 계획 구간 — 계획 시작부터 종료까지. 축 밖으로 나간 부분은 잘라 낸다. */
  plan: TimelineSpan;
  /** 지연 구간 — 계획 종료부터 기준 시각까지. 지연이 아니거나 축 안에 걸리지 않으면 `null`. */
  late: TimelineSpan | null;
}

const parseInstant = (value: string | undefined): number | null => {
  if (value === undefined || value === '') return null;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const spanOf = (axis: TimelineAxis, fromMs: number, toMs: number): TimelineSpan | null => {
  const from = Math.max(axis.startMs, fromMs);
  const to = Math.min(axis.endMs, toMs);
  if (to < from) return null;

  const total = axis.endMs - axis.startMs;

  return { left: ((from - axis.startMs) / total) * 100, width: ((to - from) / total) * 100 };
};

/**
 * 한 줄의 막대. 계획 시작을 모르거나 계획 구간이 축에 걸리지 않으면 `null` — 막대 없이 「계획 일정 없음」으로 적는다.
 *
 * ⛔ **지연 구간은 줄의 지연 판정을 따른다.** 여기서 계획 종료와 기준 시각을 다시 견줘 판정하지 않는다 —
 * 끝난 지시는 늦게 끝났어도 지연이 아니고, 그 판정은 서버가 낸다(`delay.ts`).
 */
export const toTimelineBar = (
  row: Pick<WorkOrderRow, 'plannedStartAt' | 'plannedEndAt' | 'delay'>,
  axis: TimelineAxis,
  basisMs: number,
): TimelineBar | null => {
  const startMs = parseInstant(row.plannedStartAt);
  if (startMs === null) return null;

  const endMs = parseInstant(row.plannedEndAt);
  const plan = spanOf(axis, startMs, endMs === null ? startMs : Math.max(startMs, endMs));
  if (plan === null) return null;

  const late =
    row.delay === 'delayed' && endMs !== null && basisMs > endMs
      ? spanOf(axis, endMs, basisMs)
      : null;

  return { plan, late: late !== null && late.width > 0 ? late : null };
};

/** 기준 시각의 자리(0~100). 축 밖이면 `null` — 선을 긋지 않는다. */
export const basisPosition = (axis: TimelineAxis, basisMs: number): number | null =>
  basisMs < axis.startMs || basisMs > axis.endMs
    ? null
    : ((basisMs - axis.startMs) / (axis.endMs - axis.startMs)) * 100;

/**
 * 기준 시각이 **보이는 날짜 축의 가운데**에 오게 하려면 지금보다 얼마나 더 굴려야 하는가.
 *
 * 왼쪽 다섯 칸(W/O 번호 ~ 달성률)은 붙어 남아 날짜 축을 가리므로, 「보이는 축」은 붙은 칸의 오른쪽 끝부터 상자의
 * 오른쪽 끝까지다. 셋 다 **화면에 놓인 자리**(같은 기준의 가로 좌표)로 받는다 — 폭을 더해 셈하면 칸 여백 · 붙는
 * 칸의 겹침 같은 배치 사정에 따라 어긋난다.
 *
 * 양수면 오른쪽으로 더, 음수면 왼쪽으로 되돌린다. 축 끝이라 다 굴릴 수 없으면 브라우저가 끝에서 멈춘다.
 *
 * @param basisX 기준선의 자리.
 * @param visibleLeft 보이는 축의 왼쪽 끝(붙은 칸의 오른쪽 끝).
 * @param visibleRight 보이는 축의 오른쪽 끝(상자의 오른쪽 끝).
 */
export const centeringShift = (basisX: number, visibleLeft: number, visibleRight: number): number =>
  basisX - (visibleLeft + visibleRight) / 2;

/** 날 머리에 적는 말 — `MM-DD`. 해는 조회 조건에 이미 있다. */
export const dayLabel = (day: string): string => day.slice(5);

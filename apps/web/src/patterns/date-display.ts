/**
 * 관리웹 날짜 · 시간 표기 규칙(⭐ 사용자 지시 2026-10-19) — **표시 전용**.
 *
 * - 날짜 + 시간 `yyyy-MM-dd HH:mm` · 날짜만 `yyyy-MM-dd` · 시간만 `HH:mm`. 24시간제, 두 자리, 초 없음.
 * - 범위는 `A ~ B`.
 *
 * 서버가 준 시각(공장 시각으로 보일 값)은 `plant-time.ts`의 `formatPlantDateTime`을 쓴다. 여기 있는
 * `formatLocalDateTime`은 「내가 언제 받았는가」처럼 **보는 사람의 시계가 정본인 값**만 쓴다 — 시간대 처리는
 * 각 자리가 쓰던 그대로다.
 */

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 보는 사람(실행 환경) 시간대의 `yyyy-MM-dd HH:mm`. */
export const formatLocalDateTime = (at: Date | number): string => {
  const date = typeof at === 'number' ? new Date(at) : at;

  return (
    `${String(date.getFullYear()).padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
};

/** 범위 `A ~ B`. */
export const formatDateRange = (from: string, to: string): string => `${from} ~ ${to}`;

/** 시각만 있는 값(`08:00` · `08:00:00`) → `HH:mm`. 꼴이 다르면 받은 그대로. */
export const formatTimeOfDay = (value: string): string =>
  /^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value)?.[1] ?? value;

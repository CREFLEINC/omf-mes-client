import { DAYS_IN_WEEK, toIsoDate } from './month-grid';

/**
 * 기간과 요일 조건을 **날짜 목록으로 펼친다.**
 *
 * ⭐ **규칙을 보내지 않고 날짜를 보낸다**(계약 · 스펙 §6). 「매주 일요일 휴무」를 규칙으로
 * 보내면 서버가 그 규칙을 다시 해석해야 하고, 화면이 미리 보인 「N일이 바뀝니다」와 실제
 * 결과가 갈릴 수 있다. **화면이 세어 보인 그 목록을 그대로 보낸다** — 보인 것과 보낸 것이
 * 같아야 확인이 뜻을 갖는다.
 *
 * ⭐ **날짜 셈을 UTC 로 한다** — 로컬 달력으로 하루씩 더하면 서머타임이 있는 지역에서
 * 같은 날이 두 번 나오거나 하루가 건너뛰어진다(`month-grid` 와 같은 규율).
 */

/** `YYYY-MM-DD` 를 UTC 자정의 밀리초로. 읽을 수 없으면 `null`. */
const toUtcTime = (isoDate: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);

  if (match === null) return null;

  const [, year, month, day] = match;
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const back = new Date(time);

  /*
   * ⛔ **달력에 없는 날을 받아들이지 않는다.** `Date.UTC(2026, 1, 30)` 은 3월 2일로 넘어가
   * 조용히 다른 날이 된다 — 되돌려 읽어 같은 날인지 확인한다.
   */
  return back.getUTCMonth() === Number(month) - 1 && back.getUTCDate() === Number(day)
    ? time
    : null;
};

const DAY_MS = 86_400_000;

/** 한 날의 요일(0=일). */
export const weekdayOf = (isoDate: string): number | null => {
  const time = toUtcTime(isoDate);

  return time === null ? null : new Date(time).getUTCDay();
};

/**
 * 기간 안에서 고른 요일의 날짜를 모두 편다.
 *
 * ⭐ **요일을 하나도 고르지 않으면 「기간 전체」다** — 「요일 일괄」과 「기간 일괄」이 한 경로를
 * 쓰는 것처럼 한 함수를 쓴다. 둘을 가르면 같은 셈이 두 벌 생긴다.
 *
 * ⛔ **읽을 수 없는 날짜나 뒤집힌 기간은 빈 목록이다** — 지어내지 않는다. 화면은 그 0을
 * 그대로 보이고 「바꿀 날이 없다」로 잠근다.
 */
export const expandDates = (from: string, to: string, weekdays: readonly number[]): string[] => {
  const start = toUtcTime(from);
  const end = toUtcTime(to);

  /*
   * ⛔ **읽을 수 없는 날짜는 빈 목록이다** — 지어내지 않는다.
   * 뒤집힌 기간은 따로 막지 않는다: 아래 반복이 한 번도 돌지 않아 저절로 빈 목록이 된다.
   * 같은 판정을 두 번 적으면 한쪽만 고쳐질 수 있다.
   */
  if (start === null || end === null) return [];

  const wanted = weekdays.length === 0 ? null : new Set(weekdays);
  const dates: string[] = [];

  for (let time = start; time <= end; time += DAY_MS) {
    const at = new Date(time);

    if (wanted !== null && !wanted.has(at.getUTCDay())) continue;

    dates.push(toIsoDate(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate()));
  }

  return dates;
};

/** 요일 번호 일곱. 화면이 체크칸을 만들 때 쓴다. */
export const WEEKDAY_NUMBERS: readonly number[] = Array.from(
  { length: DAYS_IN_WEEK },
  (_unused, index) => index,
);

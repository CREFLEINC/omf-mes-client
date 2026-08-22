/**
 * 한 달을 주 단위로 펼친다.
 *
 * ⭐ **날짜 셈을 UTC 로 한다.** 로컬 달력으로 셈하면 서머타임이 있는 지역에서 하루가 23시간·
 * 25시간이 되어 「다음 날」이 어긋난다. 여기서 다루는 것은 **시각이 아니라 달력**이라
 * 시간대가 개입할 이유가 없다 — `Date.UTC` 로 만들고 `getUTC*` 로 읽으면 어느 지역에서 돌려도
 * 같은 답이 나온다.
 *
 * ⛔ **`toISOString()` 을 쓰지 않는다.** 그것은 UTC 시각을 찍는 것이라, 로컬 시각으로 만든
 * `Date` 에 쓰면 하루가 밀린다(W-05-11 에서 같은 함정을 다뤘다). 여기서는 자릿수를 직접 맞춘다.
 */

/** 한 주의 칸 수. 일요일부터 토요일까지 — 국내 달력의 관례다. */
export const DAYS_IN_WEEK = 7;

const pad = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD`. **자릿수를 직접 맞춘다** — 시각을 찍는 함수를 쓰지 않는다. */
export const toIsoDate = (year: number, month: number, day: number): string =>
  `${String(year)}-${pad(month)}-${pad(day)}`;

/** 그 달의 날 수. `month` 는 1~12 다 — 0부터 세는 자리는 이 함수 안에만 있다. */
export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 그 달 1일의 요일(0=일). */
const firstWeekday = (year: number, month: number): number =>
  new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

export interface YearMonth {
  year: number;
  /** 1~12 */
  month: number;
}

/**
 * 달을 앞뒤로 옮긴다. **12월 다음이 이듬해 1월임을 여기 한 곳에서 안다** —
 * 부르는 쪽마다 셈하면 연말·연초에서 갈린다.
 */
export const shiftMonth = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const zeroBased = month - 1 + delta;

  return {
    year: year + Math.floor(zeroBased / 12),
    month: (((zeroBased % 12) + 12) % 12) + 1,
  };
};

/**
 * 조회에 실을 기간. **계약이 기간을 반드시 요구한다** — 한 해가 365행이라 전량을 내리지 않는다.
 *
 * ⭐ **화면에 보이는 달만 받는다.** 앞뒤 빈칸에 걸친 다른 달의 날은 칠하지 않으므로 받을 이유가
 * 없다 — 받아 두면 「보이지 않는 날의 설정」을 들고 있게 되고, 그것이 저장에 섞이면 사용자가
 * 보지 못한 날이 바뀐다.
 */
export const monthRange = ({ year, month }: YearMonth): { from: string; to: string } => ({
  from: toIsoDate(year, month, 1),
  to: toIsoDate(year, month, daysInMonth(year, month)),
});

/** 한 칸. **`null` 은 「그 달이 아닌 자리」다** — 설정이 없는 날과 다르다. */
export interface MonthCell {
  date: string | null;
}

export interface MonthWeek {
  key: string;
  cells: MonthCell[];
}

/**
 * 한 달을 주 배열로 펼친다.
 *
 * ⭐ **앞뒤 빈칸은 `null` 이다** — 이웃 달의 날짜를 흐리게 그리지 않는다. 그리면 그 칸을 눌러
 * 고칠 수 있다고 읽히는데, 이 화면은 **한 달만** 받아 오므로 그 날의 지금 설정을 모른다.
 * 모르는 것을 고치게 두지 않는다.
 */
export const buildMonthWeeks = (yearMonth: YearMonth): MonthWeek[] => {
  const { year, month } = yearMonth;
  const lead = firstWeekday(year, month);
  const total = daysInMonth(year, month);
  const weeks: MonthWeek[] = [];

  for (let start = 0; start - lead < total; start += DAYS_IN_WEEK) {
    const cells: MonthCell[] = [];

    for (let offset = 0; offset < DAYS_IN_WEEK; offset += 1) {
      const day = start + offset - lead + 1;

      cells.push({ date: day >= 1 && day <= total ? toIsoDate(year, month, day) : null });
    }

    weeks.push({ key: `${toIsoDate(year, month, 1)}-w${String(start / DAYS_IN_WEEK)}`, cells });
  }

  return weeks;
};

/** 칸에 그릴 날짜 숫자. `YYYY-MM-DD` 의 끝 두 자리를 수로 읽는다. */
export const dayOfMonth = (isoDate: string): number => Number(isoDate.slice(8, 10));

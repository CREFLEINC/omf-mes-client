import { describe, expect, it } from 'vitest';

import {
  DAYS_IN_WEEK,
  buildMonthWeeks,
  dayOfMonth,
  daysInMonth,
  monthRange,
  shiftMonth,
  toIsoDate,
} from './month-grid';

describe('toIsoDate', () => {
  it('자릿수를 맞춰 만든다', () => {
    expect(toIsoDate(2026, 1, 5)).toBe('2026-01-05');
    expect(toIsoDate(2026, 12, 31)).toBe('2026-12-31');
  });
});

describe('daysInMonth', () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('%s년 %s월은 %s일이다', (year, month, expected) => {
    expect(daysInMonth(year, month)).toBe(expected);
  });

  /* 윤년은 4년마다이되 100년은 빼고 400년은 다시 넣는다 — 규칙을 직접 셈하지 않고 달력에 묻는다. */
  it.each([
    [2024, 29],
    [2000, 29],
    [1900, 28],
    [2100, 28],
  ])('%s년 2월은 %s일이다', (year, expected) => {
    expect(daysInMonth(year, 2)).toBe(expected);
  });
});

describe('shiftMonth', () => {
  it('같은 해 안에서 옮긴다', () => {
    expect(shiftMonth({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 });
    expect(shiftMonth({ year: 2026, month: 5 }, -1)).toEqual({ year: 2026, month: 4 });
  });

  /* ⭐ 12월 다음이 이듬해 1월임을 여기 한 곳에서 안다 — 부르는 쪽마다 셈하면 연말에서 갈린다. */
  it('연말·연초를 넘는다', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('여러 달을 한 번에 옮긴다', () => {
    expect(shiftMonth({ year: 2026, month: 3 }, -5)).toEqual({ year: 2025, month: 10 });
    expect(shiftMonth({ year: 2026, month: 3 }, 24)).toEqual({ year: 2028, month: 3 });
  });

  it('0 은 그 달 그대로다', () => {
    expect(shiftMonth({ year: 2026, month: 7 }, 0)).toEqual({ year: 2026, month: 7 });
  });
});

describe('monthRange', () => {
  /* ⛔ 계약이 기간을 반드시 요구한다 — 한 해가 365행이라 전량을 내리지 않는다. */
  it('그 달의 처음과 끝을 준다', () => {
    expect(monthRange({ year: 2026, month: 2 })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange({ year: 2024, month: 2 })).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  /*
   * ⭐ **보이는 달만 받는다.** 앞뒤 빈칸에 걸친 이웃 달의 날은 칠하지 않으므로 받을 이유가
   * 없고, 받아 두면 「보이지 않는 날의 설정」을 들고 있게 된다.
   */
  it('이웃 달로 넓히지 않는다', () => {
    const range = monthRange({ year: 2026, month: 8 });

    expect(range.from.startsWith('2026-08')).toBe(true);
    expect(range.to.startsWith('2026-08')).toBe(true);
  });
});

describe('buildMonthWeeks', () => {
  /** 2026-08-01 은 토요일이다 — 앞에 빈칸 여섯이 선다. */
  const august = buildMonthWeeks({ year: 2026, month: 8 });

  it('모든 주가 일곱 칸이다', () => {
    for (const week of august) {
      expect(week.cells).toHaveLength(DAYS_IN_WEEK);
    }
  });

  it('그 달의 모든 날이 정확히 한 번씩 있다', () => {
    const dates = august.flatMap((week) => week.cells.map((cell) => cell.date)).filter(Boolean);

    expect(dates).toHaveLength(31);
    expect(new Set(dates).size).toBe(31);
    expect(dates[0]).toBe('2026-08-01');
    expect(dates.at(-1)).toBe('2026-08-31');
  });

  /* ⭐ 1일이 그 요일 자리에 서야 달력이다 — 2026-08-01 은 토요일이라 첫 주의 마지막 칸이다. */
  it('1일이 제 요일 자리에 선다', () => {
    expect(august[0]?.cells.map((cell) => cell.date)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      '2026-08-01',
    ]);
  });

  /*
   * ⛔ **이웃 달의 날짜를 채우지 않는다.** 흐리게라도 그리면 그 칸을 눌러 고칠 수 있다고
   * 읽히는데, 화면은 한 달만 받아 오므로 그 날의 지금 설정을 모른다.
   */
  it('빈칸은 `null` 이지 이웃 달의 날짜가 아니다', () => {
    const blanks = august.flatMap((week) => week.cells).filter((cell) => cell.date === null);

    expect(blanks.length).toBeGreaterThan(0);
    for (const cell of blanks) {
      expect(cell.date).toBeNull();
    }
  });

  /** 1일이 일요일이면 앞 빈칸이 없다 — 2026-02-01 이 일요일이다. */
  it('1일이 일요일이면 앞 빈칸이 없다', () => {
    expect(buildMonthWeeks({ year: 2026, month: 2 })[0]?.cells[0]?.date).toBe('2026-02-01');
  });

  it('주 키가 서로 다르다', () => {
    const keys = august.map((week) => week.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /* 달마다 주 수가 다르다 — 고정 6주로 그리면 빈 줄이 남는다. */
  it('필요한 주만 만든다', () => {
    expect(buildMonthWeeks({ year: 2026, month: 2 })).toHaveLength(4);
    expect(august.length).toBeGreaterThan(4);
  });
});

describe('dayOfMonth', () => {
  it('날짜 숫자를 읽는다', () => {
    expect(dayOfMonth('2026-08-01')).toBe(1);
    expect(dayOfMonth('2026-08-31')).toBe(31);
  });
});

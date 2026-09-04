/**
 * 「주기 내」가 어디부터인가 — **점검 이력을 어느 기간에서 찾을지 정하는 한 곳**이다.
 *
 * 스펙 §5-5 는 「주기 내 점검 이력이 있는가」로 판정하라고 했지만 **창의 경계를 정하지
 * 않았다.** 계약이 부여마다 주기 단위(`cycleTypeCode`)·간격(`cycleInterval`)·기준일
 * (`cycleBaseDate`)을 내려주므로 창을 계산할 수는 있다 — 이 파일이 그 계산이다.
 *
 * ⚠ **여기서 쓰는 규칙은 우리 해석이다**(계획 r2 「가정」). 기준일에서 간격만큼 반복해
 * **오늘이 든 구간의 시작일**을 창의 시작으로 본다. 설계 회신이 다른 규칙을 정하면 이
 * 파일 하나만 바뀐다 — 판정과 조회가 이 값을 통해서만 기간을 안다.
 *
 * ⛔ **모르면 넓히지 않고 좁힌다.** 주기를 해석할 수 없을 때 창을 넓게 잡으면 지난 점검이
 * 오늘 것으로 인정돼 **차단해야 할 작업이 열린다** — 위험한 쪽으로 기우는 기본값을 두지
 * 않는다(F-6 · 공유계약 A-14 와 같은 원리).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 창을 계산하는 데 필요한 것만 받는다 — 부여 한 건 전체를 넘기지 않아도 된다. */
export interface CycleSpec {
  cycleTypeCode: string;
  cycleInterval: number;
  cycleBaseDate?: string | null;
}

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const parse = (value: string): CivilDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.trim());

  if (match === null) return null;

  const [, year, month, day] = match;

  return { year: Number(year), month: Number(month), day: Number(day) };
};

const format = ({ year, month, day }: CivilDate): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** 날짜 셈은 UTC 자정으로 고정한다 — 지역 시간대의 서머타임이 하루를 먹는 자리다. */
const utc = ({ year, month, day }: CivilDate): number => Date.UTC(year, month - 1, day);

const daysBetween = (from: CivilDate, to: CivilDate): number =>
  Math.floor((utc(to) - utc(from)) / 86_400_000);

const monthsBetween = (from: CivilDate, to: CivilDate): number =>
  (to.year - from.year) * 12 + (to.month - from.month);

const lastDayOfMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const addMonths = (base: CivilDate, months: number): CivilDate => {
  const zero = base.year * 12 + (base.month - 1) + months;
  const year = Math.floor(zero / 12);
  const month = (zero % 12) + 1;

  /* ⚠ 1/31 에 한 달을 더하면 2/31 이 된다 — 그 달의 마지막 날로 당긴다. */
  return { year, month, day: Math.min(base.day, lastDayOfMonth(year, month)) };
};

const addDays = (base: CivilDate, days: number): CivilDate => {
  const moved = new Date(utc(base) + days * 86_400_000);

  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
};

/**
 * 달 단위 주기의 창 시작일 — **몇 번째 구간인지 세고 나서 실제 날짜로 확인한다.**
 *
 * ⚠ 달 수를 나누는 것만으로는 어긋난다. 기준일이 31일이면 2월에는 그 날이 없어 28일로
 * 당겨지는데, 「날짜가 기준일보다 작으면 아직 안 왔다」로 세면 **2월 28일에 새 구간이
 * 시작된 것을 놓친다.** 어림수를 먼저 잡고 양쪽으로 한 칸씩 맞춘다.
 */
const monthlyWindowStart = (base: CivilDate, now: CivilDate, step: number): CivilDate => {
  let count = Math.floor(monthsBetween(base, now) / step);

  while (count > 0 && utc(addMonths(base, count * step)) > utc(now)) count -= 1;
  while (utc(addMonths(base, (count + 1) * step)) <= utc(now)) count += 1;

  return addMonths(base, Math.max(count, 0) * step);
};

/**
 * 주기 창의 시작일(`YYYY-MM-DD`). 점검 이력 조회의 `inspectedFrom` 이 이 값을 쓴다.
 *
 * @param today 단말이 보는 오늘(`YYYY-MM-DD`). ⛔ 함수가 시계를 직접 읽지 않는다 — 읽으면
 *   시험이 자정에만 깨진다.
 */
export const cycleWindowStart = (spec: CycleSpec, today: string): string => {
  const now = parse(today);

  if (now === null) return today;

  const base = spec.cycleBaseDate == null ? null : parse(spec.cycleBaseDate);
  const interval = Number.isInteger(spec.cycleInterval) ? spec.cycleInterval : 0;

  /* 기준일을 모르면 오늘 하루로 좁힌다 — 부여일이 응답에 없어 지어낼 수 없다. */
  if (base === null || interval < 1) return format(now);

  /* 기준일이 아직 오지 않았다 — 첫 구간이 시작되지 않았으므로 그 날이 창의 시작이다. */
  if (utc(base) > utc(now)) return format(base);

  switch (spec.cycleTypeCode.trim()) {
    case 'DAY':
      return format(addDays(base, Math.floor(daysBetween(base, now) / interval) * interval));

    case 'WEEK': {
      const step = interval * 7;

      return format(addDays(base, Math.floor(daysBetween(base, now) / step) * step));
    }

    case 'MONTH':
      return format(monthlyWindowStart(base, now, interval));

    case 'YEAR':
      return format(monthlyWindowStart(base, now, interval * 12));

    default:
      /* ⛔ 모르는 단위를 임의로 해석하지 않는다. */
      return format(now);
  }
};

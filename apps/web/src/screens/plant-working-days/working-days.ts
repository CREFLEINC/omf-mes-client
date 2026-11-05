import type { components } from '@omf-mes/api-client';

type OperationPolicy = components['schemas']['OperationPolicy'];

/** 공장 주간 근무일 — 주 5일제(월~금) · 주 6일제(월~토). */
export type WeeklyWorkingDays = 5 | 6;

/** 정책 행이 없는 공장은 서버가 5 로 계산한다(계약 §4 — 이 코드만의 예외). */
export const DEFAULT_WORKING_DAYS: WeeklyWorkingDays = 5;

export const WORKING_DAYS_POLICY_CODE = 'WEEKLY_WORKING_DAYS';

/** `YYYY-MM-DD` 를 시간대 없는 날짜로 다룬다 — 요일 계산만 하므로 UTC 정오로 잡아 하루가 밀리지 않게 한다. */
const toDate = (iso: string): Date => new Date(`${iso}T12:00:00Z`);
const toIso = (date: Date): string => date.toISOString().slice(0, 10);

/** 0 = 일 … 6 = 토. */
export const dayOfWeek = (iso: string): number => toDate(iso).getUTCDay();

export const addDays = (iso: string, days: number): string => {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
};

/** 주 5일제는 토 · 일, 주 6일제는 일이 휴일이다. 공휴일 · 근무달력은 쓰지 않는다. */
export const isWorkingDay = (iso: string, days: WeeklyWorkingDays): boolean => {
  const dow = dayOfWeek(iso);
  return dow !== 0 && (days === 6 || dow !== 6);
};

/** 휴일 요일(0 = 일 … 6 = 토). */
export const offDays = (days: WeeklyWorkingDays): number[] => (days === 5 ? [6, 0] : [0]);

/**
 * 출고 작업일 = 생산일의 1근무일 전(곧 직전 근무일, 3차 개정 2026-11-03). 건너뛴 휴일도 함께 낸다 —
 * 화면 예시 열이 「무엇을 건너뛰었는지」를 보인다. 서버 계산(`issueWorkDate`)과 같은 규칙이다.
 */
export const previousWorkingDay = (
  productionDate: string,
  days: WeeklyWorkingDays,
): { date: string; skipped: string[] } => {
  const skipped: string[] = [];
  let date = addDays(productionDate, -1);
  while (!isWorkingDay(date, days)) {
    skipped.push(date);
    date = addDays(date, -1);
  }
  return { date, skipped };
};

/** 예시 열의 생산일 — 오늘 다음의 월요일(휴일을 건너뛰는 모습이 늘 보인다). */
export const nextMonday = (today: string): string => {
  const ahead = (8 - dayOfWeek(today)) % 7 || 7;
  return addDays(today, ahead);
};

/**
 * 공장 시간대의 오늘. 공장 시간대 값이 IANA 이름이 아니면(합성 · 옛 값) 브라우저 날짜로 둔다.
 * 「그날부터 적용」 행의 시작일이 이 값이다(R-10).
 */
export const todayIn = (timeZone: string | undefined, now: Date = new Date()): string => {
  const local = (): string => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  };
  if (timeZone === undefined || timeZone === '') return local();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return local();
  }
};

/** 공장 범위(품목 · 공정 없음) 행 중 오늘 적용되는 것 — 시작일이 가장 늦은 행. */
export const currentPolicy = (
  policies: readonly OperationPolicy[],
  plantId: number,
  today: string,
): OperationPolicy | undefined =>
  policies
    .filter(
      (policy) =>
        policy.plantId === plantId &&
        (policy.itemId ?? null) === null &&
        (policy.processId ?? null) === null &&
        policy.effectiveFrom <= today &&
        (policy.effectiveTo === undefined ||
          policy.effectiveTo === null ||
          policy.effectiveTo >= today),
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];

export const toWorkingDays = (value: number | null | undefined): WeeklyWorkingDays =>
  value === 6 ? 6 : DEFAULT_WORKING_DAYS;

/** 같은 공장 · 같은 시작일 행 — 오늘 이미 바꾼 공장은 새 행 대신 그 행을 고친다(같은 범위 · 같은 시작일은 한 건). */
export const sameDayPolicy = (
  policies: readonly OperationPolicy[],
  plantId: number,
  today: string,
): OperationPolicy | undefined =>
  policies.find(
    (policy) =>
      policy.plantId === plantId &&
      (policy.itemId ?? null) === null &&
      (policy.processId ?? null) === null &&
      policy.effectiveFrom === today,
  );

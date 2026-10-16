import { toPlantDateTimeParts } from '../../patterns/plant-time';

/**
 * 조회 조건의 정본은 **주소**다. 새로고침·뒤로가기·주소 공유가 같은 화면을 낸다.
 *
 * ⛔ **축을 늘리지 않는다.** 대시보드는 좁히는 화면이 아니라 넓게 보는 화면이고, 좁히려면
 * 카드를 눌러 소유 화면으로 간다. 축이 둘(기간 · 공장)뿐인 것은 이 화면의 성격이다.
 *
 * ⭐ 기간 조회(사용자 확정 2026-10-16) — 주소 키 `from` · `to`(양 끝 포함, 최대 92일). 예전 하루 조회 주소
 * `baseDate` 는 `from = to = baseDate` 로 읽는다(공유된 주소가 깨지지 않게).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface DashboardFilters {
  /**
   * 기간 시작 · 끝(YYYY-MM-DD). **둘 다 비어 있으면 서버가 오늘로 정한다** — 기본 조회는 「오늘」을 계산하지
   * 않는다. 계산하면 브라우저 시계와 서버 시계가 어긋난 자정 전후에 서로 다른 날을 본다.
   */
  dateFrom: string;
  dateTo: string;
  /** 공장. 빈 문자열이면 전체다. */
  plant: string;
}

export const EMPTY_FILTERS: DashboardFilters = { dateFrom: '', dateTo: '', plant: '' };

/** 기간 최대 길이(양 끝 포함, 서버 규칙과 같다). */
export const MAX_PERIOD_DAYS = 92;

/** 날짜 칸에 들어올 수 있는 모양. 주소는 사람이 손으로 고칠 수 있어 형식을 확인한다. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 공장 번호는 양의 정수다. 아니면 조건이 없는 것으로 읽는다 — 서버에 쓰레기를 넘기지 않는다. */
const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

const isDate = (value: string): boolean =>
  DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export const readFilters = (params: URLSearchParams): DashboardFilters => {
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const legacy = params.get('baseDate') ?? '';
  const plant = isPositiveInteger(params.get('plant') ?? '') ? (params.get('plant') ?? '') : '';

  if (isDate(from) && isDate(to)) return { dateFrom: from, dateTo: to, plant };
  if (isDate(legacy)) return { dateFrom: legacy, dateTo: legacy, plant };

  return { dateFrom: '', dateTo: '', plant };
};

/** 채운 조건만 주소에 싣는다 — 빈 키를 남기면 주소가 길어지기만 하고 뜻이 같다. */
export const toSearchParams = (filters: DashboardFilters): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.dateFrom !== '' && filters.dateTo !== '') {
    params.set('from', filters.dateFrom);
    params.set('to', filters.dateTo);
  }
  if (filters.plant !== '') params.set('plant', filters.plant);

  return params;
};

export interface DashboardFilterQuery {
  dateFrom?: string;
  dateTo?: string;
  plantId?: number;
}

/**
 * 조건을 요청 질의로 옮긴다. 빈 값은 키 자체를 싣지 않는다. 기간을 골랐으면 하루여도 `dateFrom = dateTo` 로
 * 보낸다(하위 호환 `baseDate` 는 쓰지 않는다 — 기간과 함께 보내면 서버가 400).
 */
export const toFilterQuery = (filters: DashboardFilters): DashboardFilterQuery => ({
  ...(filters.dateFrom === '' || filters.dateTo === ''
    ? {}
    : { dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
  ...(filters.plant === '' ? {} : { plantId: Number(filters.plant) }),
});

/**
 * 카드를 눌러 소유 화면으로 갈 때 **함께 넘기는 기준 축**.
 *
 * ⭐ 넘기지 않으면 사용자가 8월 11일의 이상한 숫자를 보고 눌렀는데 오늘 자료가 열린다 —
 * 그 순간 「대시보드가 틀렸다」로 읽힌다. 소유 화면은 하루 기준(`baseDate`)이라 **기간의 끝 날**을 넘긴다.
 * 기간이 비어 있으면(서버가 오늘로 정한 상태) **응답이 알려 준 날짜**를 넘긴다 — 그래야 화면이 「오늘」을
 * 스스로 계산하지 않고도 축이 이어진다.
 */
export const toDrilldownParams = (
  filters: DashboardFilters,
  resolvedBaseDate: string | null,
): URLSearchParams => {
  const params = new URLSearchParams();
  const baseDate = filters.dateTo === '' ? (resolvedBaseDate ?? '') : filters.dateTo;

  if (baseDate !== '') params.set('baseDate', baseDate);
  if (filters.plant !== '') params.set('plantId', filters.plant);

  return params;
};

/** YYYY-MM-DD 에 날수를 더한다(달력 계산 · 시간대와 무관). */
export const addDays = (date: string, days: number): string => {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;

  return new Date(time).toISOString().slice(0, 10);
};

/** 양 끝을 포함한 날수. */
export const periodDays = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * 공장 시각(Asia/Ho_Chi_Minh)의 오늘 — 빠른 선택(어제 · 최근 7일 · 이번 달)과 미래 날짜 막기에만 쓴다(사용자 확정
 * 2026-10-16). 단말 시계가 틀리면 서버가 RANGE 400 으로 걸러 날짜 칸 옆에 안내가 선다.
 */
export const plantToday = (now: Date = new Date()): string =>
  toPlantDateTimeParts(now.toISOString())?.date ?? now.toISOString().slice(0, 10);

export type QuickPeriod = 'today' | 'yesterday' | 'last7' | 'thisMonth';

export const QUICK_PERIODS: readonly QuickPeriod[] = ['today', 'yesterday', 'last7', 'thisMonth'];

/** 빠른 선택의 기간. */
export const quickPeriodOf = (quick: QuickPeriod, today: string): [string, string] => {
  switch (quick) {
    case 'today':
      return [today, today];
    case 'yesterday':
      return [addDays(today, -1), addDays(today, -1)];
    case 'last7':
      return [addDays(today, -6), today];
    case 'thisMonth':
      return [`${today.slice(0, 8)}01`, today];
  }
};

/** 고른 기간이 서버 규칙을 어기는가 — 순서 · 92일 초과 · 미래. 문제가 없으면 `null`. */
export type PeriodProblem = 'order' | 'tooLong' | 'future';

export const periodProblemOf = (from: string, to: string, today: string): PeriodProblem | null => {
  if (from > to) return 'order';
  if (to > today) return 'future';
  if (periodDays(from, to) > MAX_PERIOD_DAYS) return 'tooLong';

  return null;
};

/**
 * 지금 보는 기간이 **하루**인가. 비어 있으면(서버의 오늘) 하루다. 하루면 표기는 지금 그대로(「금일」 · 「전일
 * 대비」), 이틀 이상이면 「선택 기간」 · 「직전 기간 대비」.
 */
export const isSingleDay = (filters: DashboardFilters): boolean =>
  filters.dateFrom === '' || filters.dateFrom === filters.dateTo;

/**
 * 자동 갱신을 걸 것인가 — 기간의 끝이 오늘이거나 비어 있을 때만(사용자 확정 2026-10-16). 지난 기간은 값이
 * 바뀌지 않으니 1분 재조회를 하지 않는다(「갱신」 단추는 그대로).
 */
export const isLivePeriod = (filters: DashboardFilters, today: string): boolean =>
  filters.dateTo === '' || filters.dateTo >= today;

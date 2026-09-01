/**
 * 조회 조건.
 *
 * ⚠ **기본 정렬이 「경과일 긴 순」이다**(§5-7). 목록의 관행은 최신순인데, 적체 관리 화면에서는
 * **오래된 것이 위험하다** — 관행을 따르면 가장 위험한 건이 마지막 쪽에 숨는다.
 */

export type SortKey = 'elapsed' | 'shipDate' | 'customer';

export interface ConfirmFilters {
  from: string;
  to: string;
  sort: SortKey;
}

export interface ConfirmListQuery {
  shipDateFrom: string;
  shipDateTo: string;
  unconfirmedOnly: true;
  sort: string;
  page?: number;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export const toDateString = (date: Date): string =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 달력에 실제로 있는 날인가 — `2026-02-31`은 모양은 맞지만 없는 날이다. */
export const isDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;

  const parts = value.split('-').map(Number);
  const [year, month, day] = parts;
  if (year === undefined || month === undefined || day === undefined) return false;

  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/**
 * 기본 기간 — 최근 한 달.
 *
 * ⚠ **기본값이 「오늘」이 아니다**(§5-9). 오늘로 시작하면 **적체가 화면에서 사라진다** — 이
 * 화면이 존재하는 이유가 그 적체를 보는 것이다.
 */
export const defaultFilters = (today: Date): ConfirmFilters => {
  const from = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  return { from: toDateString(from), to: toDateString(today), sort: 'elapsed' };
};

export const isUsable = (filters: ConfirmFilters): boolean =>
  isDate(filters.from) && isDate(filters.to) && filters.from <= filters.to;

/**
 * 계약이 받는 정렬 값.
 *
 * ⚠ 계약이 `sort` 를 자유 문자열로 두어(값 목록이 없다) 화면이 이름을 정한다 — 서버가 모르는
 * 이름을 보내면 무시될 뿐 조회가 깨지지는 않지만, **정렬이 안 먹는데 화면은 먹은 척한다.**
 * 그래서 기본값을 「경과일 긴 순」의 뜻인 `shippedAt` 오름차순으로 두고, 뜻을 주석에 남긴다.
 */
const SORT_VALUES: Record<SortKey, string> = {
  /* 오래 전에 나간 것이 위에 온다 = 실물 출하 시각 오름차순. */
  elapsed: 'shippedAt,asc',
  shipDate: 'shipDate,desc',
  customer: 'customer,asc',
};

/** 조회 조건. **기간이 못 쓸 값이면 `null`** — 계약이 출하일을 필수로 둔다(L-3). */
export const toListQuery = (filters: ConfirmFilters, page: number): ConfirmListQuery | null => {
  if (!isUsable(filters)) return null;

  return {
    shipDateFrom: filters.from,
    shipDateTo: filters.to,
    /* ⭐ 이 화면은 미확정만 본다 — 확정된 건은 여기서 할 일이 없다(§5-9). */
    unconfirmedOnly: true,
    sort: SORT_VALUES[filters.sort],
    ...(page > 1 ? { page } : {}),
  };
};

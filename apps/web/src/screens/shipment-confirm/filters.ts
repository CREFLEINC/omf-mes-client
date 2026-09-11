/**
 * 조회 조건.
 *
 * ⚠ **기본 정렬이 「경과일 긴 순」이다**(§5-7). 목록의 관행은 최신순인데, 적체 관리 화면에서는
 * **오래된 것이 위험하다** — 관행을 따르면 가장 위험한 건이 마지막 쪽에 숨는다.
 *
 * ⛔ **정렬 선택지가 `elapsed` 하나다.** 원래 설계는 `shipDate`(출하일순)·`customer`(고객순)도
 * 두었지만, 서버 구현 기준 `GET /logistics/shipments`가 실제로 받는 `sort`는 `shippedAt`·
 * `shipmentNo` 둘뿐이다(통보 219) — 그 밖의 값을 보내면 400이다. 두 선택지는 대응할 계약 값이
 * 없어 없앤다(대응표 「정렬 키 제한」). `shipmentNo`(출하번호순)는 이 화면의 원래 설계에 없던
 * 값이라 임의로 새 선택지를 만들지 않는다 — 허용 밖 값만 없앤다.
 */

export type SortKey = 'elapsed';

export interface ConfirmFilters {
  from: string;
  to: string;
  sort: SortKey;
}

export interface ConfirmListQuery {
  shipDateFrom: string;
  shipDateTo: string;
  unconfirmedOnly: true;
  /** 계약이 허용하는 값 그대로 — 방향 접미사를 붙이지 않는다(통보 219, 서버가 방향을 받지 않는다). */
  sort: 'shippedAt';
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
 * ⚠ **서버 구현 기준 `sort`는 열거값 `shippedAt`·`shipmentNo`뿐이고 방향을 받지 않는다**(통보
 * 219). 예전에는 계약이 `sort`를 자유 문자열로 두어 화면이 `,asc`/`,desc` 접미사로 방향까지
 * 얹었지만, 그 모양을 그대로 보내면 이제 허용 밖 값이라 400이다. 「경과일 긴 순」은 실물 출하
 * 시각 오름차순이라는 뜻이므로 방향 표기 없이 `shippedAt` 그대로 보낸다 — 실제 정렬 방향은
 * 서버가 값의 뜻대로 매긴다(W-04-12 §5-7).
 */
const SORT_VALUES: Record<SortKey, 'shippedAt'> = {
  elapsed: 'shippedAt',
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

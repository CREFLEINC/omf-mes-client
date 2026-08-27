import { type PeriodInput, resolvePeriod } from './period';

/**
 * 정렬할 수 있는 열.
 *
 * ⛔ **L-4 — 아무 열이나 정렬하게 두지 않는다.** 인덱스 없는 열에서 전체 정렬이 돌면 목록이
 * 멎는다. 그래서 **스펙이 지정한 열만** 여기 적고, 그 밖의 값이 주소로 들어오면 기본 순서로
 * 되돌린다.
 *
 * ⚠ **달성률만 조건이 붙는다** — 파생이라 정렬이 비싸서 **기간이 좁을 때만** 허용한다
 * (스펙 §5-1 ④). 좁고 넓음의 경계는 기간 경고와 **같은 수**를 쓴다: 사용자에게 「넓다」고
 * 말해 놓고 다른 기준으로 정렬을 막으면 두 말이 어긋난다.
 */
export const SORT_KEYS = [
  'workOrderNo',
  'plannedStartAt',
  'statusCode',
  'priorityNo',
  'achievementRate',
] as const;

export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/** 계약의 기본값과 같다 — 화면이 아무것도 고르지 않았을 때 서버가 쓰는 순서다. */
export const DEFAULT_SORT: SortState = { key: 'priorityNo', direction: 'asc' };

/**
 * 기간이 넓은가 — 달성률 정렬을 허용할지 가르는 값이다.
 *
 * ⛔ **막힌 기간은 「넓다」로 보지 않는다.** 막힌 상태에서는 조회 자체가 안 나가므로 정렬을
 * 따질 자리가 없고, 여기서 참을 돌려주면 **기간을 채우기도 전에 정렬이 사라진다.**
 */
export const isWidePeriod = (period: PeriodInput): boolean => {
  const state = resolvePeriod(period, 0);
  return state.kind === 'ready' && state.warning !== null;
};

/** 이 기간에서 이 열로 정렬할 수 있는가. */
export const isSortKeyAllowed = (key: SortKey, period: PeriodInput): boolean =>
  key !== 'achievementRate' || !isWidePeriod(period);

/**
 * 주소의 `열,방향`을 읽는다.
 *
 * ⭐ **막는 것은 «열»이지 방향이 아니다.** 열이 허용된 값이면 방향이 없거나 이상해도 그 열의
 * 오름차순으로 둔다 — 기본 순서로 되돌리면 사용자가 고른 열이 이유 없이 사라진다.
 */
export const parseSort = (raw: string | null, period: PeriodInput): SortState => {
  const [key, direction] = (raw?.trim() ?? '').split(',');
  const isKnown = SORT_KEYS.includes(key as SortKey);

  if (!isKnown || !isSortKeyAllowed(key as SortKey, period)) return DEFAULT_SORT;

  return { key: key as SortKey, direction: direction === 'desc' ? 'desc' : 'asc' };
};

/** 서버가 받는 표기. 「열,방향」 한 문자열이다. */
export const toSortParam = (sort: SortState, period: PeriodInput): string => {
  /* 주소를 손으로 고쳐 넣어도 여기서 한 번 더 막는다 — 문이 둘이어야 하나가 무너져도 남는다. */
  const safe = isSortKeyAllowed(sort.key, period) ? sort : DEFAULT_SORT;

  return `${safe.key},${safe.direction}`;
};

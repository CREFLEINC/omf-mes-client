import type { SortState } from '@crefle/web-ui';

import type { ViewAxis } from './view-axis';

/**
 * 정렬 — 서버가 하고, 열만 보내며, 방향을 보내지 않는다(W-01-07과 같은 계약 형편).
 *
 * ⚠ **계획은 LOT별 보기에 `availableQty`·`earliestExpiryDate`·`manufacturedAt` 세 열을
 * 열라고 지시했다.** 설계 저장소의 OpenAPI 정본은 실제로 그 세 열을 `sort` 열거값에 담고
 * 있지만(`⭐ earliestExpiryDate 오름차순이 FEFO 권장 순서다`), 이 클라이언트가 생성한
 * `@omf-mes/api-client`의 `/inventory/balances` 계약에는 **아직 다섯 열만 있다**
 * (`itemCode`·`lotNo`·`locationCode`·`onHandQty`·`availableQty` — `types.ts`가 적어 둔
 * 계약 생성 지연과 같은 원인). `earliestExpiryDate`·`manufacturedAt`을 보내면 타입 검사가
 * 막고, 우회해 보내도 서버가 모르는 값이라 400이다. 그래서 지금은 **세 보기 모두
 * `availableQty` 한 열만** 연다. 계약 생성물이 갱신되면 LOT별 보기에 두 열을 더 열 수 있다.
 *
 * 계약이 방향(오름/내림)을 받지 않는다. `aria-sort`는 「모름」을 표기할 수단이 없으므로
 * **오름차순으로 표기하고 그 사실을 밝힌다.**
 *
 * 순수 함수만 둔다. 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 계약의 `sort` 열거값 전부(지금 생성된 계약 기준). 이 밖의 값을 보내면 400이다. */
export const CONTRACT_SORT_KEYS = [
  'itemCode',
  'lotNo',
  'locationCode',
  'onHandQty',
  'availableQty',
] as const;

export type SortKey = (typeof CONTRACT_SORT_KEYS)[number];

/**
 * 보기마다 정렬을 열 수 있는 열. 지금은 세 보기가 `availableQty` 하나를 공유한다(위 파일
 * 주석). 형태는 W-01-07처럼 보기별 배열로 두어, 계약이 갱신되면 이 표만 넓히면 되게 한다.
 */
const SORTABLE_KEYS: Record<ViewAxis, readonly SortKey[]> = {
  item: ['availableQty'],
  lot: ['availableQty'],
  location: ['availableQty'],
};

export const sortableKeysOf = (view: ViewAxis): readonly SortKey[] => SORTABLE_KEYS[view];

const isSortableIn = (value: string, view: ViewAxis): value is SortKey =>
  (sortableKeysOf(view) as readonly string[]).includes(value);

/**
 * 주소가 담은 정렬 열. 없으면 정렬하지 않는다 — 그래야 「해제」한 상태를 주소로 나타낼 수
 * 있다. 계약 열거값이어도 그 보기의 열이 아니면 버린다.
 */
export const readSortKey = (raw: string | null, view: ViewAxis): SortKey | null => {
  const value = raw ?? '';

  return isSortableIn(value, view) ? value : null;
};

/**
 * 머리글을 눌렀을 때의 다음 정렬 열. 디자인 시스템 `Table`은 없음 → 오름차순 → 내림차순 →
 * 없음으로 돌지만, 계약이 방향을 받지 않아 **내림차순 상태로 들어가지 않는다** — 같은 열이
 * 다시 오면 방향이 무엇이든 해제한다.
 */
export const nextSortKey = (
  current: SortKey | null,
  next: SortState | null,
  view: ViewAxis,
): SortKey | null => {
  if (next === null) return null;
  if (next.key === current) return null;

  return isSortableIn(next.key, view) ? next.key : null;
};

/** 표에 넘기는 제어 정렬 상태. 오름차순으로 표기한다(위 파일 주석). */
export const toSortState = (key: SortKey | null): SortState | null =>
  key === null ? null : { key, direction: 'ascending' };

/** 계약이 받는 정렬. 방향을 뜻하는 키를 만들지 않는다 — 만들면 400이다. */
export interface SortQuery {
  sort?: SortKey;
}

export const toSortQuery = (key: SortKey | null): SortQuery => (key === null ? {} : { sort: key });

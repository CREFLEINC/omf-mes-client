import type { SortState } from '@crefle/web-ui';

import type { ViewAxis } from './view-axis';

/**
 * 정렬 — **서버가 하고, 열만 보내며, 방향을 보내지 않는다.**
 *
 * W-01-09(`inbound-schedule`)와 **정반대 규칙**이다. 그 화면은 계약에 정렬 파라미터가 없어
 * 표가 현재 쪽 안에서 스스로 정렬했고, 이 화면은 계약의 `sort`가 전체 결과를 정렬해
 * 쪽을 다시 나눠 준다. 그래서 정렬을 바꾸면 쪽이 첫 쪽으로 되돌아가고, 표 아래 안내 문구도
 * 「현재 쪽 안에서만」이 아니라 「전체 결과 기준」이다. **베끼면 틀린다.**
 *
 * 계약이 방향(오름/내림)을 받지 않는다. `aria-sort`는 `ascending`·`descending`·`none` 중
 * 하나여야 해서 「모름」을 표기할 수단이 없으므로 **오름차순으로 표기하고 그 사실을 밝힌다**
 * (설계 저장소에 `[client→uiux]` 질문을 함께 올린다). 그래서 정렬 사이클이
 * **「없음 → 이 열로 정렬 → 해제」 두 상태**이고 내림차순 상태로 들어가지 않는다.
 *
 * 순수 함수만 둔다. 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 계약의 `sort` 열거값 전부. 이 밖의 값을 보내면 400이다. */
export const CONTRACT_SORT_KEYS = [
  'itemCode',
  'lotNo',
  'locationCode',
  'onHandQty',
  'availableQty',
] as const;

export type SortKey = (typeof CONTRACT_SORT_KEYS)[number];

/**
 * 보기마다 정렬을 열 수 있는 열.
 *
 * **계약 열거값 ∩ 그 보기의 표에 실제로 있는 열**이다(이슈 #21 §6 「임의 열 정렬을 열지 마세요」).
 * 순서는 표의 열 순서와 같다 — 다르면 정렬 가능한 열을 눈으로 찾을 때 순서가 어긋난다.
 *
 * 수량 두 열(`onHandQty`·`availableQty`)은 세 보기가 공유한다. 축 열은 보기마다 다르다 —
 * 품목별에는 LOT·위치 열이 없고, LOT별에는 위치 열이 없고, 위치별에는 LOT 열이 없다.
 */
const SORTABLE_KEYS: Record<ViewAxis, readonly SortKey[]> = {
  item: ['itemCode', 'onHandQty', 'availableQty'],
  lot: ['itemCode', 'lotNo', 'onHandQty', 'availableQty'],
  location: ['locationCode', 'itemCode', 'onHandQty', 'availableQty'],
};

export const sortableKeysOf = (view: ViewAxis): readonly SortKey[] => SORTABLE_KEYS[view];

/**
 * 그 보기의 기본 정렬 열 — **그룹 축과 같게 둔다.**
 *
 * 그룹은 서버가 준 순서에서 처음 나온 차례로 묶인다. 정렬 축이 그룹 축과 다르면 같은 그룹이
 * 흩어져 그룹 헤더가 여러 번 나온다. 품목별은 그룹이 없지만 같은 열을 기본으로 두어
 * 보기를 오갈 때 순서가 튀지 않게 한다.
 *
 * **언제나 `sortableKeysOf`에 든 값이다** — 아니면 사용자가 그 정렬을 풀 수단이 화면에 없다.
 */
export const defaultSortKey = (view: ViewAxis): SortKey => {
  switch (view) {
    case 'item':
    case 'lot':
      return 'itemCode';
    case 'location':
      return 'locationCode';
  }
};

const isSortableIn = (value: string, view: ViewAxis): value is SortKey =>
  (sortableKeysOf(view) as readonly string[]).includes(value);

/**
 * 주소가 담은 정렬 열. **없으면 정렬하지 않는다.**
 *
 * 없는 것을 기본값으로 읽지 않는 이유: 그러면 「해제」한 상태를 주소로 나타낼 방법이 사라져
 * 정렬 사이클의 셋째 걸음이 죽는다. 보기를 바꿀 때 기본값을 **주소에 써 넣는 것**은
 * 화면(수명 표 1행)의 몫이고, 이 함수는 쓰여 있는 것만 읽는다.
 *
 * 계약 열거값이어도 **그 보기의 열이 아니면 버린다** — 계약은 받지만 표에 그 열이 없어
 * 정렬 표시가 어디에도 나타나지 않는 상태가 된다.
 */
export const readSortKey = (raw: string | null, view: ViewAxis): SortKey | null => {
  const value = raw ?? '';

  return isSortableIn(value, view) ? value : null;
};

/**
 * 머리글을 눌렀을 때의 다음 정렬 열.
 *
 * 디자인 시스템 `Table`은 없음 → 오름차순 → 내림차순 → 없음으로 돌지만, **내림차순 상태로
 * 들어가지 않는다** — 계약이 방향을 받지 않아 표기와 실제가 어긋난다. 같은 열이 다시 오면
 * 방향이 무엇이든 해제한다.
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

/**
 * 표에 넘기는 제어 정렬 상태.
 *
 * **오름차순으로 표기한다.** 계약이 방향을 받지 않아 실제 방향을 알 수 없으나 `aria-sort`가
 * 「모름」을 표기할 수 없어 하나를 골라야 한다. 그 사실은 표 아래 안내가 밝힌다.
 */
export const toSortState = (key: SortKey | null): SortState | null =>
  key === null ? null : { key, direction: 'ascending' };

/** 계약이 받는 정렬. **방향을 뜻하는 키를 만들지 않는다** — 만들면 400이다. */
export interface SortQuery {
  sort?: SortKey;
}

export const toSortQuery = (key: SortKey | null): SortQuery => (key === null ? {} : { sort: key });

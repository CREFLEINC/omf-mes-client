import type { SortState } from '@crefle/web-ui';

/**
 * 정렬 — **서버가 하고, 열만 보내며, 방향을 보내지 않는다.**
 *
 * W-01-07(`stock-status/sort.ts`)과 같은 규칙이다 — 계약의 `sort`가 전체 결과를 정렬해 쪽을
 * 다시 나눠 준다. 계약이 방향(오름/내림)을 받지 않는다. `aria-sort`는 `ascending`·`descending`·
 * `none` 중 하나여야 해서 「모름」을 표기할 수단이 없으므로 **오름차순으로 표기하고 그 사실을
 * 안내로 밝힌다.** W-01-07이 이미 같은 사정으로 설계 저장소에 `[client→uiux]` 질문을
 * 올려 두었다 — 계약 전체에 걸친 사정이라 이 화면에서 새로 묻지 않는다.
 *
 * W-01-09(`inbound-schedule`)와는 정반대다 — 그 화면은 계약에 정렬 파라미터가 없어 표가
 * 현재 쪽 안에서 스스로 정렬한다. 베끼면 틀린다.
 *
 * 이 화면은 보기가 하나뿐이라 W-01-07처럼 보기별 정렬 가능 열 표를 두지 않는다 —
 * 계약 열거값이 곧 정렬 가능한 열 전체다.
 *
 * 순수 함수만 둔다. 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 계약의 `sort` 열거값 전부(공유계약 L-4 — 출하일·고객·작업지시번호 셋만). */
export const CONTRACT_SORT_KEYS = ['requestedShipDate', 'customerId', 'shipmentRequestNo'] as const;

export type SortKey = (typeof CONTRACT_SORT_KEYS)[number];

const isSortKey = (value: string): value is SortKey =>
  (CONTRACT_SORT_KEYS as readonly string[]).includes(value);

/**
 * 주소가 담은 정렬 열. **없으면 정렬하지 않는다.**
 *
 * 없는 것을 기본값으로 읽지 않는 이유: 그러면 「해제」한 상태를 주소로 나타낼 방법이 사라져
 * 정렬 사이클의 셋째 걸음이 죽는다.
 */
export const readSortKey = (raw: string | null): SortKey | null => {
  const value = raw ?? '';

  return isSortKey(value) ? value : null;
};

/**
 * 머리글을 눌렀을 때의 다음 정렬 열.
 *
 * 디자인 시스템 `Table`은 없음 → 오름차순 → 내림차순 → 없음으로 돌지만, **내림차순 상태로
 * 들어가지 않는다** — 계약이 방향을 받지 않아 표기와 실제가 어긋난다. 같은 열이 다시 오면
 * 방향이 무엇이든 해제한다.
 */
export const nextSortKey = (current: SortKey | null, next: SortState | null): SortKey | null => {
  if (next === null) return null;
  if (next.key === current) return null;

  return isSortKey(next.key) ? next.key : null;
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

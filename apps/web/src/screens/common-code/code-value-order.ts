import type { CodeValue } from './code-value-types';

/**
 * 코드값 목록의 표시 순서 — **화면이 정한다.**
 *
 * 계약이 목록의 정렬을 명시하지 않았다. 받은 순서를 그대로 그리면 순서가 서버 재량이 되어
 * 같은 조건으로 두 번 조회했을 때 다른 순서가 나올 수 있다.
 *
 * 이 정렬은 **받은 쪽 안에서만** 유효하다. 쪽이 둘 이상이면 그 사실을 목록 위에 안내한다 —
 * 안내하지 않으면 「전체가 이 순서다」로 읽힌다.
 */

/**
 * 정렬 순서 오름차순. 같으면 코드 오름차순으로 가른다.
 *
 * 동률을 가르지 않으면 같은 값을 가진 행들의 순서가 정렬 구현에 따라 흔들린다.
 * **받은 배열을 고치지 않는다** — 캐시에 든 배열을 제자리에서 정렬하면 다른 소비처가
 * 순서가 달라진 배열을 보게 된다.
 */
export const sortForDisplay = (items: CodeValue[]): CodeValue[] =>
  [...items].sort((a, b) =>
    a.displayOrder === b.displayOrder
      ? a.code.localeCompare(b.code)
      : a.displayOrder - b.displayOrder,
  );

/**
 * 정렬 순서 값이 겹치는 행이 있는지.
 *
 * **저장을 막는 근거가 아니다.** `display_order`에 유일 제약이 없어 서버가 허용하는 값이고,
 * 화면이 서버가 허용한 값을 막으면 안 된다. 겹치면 목록의 순서가 코드 순으로 갈린다는
 * 사실만 안내한다.
 */
export const hasDuplicateDisplayOrder = (items: CodeValue[]): boolean =>
  new Set(items.map((item) => item.displayOrder)).size !== items.length;

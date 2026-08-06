import { describe, expect, it } from 'vitest';

import {
  ORPHAN_GROUP_KEY,
  groupKeyOf,
  hasDeepHierarchy,
  indexById,
  orderForGrouping,
  parentOptionsFor,
} from './department-hierarchy';
import type { DepartmentRow } from './types';

const row = (
  departmentId: number,
  departmentCode: string,
  parentDepartmentId: number | null = null,
): DepartmentRow => ({
  departmentId,
  departmentCode,
  departmentName: `합성 부서 ${departmentCode.slice(-1)}`,
  parentDepartmentId,
  businessUnitId: null,
  isActive: true,
});

const ROOT_A = row(1001, 'SYN-DEPT-01');
const CHILD_A1 = row(1002, 'SYN-DEPT-02', 1001);
const CHILD_A2 = row(1003, 'SYN-DEPT-03', 1001);
const ROOT_B = row(1004, 'SYN-DEPT-04');
/** 상위가 이 쪽 목록에 없다 — 쪽 나눔 때문에 실제로 생긴다. */
const ORPHAN = row(1005, 'SYN-DEPT-05', 9999);
/** 상위가 뿌리가 아니다 — 3단 계층. */
const GRANDCHILD = row(1006, 'SYN-DEPT-06', 1002);

describe('groupKeyOf', () => {
  it('뿌리 부서는 자기 번호가 그룹 키다', () => {
    const byId = indexById([ROOT_A, CHILD_A1]);

    expect(groupKeyOf(ROOT_A, byId)).toBe('1001');
  });

  it('하위 부서는 상위 번호가 그룹 키다', () => {
    const byId = indexById([ROOT_A, CHILD_A1]);

    expect(groupKeyOf(CHILD_A1, byId)).toBe('1001');
  });

  /* 상위가 다른 쪽에 있을 수 있다 — 없다고 뿌리로 올리면 서버의 관계와 어긋난다. */
  it('상위를 목록에서 찾을 수 없으면 고아 그룹이다', () => {
    expect(groupKeyOf(ORPHAN, indexById([ORPHAN]))).toBe(ORPHAN_GROUP_KEY);
  });

  /* 빈 문자열을 쓰면 디자인 시스템 Table이 빈 머리글을 그대로 그린다. */
  it('고아 그룹 키가 빈 문자열이 아니다', () => {
    expect(ORPHAN_GROUP_KEY).not.toBe('');
  });

  /*
   * 표시를 위해 계층을 다시 계산하면 서버에 있는 관계와 화면이 어긋난다 —
   * 3단째 행도 자기 상위의 그룹에 그대로 둔다.
   */
  it('3단 이상 행도 자기 상위의 그룹에 그대로 남는다', () => {
    const byId = indexById([ROOT_A, CHILD_A1, GRANDCHILD]);

    expect(groupKeyOf(GRANDCHILD, byId)).toBe('1002');
  });
});

describe('orderForGrouping', () => {
  /* 디자인 시스템 Table의 그룹 순서는 rows에서 그 키가 처음 나온 순서다 — 화면이 미리 정렬한다. */
  it('그룹은 대표 부서코드 오름차순이고 그룹 안은 대표가 첫 행이다', () => {
    const rows = [CHILD_A2, ROOT_B, CHILD_A1, ROOT_A];
    const byId = indexById(rows);

    expect(orderForGrouping(rows, byId).map((item) => item.departmentCode)).toEqual([
      'SYN-DEPT-01',
      'SYN-DEPT-02',
      'SYN-DEPT-03',
      'SYN-DEPT-04',
    ]);
  });

  it('고아 그룹이 맨 뒤에 온다', () => {
    const rows = [ORPHAN, ROOT_A, CHILD_A1];
    const byId = indexById(rows);

    expect(orderForGrouping(rows, byId).map((item) => item.departmentId)).toEqual([
      1001, 1002, 1005,
    ]);
  });

  it('행이 없으면 빈 배열이다', () => {
    expect(orderForGrouping([], indexById([]))).toEqual([]);
  });
});

describe('hasDeepHierarchy', () => {
  /* 이슈 §6이 예고한 「2단 표시로는 부족한」 상태를 감추지 않는다. */
  it('상위가 뿌리가 아닌 행이 있으면 참이다', () => {
    const rows = [ROOT_A, CHILD_A1, GRANDCHILD];

    expect(hasDeepHierarchy(rows, indexById(rows))).toBe(true);
  });

  it('2단까지면 거짓이다', () => {
    const rows = [ROOT_A, CHILD_A1, CHILD_A2, ROOT_B];

    expect(hasDeepHierarchy(rows, indexById(rows))).toBe(false);
  });

  /* 상위를 찾을 수 없는 행은 깊이를 알 수 없다 — 3단이라고 단정하지 않는다(고아 안내가 따로 있다). */
  it('고아 행만으로는 참이 되지 않는다', () => {
    const rows = [ORPHAN];

    expect(hasDeepHierarchy(rows, indexById(rows))).toBe(false);
  });
});

describe('parentOptionsFor', () => {
  /* 계약: ck_department_parent가 자기 자신을 막는다 — 거부당할 값을 고르게 두지 않는다. */
  it('자기 자신은 상위 선택지에서 빠진다', () => {
    const rows = [ROOT_A, CHILD_A1, ROOT_B];

    expect(parentOptionsFor(rows, 1001).map((item) => item.departmentId)).toEqual([1002, 1004]);
  });

  /*
   * **순환은 화면이 막지 않는다.** 계약이 서버 소관으로 정했고,
   * 화면이 흉내 내면 서버와 다른 답을 낸다.
   */
  it('후손은 상위 선택지에 남는다', () => {
    const rows = [ROOT_A, CHILD_A1, GRANDCHILD];

    expect(parentOptionsFor(rows, 1001).map((item) => item.departmentId)).toEqual([1002, 1006]);
  });

  it('등록 중이면 뺄 자기 자신이 없다', () => {
    const rows = [ROOT_A, CHILD_A1];

    expect(parentOptionsFor(rows, null)).toHaveLength(2);
  });

  it('부서코드 오름차순이다', () => {
    const rows = [ROOT_B, CHILD_A1, ROOT_A];

    expect(parentOptionsFor(rows, null).map((item) => item.departmentCode)).toEqual([
      'SYN-DEPT-01',
      'SYN-DEPT-02',
      'SYN-DEPT-04',
    ]);
  });

  it('목록에 자기 하나뿐이면 고를 수 있는 상위가 없다', () => {
    expect(parentOptionsFor([ROOT_A], 1001)).toEqual([]);
  });
});

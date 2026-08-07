import { describe, expect, it } from 'vitest';

import {
  isSameRoleSelection,
  roleCatalogOrder,
  toRoleAssignDraft,
  toRoleChoices,
  toRolesPayload,
  toggleRoleId,
} from './role-assign-draft';
import type { LookupEntry, UserRole } from './types';

/** 목록 순서를 눈으로 확인할 수 있게 번호와 순서를 일부러 어긋나게 둔다. */
const CATALOG: LookupEntry[] = [
  { value: '5002', label: 'SYN-ROLE-02 · 합성 역할 B', isActive: true },
  { value: '5001', label: 'SYN-ROLE-01 · 합성 역할 A', isActive: true },
  { value: '5003', label: 'SYN-ROLE-03 · 합성 역할 C', isActive: false },
];

const grant = (roleId: number, userRoleId: number): UserRole => ({
  userRoleId,
  appUserId: 1001,
  roleId,
});

describe('toRoleAssignDraft', () => {
  /** 초안은 역할 번호만 들고 다닌다 — 나머지는 서버로 되돌아 나가지 않는 값이다. */
  it('서버가 준 부여분에서 역할 번호만 뽑는다', () => {
    expect(toRoleAssignDraft([grant(5001, 7001), grant(5003, 7002)])).toEqual([5001, 5003]);
  });

  it('부여분이 없으면 빈 선택이다', () => {
    expect(toRoleAssignDraft([])).toEqual([]);
  });
});

describe('toggleRoleId', () => {
  it('고르지 않은 역할을 켠다', () => {
    expect(toggleRoleId([5001], 5002)).toEqual([5001, 5002]);
  });

  it('고른 역할을 끈다', () => {
    expect(toggleRoleId([5001, 5002], 5001)).toEqual([5002]);
  });

  /** 원본을 고치면 「고친 것이 있는가」의 기준값까지 함께 바뀐다. */
  it('원본 배열을 고치지 않는다', () => {
    const selected = [5001];

    toggleRoleId(selected, 5002);

    expect(selected).toEqual([5001]);
  });
});

describe('isSameRoleSelection', () => {
  /** 체크 순서는 자료가 아니다 — 순서로 판정하면 되돌려 놓아도 「고쳤다」로 남는다. */
  it('고른 순서가 달라도 같은 선택으로 본다', () => {
    expect(isSameRoleSelection([5001, 5002], [5002, 5001])).toBe(true);
  });

  it('하나라도 다르면 다른 선택이다', () => {
    expect(isSameRoleSelection([5001, 5002], [5001, 5003])).toBe(false);
  });

  it('건수가 다르면 다른 선택이다', () => {
    expect(isSameRoleSelection([5001], [5001, 5002])).toBe(false);
  });

  it('둘 다 비었으면 같은 선택이다', () => {
    expect(isSameRoleSelection([], [])).toBe(true);
  });
});

describe('roleCatalogOrder', () => {
  it('선택 목록이 준 순서 그대로 번호를 낸다', () => {
    expect(roleCatalogOrder(CATALOG)).toEqual([5002, 5001, 5003]);
  });
});

describe('toRoleChoices', () => {
  it('사용 중인 역할은 부여 여부와 상관없이 전부 나온다', () => {
    const choices = toRoleChoices(CATALOG, []);

    expect(choices.map((choice) => choice.roleId)).toEqual([5002, 5001]);
  });

  it('부여된 역할만 체크 상태다', () => {
    const choices = toRoleChoices(CATALOG, [5001]);

    expect(choices.find((choice) => choice.roleId === 5001)?.isSelected).toBe(true);
    expect(choices.find((choice) => choice.roleId === 5002)?.isSelected).toBe(false);
  });

  /** 빼 버리면 저장할 때 그 부여가 조용히 사라진다. */
  it('미사용 역할은 이미 부여돼 있을 때만 남고 표식이 붙으며 잠긴다', () => {
    const choices = toRoleChoices(CATALOG, [5003]);
    const inactive = choices.find((choice) => choice.roleId === 5003);

    expect(inactive?.isSelected).toBe(true);
    expect(inactive?.isLocked).toBe(true);
    expect(inactive?.label).toContain('(미사용)');
  });

  it('부여되지 않은 미사용 역할은 목록에서 빠진다', () => {
    expect(toRoleChoices(CATALOG, []).some((choice) => choice.roleId === 5003)).toBe(false);
  });

  /**
   * **화면이 「이 역할은 특별하다」를 판정하지 않는다**(계획 결정 4).
   * 잠기는 이유는 오직 하나 — 그 역할이 미사용이라는 사실뿐이다.
   */
  it('사용 중인 역할은 이미 부여돼 있어도 잠기지 않는다', () => {
    const choices = toRoleChoices(CATALOG, [5001, 5002]);

    expect(choices.every((choice) => !choice.isLocked)).toBe(true);
  });

  it('선택 목록이 비면 고를 것이 없다', () => {
    expect(toRoleChoices([], [5001])).toEqual([]);
  });
});

describe('toRolesPayload', () => {
  const ORDER = roleCatalogOrder(CATALOG);

  /** 계약이 전체 치환이다 — 바뀐 것만 실으면 나머지가 전부 회수된다. */
  it('최종 상태 전체를 싣는다 — 하나를 풀어도 나머지가 그대로 실린다', () => {
    expect(toRolesPayload([5002, 5003], ORDER).roleIds).toEqual([5002, 5003]);
  });

  /** 체크 순서로 실으면 같은 선택에서 매번 다른 본문이 나가 캐시도 테스트도 흔들린다. */
  it('순서는 고른 순서가 아니라 선택 목록의 순서다', () => {
    expect(toRolesPayload([5003, 5001, 5002], ORDER).roleIds).toEqual([5002, 5001, 5003]);
  });

  it('아무것도 고르지 않으면 빈 배열이다 — 전체 회수도 정상 조작이다', () => {
    expect(toRolesPayload([], ORDER).roleIds).toEqual([]);
  });

  /**
   * 선택 목록이 잘리면 부여된 역할이 목록에 없을 수 있다.
   * 목록에 있는 것만 실으면 **화면이 보여 준 적도 없는 부여가 저장할 때 조용히 회수된다.**
   */
  it('선택 목록에 없는 부여분도 뒤에 실린다', () => {
    expect(toRolesPayload([5001, 9999], ORDER).roleIds).toEqual([5001, 9999]);
  });

  it('같은 번호를 두 번 싣지 않는다', () => {
    expect(toRolesPayload([5001, 5001], ORDER).roleIds).toEqual([5001]);
  });
});

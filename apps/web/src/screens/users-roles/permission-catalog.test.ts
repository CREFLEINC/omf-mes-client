import { describe, expect, it } from 'vitest';

import { PLACEHOLDER_PERMISSION_CODES, toPermissionColumns } from './permission-catalog';
import type { RolePermission } from './types';

const granted = (roleId: number, codes: string[]): RolePermission[] =>
  codes.map((permissionCode, index) => ({
    rolePermissionId: 8000 + index,
    roleId,
    permissionCode,
  }));

describe('PLACEHOLDER_PERMISSION_CODES', () => {
  /**
   * 권한 목록이 확정되지 않았다. **어떤 코드값도 지어내지 않는다** —
   * 지어낸 열은 「이 역할에 그 권한이 없다」는 거짓을 화면에 낸다(이슈 #17 §4).
   */
  it('비어 있다 — 확정되기 전에는 자리표시 열이 하나도 없다', () => {
    expect(PLACEHOLDER_PERMISSION_CODES).toEqual([]);
  });
});

describe('toPermissionColumns', () => {
  it('부여분이 없으면 열이 없다 — 열 없는 격자를 그리지 않도록 화면이 이 값을 본다', () => {
    expect(toPermissionColumns([])).toEqual([]);
  });

  it('서버가 준 코드가 열이 되고 전부 부여된 것으로 표시된다', () => {
    const columns = toPermissionColumns(granted(5001, ['SYN-PERM-01', 'SYN-PERM-02']));

    expect(columns.map((column) => column.code)).toEqual(['SYN-PERM-01', 'SYN-PERM-02']);
    expect(columns.every((column) => column.isGranted)).toBe(true);
  });

  it('받은 순서를 지킨다 — 순서가 흔들리면 같은 자료가 매번 다르게 보인다', () => {
    const columns = toPermissionColumns(granted(5001, ['SYN-PERM-02', 'SYN-PERM-01']));

    expect(columns.map((column) => column.code)).toEqual(['SYN-PERM-02', 'SYN-PERM-01']);
  });

  it('같은 코드가 두 번 와도 열은 하나다', () => {
    const columns = toPermissionColumns(granted(5001, ['SYN-PERM-01', 'SYN-PERM-01']));

    expect(columns).toHaveLength(1);
  });

  /**
   * 자리표시가 채워지는 날의 동작이다. 상수를 비운 채로는 「부여되지 않은 열」을 만들 수 없어
   * 인자로 갈아 끼워 확인한다 — 확정되면 상수만 채우면 이 동작이 그대로 산다.
   */
  it('자리표시가 채워지면 부여되지 않은 열도 함께 선다', () => {
    const columns = toPermissionColumns(granted(5001, ['SYN-PERM-02']), [
      'SYN-PERM-01',
      'SYN-PERM-02',
    ]);

    expect(columns).toEqual([
      { code: 'SYN-PERM-01', isGranted: false },
      { code: 'SYN-PERM-02', isGranted: true },
    ]);
  });

  /** 자리표시에 없는 부여분을 빼면 사용자가 가진 권한이 화면에서 사라진다. */
  it('자리표시에 없는 부여분은 뒤에 덧붙는다', () => {
    const columns = toPermissionColumns(granted(5001, ['SYN-PERM-09']), ['SYN-PERM-01']);

    expect(columns).toEqual([
      { code: 'SYN-PERM-01', isGranted: false },
      { code: 'SYN-PERM-09', isGranted: true },
    ]);
  });

  it('기본 자리표시는 상수다 — 화면이 따로 값을 넘기지 않는다', () => {
    expect(toPermissionColumns(granted(5001, ['SYN-PERM-01']))).toEqual(
      toPermissionColumns(granted(5001, ['SYN-PERM-01']), PLACEHOLDER_PERMISSION_CODES),
    );
  });
});

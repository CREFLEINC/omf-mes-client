import { describe, expect, it } from 'vitest';

import type { PermissionColumn } from './permission-catalog';
import {
  isSamePermissionSelection,
  permissionCatalogOrder,
  toPermissionDraft,
  toPermissionsPayload,
  togglePermissionCode,
} from './permission-draft';
import type { RolePermission } from './types';

const granted = (permissionCode: string, rolePermissionId: number): RolePermission => ({
  rolePermissionId,
  roleId: 5001,
  permissionCode,
});

const column = (code: string): PermissionColumn => ({
  code,
  label: code,
  isGranted: false,
  isUnlisted: false,
});

describe('toPermissionDraft', () => {
  it('부여분에서 코드만 꺼낸다 — 본문에 실리는 것이 그것뿐이다', () => {
    expect(toPermissionDraft([granted('W-01-01', 8001), granted('W-06-07', 8002)])).toEqual([
      'W-01-01',
      'W-06-07',
    ]);
  });

  it('부여가 없으면 빈 초안이다', () => {
    expect(toPermissionDraft([])).toEqual([]);
  });
});

describe('togglePermissionCode', () => {
  it('없으면 켜고 있으면 끈다', () => {
    expect(togglePermissionCode(['W-01-01'], 'W-06-07')).toEqual(['W-01-01', 'W-06-07']);
    expect(togglePermissionCode(['W-01-01', 'W-06-07'], 'W-01-01')).toEqual(['W-06-07']);
  });

  /** ⛔ 원본을 고치면 기준값(`baseline`)이 함께 흔들려 「고친 것이 있는가」가 거짓이 된다. */
  it('원본을 고치지 않는다', () => {
    const before = ['W-01-01'];

    togglePermissionCode(before, 'W-06-07');

    expect(before).toEqual(['W-01-01']);
  });
});

describe('isSamePermissionSelection', () => {
  /**
   * ⭐ **이 함수가 있는 유일한 이유다.** 순서로 판정하면 켰다가 되돌려 놓아도 「고쳤다」로 남아
   * 저장·취소가 사실과 어긋난다.
   */
  it('순서가 달라도 같은 선택이면 같다고 본다', () => {
    expect(isSamePermissionSelection(['W-01-01', 'W-06-07'], ['W-06-07', 'W-01-01'])).toBe(true);
  });

  it('켰다가 되돌리면 고치기 전과 같아진다', () => {
    const baseline = ['W-01-01'];
    const toggledOn = togglePermissionCode(baseline, 'W-06-07');

    expect(isSamePermissionSelection(toggledOn, baseline)).toBe(false);

    expect(isSamePermissionSelection(togglePermissionCode(toggledOn, 'W-06-07'), baseline)).toBe(
      true,
    );
  });

  it('개수가 다르면 다르다', () => {
    expect(isSamePermissionSelection(['W-01-01'], ['W-01-01', 'W-06-07'])).toBe(false);
  });

  it('둘 다 비면 같다', () => {
    expect(isSamePermissionSelection([], [])).toBe(true);
  });
});

describe('permissionCatalogOrder', () => {
  it('격자가 그린 차례를 코드 목록으로 준다', () => {
    expect(permissionCatalogOrder([column('W-01-01'), column('W-06-07')])).toEqual([
      'W-01-01',
      'W-06-07',
    ]);
  });
});

describe('toPermissionsPayload', () => {
  /** **최종 상태 전체를 싣는다** — 바뀐 것만 실으면 나머지가 통째로 회수된다. */
  it('고른 것 전부를 싣는다', () => {
    expect(toPermissionsPayload(['W-01-01', 'W-06-07'], ['W-01-01', 'W-03-01', 'W-06-07'])).toEqual(
      { permissionCodes: ['W-01-01', 'W-06-07'] },
    );
  });

  it('고른 것이 없으면 빈 목록을 싣는다 — 전체 회수도 명시적으로 보낸다', () => {
    expect(toPermissionsPayload([], ['W-01-01'])).toEqual({ permissionCodes: [] });
  });

  /**
   * ⭐ **차례는 격자가 그린 차례다.** 사용자가 체크한 차례로 실으면 같은 선택에서 매번 다른
   * 본문이 나가 캐시도 시험도 흔들린다.
   */
  it('고른 차례가 아니라 격자 차례로 싣는다', () => {
    expect(toPermissionsPayload(['W-06-07', 'W-01-01'], ['W-01-01', 'W-06-07'])).toEqual({
      permissionCodes: ['W-01-01', 'W-06-07'],
    });
  });

  /**
   * ⛔ **이 갈래가 이 모듈이 있는 까닭이다.** 격자에 없는 부여분을 빼면 **보여 준 적도 없는
   * 부여가 저장할 때 조용히 사라진다.** 서버가 후보 밖 코드를 400 으로 거부하더라도, 조용한
   * 회수보다 눈에 보이는 거부가 낫다.
   */
  it('격자에 없는 선택도 맨 뒤에 싣는다', () => {
    expect(toPermissionsPayload(['W-01-01', 'W-99-99'], ['W-01-01'])).toEqual({
      permissionCodes: ['W-01-01', 'W-99-99'],
    });
  });

  it('격자가 통째로 비어도 고른 것을 전부 싣는다', () => {
    expect(toPermissionsPayload(['W-99-98', 'W-99-99'], [])).toEqual({
      permissionCodes: ['W-99-98', 'W-99-99'],
    });
  });

  /** 같은 코드가 양쪽에 있어도 본문에는 한 번만 실린다 — 서버가 접기 전에 화면이 접는다. */
  it('중복은 한 번만 싣는다', () => {
    expect(toPermissionsPayload(['W-01-01', 'W-01-01'], ['W-01-01', 'W-01-01', 'W-06-07'])).toEqual(
      { permissionCodes: ['W-01-01'] },
    );
  });

  it('격자 차례에 같은 코드가 두 번 와도 한 번만 싣는다', () => {
    expect(toPermissionsPayload(['W-01-01'], ['W-01-01', 'W-01-01'])).toEqual({
      permissionCodes: ['W-01-01'],
    });
  });
});

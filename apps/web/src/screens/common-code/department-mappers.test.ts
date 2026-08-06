import { describe, expect, it } from 'vitest';

import {
  departmentToFormValues,
  emptyDepartmentFormValues,
  isSameDepartmentValues,
  toDepartmentCreate,
  toDepartmentRows,
  toDepartmentUpdate,
} from './department-mappers';
import type { Department } from './types';

const department = (overrides: Partial<Department> = {}): Department => ({
  departmentId: 1001,
  departmentCode: 'SYN-DEPT-01',
  departmentName: '합성 부서 A',
  parentDepartmentId: null,
  businessUnitId: 1001,
  isActive: true,
  ...overrides,
});

describe('toDepartmentRows', () => {
  /*
   * **목 서버가 실제로 자기참조 행을 준다**(departmentId 1001 · parentDepartmentId 1001).
   * 접지 않으면 「하위가 있는데 그 하위가 자기 자신인」 그룹이 생긴다.
   */
  it('자기 자신을 상위로 가리키는 행을 뿌리로 접는다', () => {
    const [row] = toDepartmentRows([department({ parentDepartmentId: 1001 })]);

    expect(row?.parentDepartmentId).toBeNull();
  });

  it('없음·널을 뿌리로 모은다', () => {
    expect(
      toDepartmentRows([department({ parentDepartmentId: null })])[0]?.parentDepartmentId,
    ).toBe(null);
    expect(
      toDepartmentRows([department({ parentDepartmentId: undefined })])[0]?.parentDepartmentId,
    ).toBe(null);
  });

  it('남의 번호를 가리키는 상위는 그대로 둔다', () => {
    expect(
      toDepartmentRows([department({ departmentId: 1002, parentDepartmentId: 1001 })])[0]
        ?.parentDepartmentId,
    ).toBe(1001);
  });

  it('나머지 값을 그대로 옮긴다', () => {
    expect(toDepartmentRows([department()])[0]).toEqual({
      departmentId: 1001,
      departmentCode: 'SYN-DEPT-01',
      departmentName: '합성 부서 A',
      parentDepartmentId: null,
      businessUnitId: 1001,
      isActive: true,
    });
  });
});

describe('departmentToFormValues', () => {
  it('널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나여야 한다', () => {
    expect(
      departmentToFormValues(department({ parentDepartmentId: null, businessUnitId: null })),
    ).toEqual({
      departmentCode: 'SYN-DEPT-01',
      departmentName: '합성 부서 A',
      parentDepartmentId: '',
      businessUnitId: '',
    });
  });

  /* 접기는 매퍼 한 곳에서만 한다 — 폼도 같은 판정을 쓴다. */
  it('자기참조 상위는 폼에서도 비어 있다', () => {
    expect(
      departmentToFormValues(department({ parentDepartmentId: 1001 })).parentDepartmentId,
    ).toBe('');
  });

  it('상위·사업부가 있으면 문자열로 담는다', () => {
    expect(
      departmentToFormValues(
        department({ departmentId: 1002, parentDepartmentId: 1001, businessUnitId: 2002 }),
      ),
    ).toMatchObject({ parentDepartmentId: '1001', businessUnitId: '2002' });
  });
});

describe('toDepartmentUpdate', () => {
  it('앞뒤 공백을 턴다 — 눈으로 구분되지 않는 다른 값이 된다', () => {
    expect(
      toDepartmentUpdate({
        departmentCode: ' SYN-DEPT-01 ',
        departmentName: ' 합성 부서 A ',
        parentDepartmentId: '',
        businessUnitId: '',
      }),
    ).toMatchObject({ departmentCode: 'SYN-DEPT-01', departmentName: '합성 부서 A' });
  });

  /*
   * 키를 빼면 서버가 이전 값을 남길 수 있어 하위 부서를 뿌리로 되돌릴 방법이 사라진다 —
   * 수정에서는 「없음」을 널로 명시한다.
   */
  it('상위·사업부가 비어도 키를 빼지 않고 널을 명시한다', () => {
    const body = toDepartmentUpdate({
      departmentCode: 'SYN-DEPT-01',
      departmentName: '합성 부서 A',
      parentDepartmentId: '',
      businessUnitId: '',
    });

    expect('parentDepartmentId' in body).toBe(true);
    expect(body.parentDepartmentId).toBeNull();
    expect('businessUnitId' in body).toBe(true);
    expect(body.businessUnitId).toBeNull();
  });

  it('고른 값은 숫자로 옮긴다', () => {
    expect(
      toDepartmentUpdate({
        departmentCode: 'SYN-DEPT-02',
        departmentName: '합성 부서 B',
        parentDepartmentId: '1001',
        businessUnitId: '2002',
      }),
    ).toMatchObject({ parentDepartmentId: 1001, businessUnitId: 2002 });
  });

  /* 사용 여부는 `:deactivate`로만 바뀌고 번호는 경로에 있다 — 실어 보내면 계약 위반이다. */
  it('사용 여부와 번호를 싣지 않는다', () => {
    const body: Record<string, unknown> = toDepartmentUpdate({
      departmentCode: 'SYN-DEPT-01',
      departmentName: '합성 부서 A',
      parentDepartmentId: '',
      businessUnitId: '',
    });

    expect('isActive' in body).toBe(false);
    expect('departmentId' in body).toBe(false);
  });
});

describe('toDepartmentCreate', () => {
  /* 새로 만드는 행이라 「없음」이 곧 뿌리다 — 지울 이전 값이 없다. */
  it('상위·사업부가 비면 키 자체를 싣지 않는다', () => {
    const body: Record<string, unknown> = toDepartmentCreate({
      departmentCode: 'SYN-DEPT-09',
      departmentName: '합성 부서 I',
      parentDepartmentId: '',
      businessUnitId: '',
    });

    expect('parentDepartmentId' in body).toBe(false);
    expect('businessUnitId' in body).toBe(false);
  });

  it('고른 값은 숫자로 싣는다', () => {
    expect(
      toDepartmentCreate({
        departmentCode: 'SYN-DEPT-09',
        departmentName: '합성 부서 I',
        parentDepartmentId: '1001',
        businessUnitId: '2002',
      }),
    ).toEqual({
      departmentCode: 'SYN-DEPT-09',
      departmentName: '합성 부서 I',
      parentDepartmentId: 1001,
      businessUnitId: 2002,
    });
  });
});

describe('emptyDepartmentFormValues · isSameDepartmentValues', () => {
  it('빈 폼은 네 칸이 모두 빈 문자열이다', () => {
    expect(emptyDepartmentFormValues()).toEqual({
      departmentCode: '',
      departmentName: '',
      parentDepartmentId: '',
      businessUnitId: '',
    });
  });

  it('한 칸이라도 다르면 고친 것으로 본다', () => {
    const base = emptyDepartmentFormValues();

    expect(isSameDepartmentValues(base, { ...base })).toBe(true);
    expect(isSameDepartmentValues(base, { ...base, parentDepartmentId: '1001' })).toBe(false);
    expect(isSameDepartmentValues(base, { ...base, businessUnitId: '1001' })).toBe(false);
  });
});

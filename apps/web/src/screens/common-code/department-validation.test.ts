import { describe, expect, it } from 'vitest';

import { DEPARTMENT_FORM_FIELDS, validateDepartmentForm } from './department-validation';
import type { DepartmentFormValues } from './types';

const values = (overrides: Partial<DepartmentFormValues> = {}): DepartmentFormValues => ({
  departmentCode: 'SYN-DEPT-01',
  departmentName: '합성 부서 A',
  parentDepartmentId: '',
  businessUnitId: '',
  ...overrides,
});

describe('validateDepartmentForm', () => {
  it('채워진 폼은 오류가 없다', () => {
    expect(validateDepartmentForm(values())).toEqual({});
  });

  it('필수 칸이 비면 막는다', () => {
    expect(validateDepartmentForm(values({ departmentCode: '' })).departmentCode).toBe(
      '필수 입력 항목입니다.',
    );
    expect(validateDepartmentForm(values({ departmentName: '' })).departmentName).toBe(
      '필수 입력 항목입니다.',
    );
  });

  /* 공백만 넣으면 저장된 값이 빈 값이 된다 — 비운 것과 같은 결과이므로 같이 막는다. */
  it('공백만 넣어도 막고 비운 것과 다른 문구를 낸다', () => {
    const errors = validateDepartmentForm(values({ departmentCode: '   ', departmentName: ' ' }));

    expect(errors.departmentCode).toBe('부서코드는 공백만으로 지정할 수 없습니다.');
    expect(errors.departmentName).toBe('부서명은 공백만으로 지정할 수 없습니다.');
  });

  /* 상한 자체는 허용값이며 그것을 넘을 때만 막는다. */
  it('길이 상한을 넘으면 막고 상한 자체는 통과시킨다', () => {
    expect(validateDepartmentForm(values({ departmentCode: 'A'.repeat(50) })).departmentCode).toBe(
      undefined,
    );
    expect(validateDepartmentForm(values({ departmentCode: 'A'.repeat(51) })).departmentCode).toBe(
      '부서코드는 50자를 넘을 수 없습니다.',
    );
    expect(
      validateDepartmentForm(values({ departmentName: '가'.repeat(200) })).departmentName,
    ).toBe(undefined);
    expect(
      validateDepartmentForm(values({ departmentName: '가'.repeat(201) })).departmentName,
    ).toBe('부서명은 200자를 넘을 수 없습니다.');
  });

  /* 길이는 앞뒤 공백을 턴 값으로 센다 — 저장되는 값이 그 값이다. */
  it('길이를 앞뒤 공백을 턴 값으로 센다', () => {
    expect(
      validateDepartmentForm(values({ departmentCode: `  ${'A'.repeat(50)}  ` })).departmentCode,
    ).toBe(undefined);
  });

  /*
   * **순환을 화면이 막지 않는다** — 계약이 그 검사를 서버 소관으로 정했다.
   * 자기 자신은 애초에 선택지에 없으므로 여기서 다시 막지 않는다.
   */
  it('상위 부서와 사업부를 비워도 막지 않는다 — 계약이 널을 허용한다', () => {
    expect(validateDepartmentForm(values({ parentDepartmentId: '', businessUnitId: '' }))).toEqual(
      {},
    );
  });

  it('상위 부서가 지정돼 있어도 막지 않는다', () => {
    expect(validateDepartmentForm(values({ parentDepartmentId: '3001' }))).toEqual({});
  });
});

describe('DEPARTMENT_FORM_FIELDS', () => {
  /* 목록에 없는 필드명의 서버 오류는 삼키지 않고 배너로 올라간다. */
  it('이 폼이 소유한 입력칸 이름을 계약 이름 그대로 갖는다', () => {
    expect([...DEPARTMENT_FORM_FIELDS]).toEqual([
      'departmentCode',
      'departmentName',
      'parentDepartmentId',
      'businessUnitId',
    ]);
  });
});

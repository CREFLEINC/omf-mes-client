import type { components } from '@omf-mes/api-client';

import type { Department, DepartmentFormValues, DepartmentRow } from './types';

type DepartmentCreate = components['schemas']['DepartmentCreate'];
type DepartmentUpdate = components['schemas']['DepartmentUpdate'];

/**
 * 계약 표현과 화면 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이고,
 * 계약은 선택 필드를 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 */

/**
 * 자기 자신을 상위로 가리키는 행을 뿌리로 접는다. **접기는 이 함수 한 곳에서만 한다.**
 *
 * 계약이 자기참조를 데이터베이스 제약으로 막는다고 적었으나 **목 서버는 실제로 그런 행을 준다**
 * (`departmentId` 1001에 `parentDepartmentId` 1001). 접지 않으면 「하위가 있는데 그 하위가
 * 자기 자신인」 그룹이 생겨 계층 표시가 무너진다.
 */
const foldSelfReference = (
  departmentId: number,
  parentDepartmentId: number | null | undefined,
): number | null =>
  parentDepartmentId === null ||
  parentDepartmentId === undefined ||
  parentDepartmentId === departmentId
    ? null
    : parentDepartmentId;

export const toDepartmentRows = (departments: readonly Department[]): DepartmentRow[] =>
  departments.map((department) => ({
    departmentId: department.departmentId,
    departmentCode: department.departmentCode,
    departmentName: department.departmentName,
    parentDepartmentId: foldSelfReference(department.departmentId, department.parentDepartmentId),
    businessUnitId: department.businessUnitId ?? null,
    isActive: department.isActive,
  }));

/** 널·없음을 빈 문자열로 모은다 — 선택칸의 「지정하지 않음」이 하나의 값이어야 한다. */
const optionalNumberToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

export const departmentToFormValues = (department: Department): DepartmentFormValues => ({
  departmentCode: department.departmentCode,
  departmentName: department.departmentName,
  // 폼도 같은 접기를 쓴다 — 자기 자신이 상위 칸에 보이면 사용자가 그것을 자료로 읽는다.
  parentDepartmentId: optionalNumberToText(
    foldSelfReference(department.departmentId, department.parentDepartmentId),
  ),
  businessUnitId: optionalNumberToText(department.businessUnitId),
});

export const emptyDepartmentFormValues = (): DepartmentFormValues => ({
  departmentCode: '',
  departmentName: '',
  parentDepartmentId: '',
  businessUnitId: '',
});

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. */
const textToOptionalNumber = (value: string): number | null =>
  value === '' ? null : Number(value);

/**
 * 부서 수정 요청 본문.
 *
 * **사용 여부(`isActive`)와 번호(`departmentId`)를 싣지 않는다** —
 * 사용 여부는 `:deactivate`로만 바뀌고 번호는 경로에 있다.
 *
 * **상위 부서와 사업부는 비어도 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을
 * 남길 수 있어 **하위 부서를 뿌리로 되돌릴 방법이 사라진다.**
 */
export const toDepartmentUpdate = (values: DepartmentFormValues): DepartmentUpdate => ({
  // 앞뒤 공백이 붙은 코드·이름은 눈으로 구분되지 않는 다른 값이 된다.
  departmentCode: values.departmentCode.trim(),
  departmentName: values.departmentName.trim(),
  parentDepartmentId: textToOptionalNumber(values.parentDepartmentId),
  businessUnitId: textToOptionalNumber(values.businessUnitId),
});

/**
 * 부서 등록 요청 본문.
 *
 * **비어 있으면 키 자체를 싣지 않는다** — 새로 만드는 행이라 「없음」이 곧 뿌리이고,
 * 지울 이전 값이 없다. 수정과 규칙이 다른 유일한 자리다.
 */
export const toDepartmentCreate = (values: DepartmentFormValues): DepartmentCreate => ({
  departmentCode: values.departmentCode.trim(),
  departmentName: values.departmentName.trim(),
  ...(values.parentDepartmentId === ''
    ? {}
    : { parentDepartmentId: Number(values.parentDepartmentId) }),
  ...(values.businessUnitId === '' ? {} : { businessUnitId: Number(values.businessUnitId) }),
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameDepartmentValues = (a: DepartmentFormValues, b: DepartmentFormValues): boolean =>
  a.departmentCode === b.departmentCode &&
  a.departmentName === b.departmentName &&
  a.parentDepartmentId === b.parentDepartmentId &&
  a.businessUnitId === b.businessUnitId;

import { messages } from '@omf-mes/i18n';

import type { DepartmentFormValues } from './types';

const t = messages.commonCode.department.validation;

/** 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다. */
const DEPARTMENT_CODE_MAX = 50;
const DEPARTMENT_NAME_MAX = 200;

/**
 * 부서 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 *
 * 계약이 쓰는 이름 그대로 둔다 — 폼 값과 계약 필드가 1:1이라 옮길 자리가 없다.
 */
export const DEPARTMENT_FORM_FIELDS: readonly string[] = [
  'departmentCode',
  'departmentName',
  'parentDepartmentId',
  'businessUnitId',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **코드 중복은 검사하지 않는다** — 계약이 그 판정을 서버 몫으로 두었고(전역 유일 제약),
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * **순환 참조(A→B→A)도 검사하지 않는다** — 계약이 「서버가 검사한다」로 명시했다.
 * 자기 자신은 애초에 상위 선택지에 없으므로 여기서 다시 막을 것이 없다.
 *
 * 길이는 **앞뒤 공백을 턴 값**으로 센다. 저장되는 값이 그 값이기 때문이다.
 */
export const validateDepartmentForm = (values: DepartmentFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.departmentCode === '') {
    errors.departmentCode = t.required;
  } else if (values.departmentCode.trim() === '') {
    errors.departmentCode = t.departmentCodeBlank;
  } else if (values.departmentCode.trim().length > DEPARTMENT_CODE_MAX) {
    errors.departmentCode = t.departmentCodeTooLong;
  }

  if (values.departmentName === '') {
    errors.departmentName = t.required;
  } else if (values.departmentName.trim() === '') {
    errors.departmentName = t.departmentNameBlank;
  } else if (values.departmentName.trim().length > DEPARTMENT_NAME_MAX) {
    errors.departmentName = t.departmentNameTooLong;
  }

  return errors;
};

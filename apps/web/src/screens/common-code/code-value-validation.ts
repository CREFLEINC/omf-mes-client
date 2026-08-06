import { messages } from '@omf-mes/i18n';

import type { CodeValueFormValues } from './code-value-types';

const t = messages.commonCode.codeValue.validation;

/** 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다. */
const CODE_MAX = 50;
const CODE_NAME_MAX = 200;

/** 부호 있는 정수. 계약에 하한이 없어 음수도 허용값이다. */
const INTEGER = /^-?\d+$/;

/**
 * 코드값 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const CODE_VALUE_FORM_FIELDS: readonly string[] = [
  'code',
  'codeName',
  'displayOrder',
  'effectiveFrom',
  'effectiveTo',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **그룹 안의 코드 중복은 검사하지 않는다** — 계약이 그 판정을 서버 몫으로 두었고,
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * **정렬 순서의 음수·0을 막지 않는다** — 계약에 하한이 없다. 화면이 서버가 허용한 값을 막으면 안 된다.
 *
 * **유효기간이 한쪽만 있는 것을 막지 않는다** — 계약은 둘 다 있을 때의 대소만 정했다.
 */
export const validateCodeValueForm = (values: CodeValueFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.code === '') {
    errors.code = t.required;
  } else if (values.code.trim() === '') {
    errors.code = t.codeBlank;
  } else if (values.code.trim().length > CODE_MAX) {
    errors.code = t.codeTooLong;
  }

  if (values.codeName === '') {
    errors.codeName = t.required;
  } else if (values.codeName.trim() === '') {
    errors.codeName = t.codeNameBlank;
  } else if (values.codeName.trim().length > CODE_NAME_MAX) {
    errors.codeName = t.codeNameTooLong;
  }

  if (values.displayOrder === '') {
    errors.displayOrder = t.required;
  } else if (!INTEGER.test(values.displayOrder.trim())) {
    errors.displayOrder = t.displayOrderInvalid;
  }

  /*
   * 계약 ck_code_value_dates — 있으면 유효 시작 이상.
   * **두 칸 모두에 오류를 붙인다.** 어느 쪽을 고쳐도 풀리는 짝 제약이라
   * 한쪽에만 붙이면 반대쪽을 고친 사용자가 오류가 남은 이유를 알 수 없다.
   */
  if (
    values.effectiveFrom !== '' &&
    values.effectiveTo !== '' &&
    values.effectiveTo < values.effectiveFrom
  ) {
    errors.effectiveFrom = t.effectiveRangeReversed;
    errors.effectiveTo = t.effectiveRangeReversed;
  }

  return errors;
};

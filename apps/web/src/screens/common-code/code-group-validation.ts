import { messages } from '@omf-mes/i18n';

import type { CodeGroupFormValues } from './types';

const t = messages.commonCode.codeGroup.validation;

/** 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다. */
const GROUP_CODE_MAX = 50;
const GROUP_NAME_MAX = 200;

/**
 * 코드그룹 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 *
 * 계약이 쓰는 이름 그대로 둔다 — 폼 값과 계약 필드가 1:1이라 옮길 자리가 없다.
 */
export const CODE_GROUP_FORM_FIELDS: readonly string[] = ['groupCode', 'groupName', 'description'];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **코드 중복은 검사하지 않는다** — 계약이 그 판정을 서버 몫으로 두었고(전역 유일 제약),
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * **설명을 필수로 두지 않는다** — 계약이 널을 허용한다.
 *
 * 길이는 **앞뒤 공백을 턴 값**으로 센다. 저장되는 값이 그 값이기 때문이다.
 */
export const validateCodeGroupForm = (values: CodeGroupFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.groupCode === '') {
    errors.groupCode = t.required;
  } else if (values.groupCode.trim() === '') {
    errors.groupCode = t.groupCodeBlank;
  } else if (values.groupCode.trim().length > GROUP_CODE_MAX) {
    errors.groupCode = t.groupCodeTooLong;
  }

  if (values.groupName === '') {
    errors.groupName = t.required;
  } else if (values.groupName.trim() === '') {
    errors.groupName = t.groupNameBlank;
  } else if (values.groupName.trim().length > GROUP_NAME_MAX) {
    errors.groupName = t.groupNameTooLong;
  }

  return errors;
};

import { messages } from '@omf-mes/i18n';

import type { PlanFormValues } from './types';

const t = messages.inspectionStandard.validation;

/**
 * 기준 헤더 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const PLAN_FORM_FIELDS: readonly string[] = [
  'inspectionPlanCode',
  'inspectionPlanName',
  'inspectionTypeCode',
  'itemId',
  'processId',
  'routingId',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **코드 중복은 검사하지 않는다** — 계약이 그 판정을 서버 몫으로 두었고(전역 유일 제약),
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * **품목·공정·라우팅을 필수로 두지 않는다** — 계약이 셋 다 널을 허용한다.
 * 품목을 비운 것은 「전 품목 공통 기준」이고 IQC 에는 공정이 없다.
 */
export const validatePlanForm = (values: PlanFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.inspectionPlanCode === '') {
    errors.inspectionPlanCode = t.required;
  } else if (values.inspectionPlanCode.trim() === '') {
    errors.inspectionPlanCode = t.planCodeBlank;
  }

  if (values.inspectionPlanName === '') {
    errors.inspectionPlanName = t.required;
  } else if (values.inspectionPlanName.trim() === '') {
    errors.inspectionPlanName = t.planNameBlank;
  }

  if (values.inspectionTypeCode === '') {
    errors.inspectionTypeCode = t.required;
  }

  return errors;
};

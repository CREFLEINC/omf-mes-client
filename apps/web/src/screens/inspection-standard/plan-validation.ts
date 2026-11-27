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
  'routingId',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **코드 중복은 검사하지 않는다** — 계약이 그 판정을 서버 몫으로 두었고(전역 유일 제약),
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * **품목은 필수다** — 「전 품목 공통 기준」은 없앴다(omf-all-around#366 · 서버도 400 REQUIRED 로 막는다).
 * 라우팅은 필수로 두지 않는다 — 품목에 딸려 자동으로 채운다. IQC 에는 공정이 없다.
 * 공정은 PQC 기준에서만 필수다(사용자 결정 2026-11-04 · 서버도 400 으로 막는다).
 */
export const validatePlanForm = (
  values: PlanFormValues,
  /** 등록 · 복사는 기준코드를 비우면 서버가 자동 등록한다(omf-all-around#262). */
  codeOptional = false,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (codeOptional) {
    // 비우거나 공백만이면 자동 등록 — 막지 않는다.
  } else if (values.inspectionPlanCode === '') {
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

  if (values.itemId === '') {
    errors.itemId = t.required;
  }

  return errors;
};

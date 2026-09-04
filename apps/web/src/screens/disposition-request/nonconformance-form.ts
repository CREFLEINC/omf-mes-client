import { messages } from '@omf-mes/i18n';

import { DESCRIPTION_SHORT_THRESHOLD } from './codes';
import type { NonconformanceCreate, TargetRow } from './types';

/**
 * ① 부적합 등록 — 심각도·내용은 필수, 담당 부서는 선택. 원천은 없다(스펙 §5-1-1).
 *
 * 값이 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이고, 계약 표현으로는
 * `toNonconformanceCreateBody`가 한 곳에서 넘는다.
 */
export interface NonconformanceFormValue {
  severityCode: string;
  description: string;
  /** 선택칸 값이라 문자열. 비우면 싣지 않는다 */
  departmentId: string;
}

export const EMPTY_NONCONFORMANCE_FORM: NonconformanceFormValue = {
  severityCode: '',
  description: '',
  departmentId: '',
};

export interface NonconformanceFormErrors {
  severityCode?: string;
  description?: string;
}

export const validateNonconformanceForm = (
  value: NonconformanceFormValue,
): NonconformanceFormErrors => {
  const t = messages.dispositionRequest.register;
  const errors: NonconformanceFormErrors = {};

  if (value.severityCode.trim() === '') errors.severityCode = t.severityRequired;
  /* NOT NULL — 「무엇이 잘못됐는지」가 없으면 판정자가 판단할 수 없다(스펙 §5-3). */
  if (value.description.trim() === '') errors.description = t.descriptionRequired;

  return errors;
};

export const hasBlockingError = (errors: NonconformanceFormErrors): boolean =>
  errors.severityCode !== undefined || errors.description !== undefined;

/**
 * A-12 — 짧은 내용은 **막지 않고 경고한다.** 「불량」 두 글자만 적히면 판정자가 판단할 수 없지만,
 * 길이로 뜻을 판정할 수는 없으므로 저장은 열어 두고 형식만 유도한다.
 */
export const descriptionWarning = (value: NonconformanceFormValue): string | undefined => {
  const trimmed = value.description.trim();
  return trimmed !== '' && trimmed.length < DESCRIPTION_SHORT_THRESHOLD
    ? messages.dispositionRequest.register.descriptionShort
    : undefined;
};

export const hasNonconformanceInput = (value: NonconformanceFormValue): boolean =>
  value.severityCode !== '' || value.description.trim() !== '' || value.departmentId !== '';

/**
 * 등록 본문. **대상 LOT 전량을 부적합 대상으로 싣는다** — 이 화면은 LOT 하나 단위로 등록하고
 * (§8-6 판정 ①), 수량은 판정 의뢰(②)에서 정한다.
 *
 * ⛔ 원천(`sourceCode`)을 싣지 않는다 — 계약이 요청에 그 칸을 두지 않았고 서버가 입고 유형으로
 * 파생한다. OQC 갈래는 검사 결과를 함께 가리켜 준다(계약 `inspectionResultId`).
 *
 * 검증을 통과하지 못하거나 LOT을 특정할 수 없으면 본문을 만들지 않는다 — 그 자체가 마지막 문이다.
 */
export const toNonconformanceCreateBody = (
  value: NonconformanceFormValue,
  row: TargetRow,
): NonconformanceCreate | undefined => {
  if (hasBlockingError(validateNonconformanceForm(value))) return undefined;
  if (row.lotId === null || row.quantity === null) return undefined;

  const departmentId = Number(value.departmentId);

  return {
    itemId: row.itemId,
    severityCode: value.severityCode.trim(),
    description: value.description.trim(),
    ...(value.departmentId !== '' && Number.isSafeInteger(departmentId) && departmentId > 0
      ? { responsibleDepartmentId: departmentId }
      : {}),
    ...(row.sourceCode === 'PRODUCT' && row.inspectionResultId !== null
      ? { inspectionResultId: row.inspectionResultId }
      : {}),
    lots: [{ lotId: row.lotId, affectedQty: row.quantity, uomId: row.uomId }],
  };
};

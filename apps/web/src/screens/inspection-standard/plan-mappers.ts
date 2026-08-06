import type { components } from '@omf-mes/api-client';

import type { InspectionPlan, PlanFormValues } from './types';

type InspectionPlanCreate = components['schemas']['InspectionPlanCreate'];
type InspectionPlanUpdate = components['schemas']['InspectionPlanUpdate'];

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 DS 입력·선택이 문자열을 다루기 때문이고,
 * 계약은 선택 필드를 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 */

/** 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다. */
const optionalIdToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. */
const textToOptionalId = (value: string): number | null => (value === '' ? null : Number(value));

export const planToFormValues = (plan: InspectionPlan): PlanFormValues => ({
  inspectionPlanCode: plan.inspectionPlanCode,
  inspectionPlanName: plan.inspectionPlanName,
  inspectionTypeCode: plan.inspectionTypeCode,
  itemId: optionalIdToText(plan.itemId),
  processId: optionalIdToText(plan.processId),
  routingId: optionalIdToText(plan.routingId),
});

export const emptyPlanFormValues = (): PlanFormValues => ({
  inspectionPlanCode: '',
  inspectionPlanName: '',
  inspectionTypeCode: '',
  itemId: '',
  processId: '',
  routingId: '',
});

/**
 * 기준 헤더 수정 요청 본문.
 *
 * **승인 정보(`approvedBy`·`approvedAt`)와 사용 여부(`isActive`)를 싣지 않는다** —
 * 승인은 `:approve`가, 사용 중지는 `:deactivate`가 기록한다. 실어 보내면 계약 위반이다.
 */
export const toPlanUpdate = (values: PlanFormValues): InspectionPlanUpdate => ({
  // 앞뒤 공백이 붙은 코드·이름은 눈으로 구분되지 않는 다른 값이 된다.
  inspectionPlanCode: values.inspectionPlanCode.trim(),
  inspectionPlanName: values.inspectionPlanName.trim(),
  inspectionTypeCode: values.inspectionTypeCode,
  itemId: textToOptionalId(values.itemId),
  processId: textToOptionalId(values.processId),
  routingId: textToOptionalId(values.routingId),
});

/**
 * 기준 등록 요청 본문. 계약이 수정 본문과 같은 항목을 받는다 —
 * 승인 정보와 사용 여부는 등록에서도 받지 않는다.
 */
export const toPlanCreate = (values: PlanFormValues): InspectionPlanCreate => toPlanUpdate(values);

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSamePlanValues = (a: PlanFormValues, b: PlanFormValues): boolean =>
  a.inspectionPlanCode === b.inspectionPlanCode &&
  a.inspectionPlanName === b.inspectionPlanName &&
  a.inspectionTypeCode === b.inspectionTypeCode &&
  a.itemId === b.itemId &&
  a.processId === b.processId &&
  a.routingId === b.routingId;

/** 계약이 주는 시각 표현에서 날짜와 분까지. */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 승인 시각 표기. 값이 없으면 null이다.
 *
 * **시간대를 옮기지 않는다.** 서버가 준 표기를 그대로 자를 뿐이며,
 * 아는 형식이 아니면 원문을 그대로 낸다 — 시각을 지어내지 않는다.
 */
export const formatApprovedAt = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value === '') return null;

  const matched = DATE_TIME.exec(value);

  return matched === null ? value : `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

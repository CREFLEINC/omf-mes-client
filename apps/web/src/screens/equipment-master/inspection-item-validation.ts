import { messages } from '@omf-mes/i18n';

import type { InspectionItemFormValues } from './types';

const t = messages.equipmentMaster.inspectionItem;

/**
 * 판정 방식이 「측정값」임을 뜻하는 코드값.
 *
 * ⭐ **설계가 확정해 알려 준 값이다**(`omf-mes#186` 회신) — 화면이 지어낸 값이 아니다.
 * ⛔ **선택지가 아니라 «판정»에 쓰는 값**이라 이름을 갖는다: 이 값일 때만 단위·상하한이
 * 짝으로 필요하다.
 */
export const MEASUREMENT_METHOD_CODE = 'MEASUREMENT';

/** 창이 소유한 입력칸 — 서버 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다. */
export const INSPECTION_ITEM_FIELDS = [
  'plantId',
  'itemCode',
  'itemName',
  'inspectionTypeCode',
  'judgmentMethodCode',
  'uomId',
  'lowerLimit',
  'upperLimit',
  'sequenceNo',
  'inspectionPoint',
] as const;

/** 측정값 판정인가. 이 판정 하나에 세 칸의 필수 여부가 매인다. */
export const isMeasurement = (values: InspectionItemFormValues): boolean =>
  values.judgmentMethodCode === MEASUREMENT_METHOD_CODE;

/** 사람이 친 수를 읽는다. **읽을 수 없으면 `null`** — 0과 구별한다. */
const parseNumber = (value: string): number | null => {
  if (value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * 점검 항목 폼을 잰다.
 *
 * ⛔ **짝 제약을 화면이 건다**(계약 · 설계 회신 `omf-mes#186`). 판정 방식이 「측정값」이면
 * 단위·하한·상한이 **함께** 필요하다 — 걸지 않으면 등록·수정이 **반드시 실패하는 경로**가
 * 되고, 사용자는 무엇을 더 채워야 하는지 서버 문구로만 알게 된다.
 *
 * ⛔ **「육안」인데 상하한을 요구하지 않는다** — 그 값들은 그때 뜻이 없다.
 */
export const validateInspectionItem = (
  values: InspectionItemFormValues,
  options: { isCreate: boolean },
): Record<string, string> => {
  const errors: Record<string, string> = {};

  /* 코드도 공장도 등록할 때만 정한다 — 수정 본문에 공장이 없고, 코드는 잠겨 있을 수 있다. */
  if (options.isCreate && values.plantId === '') errors.plantId = t.validation.required;
  if (options.isCreate && values.itemCode.trim() === '') errors.itemCode = t.validation.required;
  if (values.itemName.trim() === '') errors.itemName = t.validation.required;
  if (values.inspectionTypeCode === '') errors.inspectionTypeCode = t.validation.required;
  if (values.judgmentMethodCode === '') errors.judgmentMethodCode = t.validation.required;

  const sequenceNo = parseNumber(values.sequenceNo);

  if (values.sequenceNo.trim() === '') {
    errors.sequenceNo = t.validation.required;
  } else if (sequenceNo === null || !Number.isSafeInteger(sequenceNo) || sequenceNo < 0) {
    errors.sequenceNo = t.validation.sequencePositive;
  }

  if (!isMeasurement(values)) return errors;

  /* ⛔ 셋이 «함께» 필요하다 — 하나만 채운 상태로 저장하면 서버가 거절한다. */
  if (values.uomId === '') errors.uomId = t.validation.required;

  const lower = parseNumber(values.lowerLimit);
  const upper = parseNumber(values.upperLimit);

  if (values.lowerLimit.trim() === '') {
    errors.lowerLimit = t.validation.required;
  } else if (lower === null) {
    errors.lowerLimit = t.validation.mustBeNumber;
  }

  if (values.upperLimit.trim() === '') {
    errors.upperLimit = t.validation.required;
  } else if (upper === null) {
    errors.upperLimit = t.validation.mustBeNumber;
  }

  /*
   * ⭐ **둘 다 읽을 수 있을 때만 견준다** — 한쪽이 비었거나 수가 아니면 그 사실이 먼저이고,
   * 「하한이 상한보다 큽니다」를 함께 내면 사용자가 두 문제를 한 번에 떠안는다.
   */
  if (lower !== null && upper !== null && lower > upper) {
    errors.upperLimit = t.validation.limitOrder;
  }

  return errors;
};

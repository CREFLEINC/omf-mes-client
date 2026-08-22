import { messages } from '@omf-mes/i18n';

import type { GaugeFormValues } from './types';

const t = messages.gaugeMaster.validation;

/**
 * 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는
 * 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const GAUGE_FORM_FIELDS: readonly string[] = [
  'equipmentCode',
  'equipmentName',
  'equipmentTypeCode',
  'plantId',
  'calibrationRequired',
  'calibrationCycleTypeCode',
  'calibrationCycleInterval',
  'precisionValue',
  'precisionUomId',
];

/** 소수 자릿수. `1.250` 처럼 뒤에 붙은 0도 적힌 대로 센다 — 사용자가 적은 것이 그것이다. */
export const decimalPlaces = (text: string): number => {
  const dot = text.indexOf('.');

  return dot === -1 ? 0 : text.trim().length - dot - 1;
};

const POSITIVE_INTEGER = /^\d+$/;
const DECIMAL_NUMBER = /^\d+(\.\d+)?$/;

export interface GaugeValidationContext {
  /** 등록인가. 공장은 등록에서만 고른다 */
  isCreate: boolean;
  /** 고른 단위가 허용하는 소수 자릿수. 단위를 고르지 않았으면 `null` */
  decimalScale: number | null;
}

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다. 코드 중복은 서버 몫이다.
 *
 * ⭐ **검교정 짝 제약을 여기서 잰다.** 형제 화면(W-05-12)은 이 두 칸을 편집하지 않아
 * 일부러 재지 않는다 — 바꾸지 않는 값의 짝을 판정하면 이 화면이 정한 상태를 그쪽이
 * 거절하게 되기 때문이다. **재는 자리는 정하는 화면 하나다**(공유계약 B-13).
 */
export const validateGauge = (
  values: GaugeFormValues,
  context: GaugeValidationContext,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.equipmentCode === '') {
    errors.equipmentCode = t.required;
  } else if (values.equipmentCode.trim() === '') {
    errors.equipmentCode = t.codeBlank;
  }

  if (values.equipmentName.trim() === '') {
    errors.equipmentName = t.required;
  }

  if (values.equipmentTypeCode === '') {
    errors.equipmentTypeCode = t.required;
  }

  if (context.isCreate && values.plantId === '') {
    errors.plantId = t.required;
  }

  /*
   * ⭐ 검교정 대상이면 **주기 두 칸이 짝으로** 있어야 한다. 하나만 있으면 「3」인지
   * 「3개월」인지 「3년」인지 알 수 없어 다음 예정일을 아무도 셀 수 없다.
   */
  if (values.calibrationRequired) {
    if (values.calibrationCycleTypeCode === '') {
      errors.calibrationCycleTypeCode = t.cycleRequired;
    }

    const interval = values.calibrationCycleInterval.trim();

    if (interval === '') {
      errors.calibrationCycleInterval = t.cycleRequired;
    } else if (!POSITIVE_INTEGER.test(interval) || Number(interval) === 0) {
      errors.calibrationCycleInterval = t.intervalPositiveInteger;
    }
  }

  const precision = values.precisionValue.trim();
  const hasPrecision = precision !== '';
  const hasUom = values.precisionUomId !== '';

  /* 정밀도도 짝이다 — 「0.01」만으로는 mm 인지 μm 인지 알 수 없다. */
  if (hasPrecision && !hasUom) {
    errors.precisionUomId = t.precisionUomRequired;
  }

  if (!hasPrecision && hasUom) {
    errors.precisionValue = t.precisionValueRequired;
  }

  if (hasPrecision) {
    if (!DECIMAL_NUMBER.test(precision) || Number(precision) === 0) {
      errors.precisionValue = t.precisionPositive;
    } else if (context.decimalScale !== null && decimalPlaces(precision) > context.decimalScale) {
      errors.precisionValue = t.precisionScale(context.decimalScale);
    }
  }

  return errors;
};

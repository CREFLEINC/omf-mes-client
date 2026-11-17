import { messages } from '@omf-mes/i18n';

import { isValidLocationPrefix } from './location-prefix';
import type { WarehouseFormValues } from './types';

const t = messages.warehouseLocation.validation;
const prefixText = messages.warehouseLocation.locationPrefix;

/**
 * 창고 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const WAREHOUSE_FORM_FIELDS: readonly string[] = [
  'plantId',
  'businessUnitId',
  'warehouseCode',
  'warehouseName',
  'locationPrefix',
  'warehouseTypeCode',
  'isExternal',
  'isDefect',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * 코드 값의 유효성과 코드 중복은 검사하지 않는다 —
 * 계약이 유효성 판정을 서버 몫으로 두었고, 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 */
export const validateWarehouse = (
  values: WarehouseFormValues,
  mode: 'create' | 'edit',
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.warehouseCode === '') {
    errors.warehouseCode = t.required;
  } else if (values.warehouseCode.trim() === '') {
    errors.warehouseCode = t.codeBlank;
  }

  if (values.warehouseName.trim() === '') {
    errors.warehouseName = t.required;
  }

  if (values.warehouseTypeCode === '') {
    errors.warehouseTypeCode = t.required;
  }

  /*
   * 창고 위치 코드(#292)는 형식만 본다 — 계약이 형식(대문자 · 숫자 2~6자)을 못 박아 두어 서버와 답이 갈리지 않는다.
   * 다른 창고가 쓰는지는 서버가 가린다. 등록 뒤에는 바꿀 수 없어 고칠 때는 보지 않는다.
   */
  if (mode === 'create' && !isValidLocationPrefix(values.locationPrefix)) {
    errors.locationPrefix = prefixText.invalid;
  }

  // 공장은 등록 후 바꿀 수 없어 수정 요청에 실리지 않는다. 사업부는 두 요청 모두에 실린다.
  if (mode === 'create' && values.plantId === '') {
    errors.plantId = t.required;
  }

  if (values.businessUnitId === '') {
    errors.businessUnitId = t.required;
  }

  return errors;
};

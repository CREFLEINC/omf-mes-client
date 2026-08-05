import { messages } from '@omf-mes/i18n';

import type { WarehouseFormValues } from './types';

const t = messages.warehouseLocation.validation;

/**
 * 창고 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const WAREHOUSE_FORM_FIELDS: readonly string[] = [
  'plantId',
  'businessUnitId',
  'warehouseCode',
  'warehouseName',
  'warehouseTypeCode',
  'managementLevelCode',
  'isExternal',
  'partnerId',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * 코드 값의 유효성(관리수준 등)과 코드 중복은 검사하지 않는다 —
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

  // 공장은 등록 후 바꿀 수 없어 수정 요청에 실리지 않는다. 사업부는 두 요청 모두에 실린다.
  if (mode === 'create' && values.plantId === '') {
    errors.plantId = t.required;
  }

  if (values.businessUnitId === '') {
    errors.businessUnitId = t.required;
  }

  if (values.isExternal && values.partnerId === '') {
    errors.partnerId = t.partnerRequiredForExternal;
  }

  return errors;
};

import { messages } from '@omf-mes/i18n';

import type { EquipmentFormValues } from './types';

const t = messages.equipmentMaster.validation;

/**
 * 설비 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const EQUIPMENT_FORM_FIELDS: readonly string[] = [
  'equipmentCode',
  'equipmentName',
  'equipmentTypeCode',
  'productionLineId',
  'processId',
  'calibrationRequired',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * 코드 중복은 검사하지 않는다 — 계약이 유일성 판정을 서버 몫으로 두었다.
 *
 * ⛔ **검교정 짝 제약(대상이 참이면 주기 두 칸)을 여기서 재지 않는다.** 이 화면은 그 두 칸을
 * 편집하지 않고 상세에서 받은 값을 그대로 되돌려 보낸다 — 화면이 바꾸지 않는 값의 짝을
 * 화면이 판정하면, 계측기 마스터가 정한 상태를 이 화면이 거절하게 된다.
 */
export const validateEquipment = (values: EquipmentFormValues): Record<string, string> => {
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

  return errors;
};

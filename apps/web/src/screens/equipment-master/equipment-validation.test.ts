import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { EQUIPMENT_FORM_FIELDS, validateEquipment } from './equipment-validation';
import type { EquipmentFormValues } from './types';

const t = messages.equipmentMaster.validation;

const valid: EquipmentFormValues = {
  equipmentCode: 'EQ-01',
  equipmentName: '프레스 1호기',
  equipmentTypeCode: 'PRESS',
  productionLineId: '101',
  processId: '',
  calibrationRequired: false,
};

describe('EQUIPMENT_FORM_FIELDS', () => {
  it('폼이 가진 칸을 전부 담는다', () => {
    expect([...EQUIPMENT_FORM_FIELDS].sort()).toEqual(
      [
        'calibrationRequired',
        'equipmentCode',
        'equipmentName',
        'equipmentTypeCode',
        'processId',
        'productionLineId',
      ].sort(),
    );
  });
});

describe('validateEquipment', () => {
  it('제대로 채운 값에는 오류가 없다', () => {
    expect(validateEquipment(valid)).toEqual({});
  });

  it('코드·이름·유형이 비면 필수 오류를 낸다', () => {
    const errors = validateEquipment({
      ...valid,
      equipmentCode: '',
      equipmentName: '',
      equipmentTypeCode: '',
    });

    expect(errors.equipmentCode).toBe(t.required);
    expect(errors.equipmentName).toBe(t.required);
    expect(errors.equipmentTypeCode).toBe(t.required);
  });

  it('공백만 있는 코드는 필수와 다른 사유로 막는다', () => {
    expect(validateEquipment({ ...valid, equipmentCode: '   ' }).equipmentCode).toBe(t.codeBlank);
  });

  /* 소속 그룹이 비는 것은 정상 상태다 — 그 사실은 계층 텍스트가 밝힌다(G-9). */
  it('소속 그룹과 소속 공정은 비어도 막지 않는다', () => {
    const errors = validateEquipment({ ...valid, productionLineId: '', processId: '' });

    expect(errors.productionLineId).toBeUndefined();
    expect(errors.processId).toBeUndefined();
  });

  /*
   * ⛔ 검교정 짝 제약(대상이 참이면 주기 두 칸)을 여기서 재지 않는다. 이 화면은 그 두 칸을
   * 편집하지 않고 상세에서 받은 값을 그대로 되돌려 보낸다 — 화면이 바꾸지 않는 값의 짝을
   * 화면이 판정하면 계측기 마스터가 정한 상태를 이 화면이 거절하게 된다.
   */
  it('검교정 대상이 켜져 있어도 주기를 이유로 막지 않는다', () => {
    expect(validateEquipment({ ...valid, calibrationRequired: true })).toEqual({});
  });
});

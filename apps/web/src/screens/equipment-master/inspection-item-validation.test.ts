import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  INSPECTION_ITEM_FIELDS,
  MEASUREMENT_METHOD_CODE,
  isMeasurement,
  validateInspectionItem,
} from './inspection-item-validation';
import { emptyInspectionItemValues } from './mappers';
import type { InspectionItemFormValues } from './types';

const t = messages.equipmentMaster.inspectionItem.validation;

const CREATE = { isCreate: true };
const EDIT = { isCreate: false };

const visual = (overrides: Partial<InspectionItemFormValues> = {}): InspectionItemFormValues => ({
  ...emptyInspectionItemValues('11'),
  itemCode: 'INS-01',
  itemName: '벨트 장력',
  inspectionTypeCode: 'DAILY',
  judgmentMethodCode: 'VISUAL',
  sequenceNo: '1',
  ...overrides,
});

const measured = (overrides: Partial<InspectionItemFormValues> = {}): InspectionItemFormValues =>
  visual({
    judgmentMethodCode: MEASUREMENT_METHOD_CODE,
    uomId: '3',
    lowerLimit: '10',
    upperLimit: '20',
    ...overrides,
  });

describe('창이 소유한 칸', () => {
  /** 화면에 없는 칸을 「인라인으로 안다」고 선언하면 그 오류는 어디에도 서지 않는다. */
  it('창에 실제로 있는 칸들뿐이다', () => {
    expect([...INSPECTION_ITEM_FIELDS]).toEqual([
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
    ]);
  });
});

describe('측정값 판정인가', () => {
  it('그 코드값이면 그렇다', () => {
    expect(isMeasurement(measured())).toBe(true);
  });

  it('육안이면 아니다', () => {
    expect(isMeasurement(visual())).toBe(false);
  });

  /** ⛔ 고르지 않은 것을 「측정값이 아니다」로 접지 않는다 — 그건 아직 정하지 않은 것이다. */
  it('고르지 않았으면 아니다', () => {
    expect(isMeasurement(visual({ judgmentMethodCode: '' }))).toBe(false);
  });
});

describe('점검 항목 검증 — 공통', () => {
  it('육안 판정은 다 채우면 오류가 없다', () => {
    expect(validateInspectionItem(visual(), CREATE)).toEqual({});
  });

  it('이름은 언제나 필수다', () => {
    expect(validateInspectionItem(visual({ itemName: '  ' }), EDIT).itemName).toBe(t.required);
  });

  it('점검 유형과 판정 방식은 필수다', () => {
    const errors = validateInspectionItem(
      visual({ inspectionTypeCode: '', judgmentMethodCode: '' }),
      CREATE,
    );

    expect(errors.inspectionTypeCode).toBe(t.required);
    expect(errors.judgmentMethodCode).toBe(t.required);
  });

  /** ⭐ 코드와 공장은 «등록할 때만» 정한다 — 수정에서는 잠기거나 계약이 받지 않는다. */
  it('수정에서는 코드와 공장을 묻지 않는다', () => {
    const errors = validateInspectionItem(visual({ itemCode: '', plantId: '' }), EDIT);

    expect(errors.itemCode).toBeUndefined();
    expect(errors.plantId).toBeUndefined();
  });

  it('등록에서는 코드와 공장을 묻는다', () => {
    const errors = validateInspectionItem(visual({ itemCode: '', plantId: '' }), CREATE);

    expect(errors.itemCode).toBe(t.required);
    expect(errors.plantId).toBe(t.required);
  });

  it('표시 순서는 필수다', () => {
    expect(validateInspectionItem(visual({ sequenceNo: '' }), CREATE).sequenceNo).toBe(t.required);
  });

  /**
   * ⛔ **0은 순서가 아니다** — 계약이 `minimum: 1` 로 못박았다. 「맨 앞」을 0으로 두고 싶어도
   * 서버가 거절하므로, 화면이 막지 않으면 **저장에서야 알게 되는 값**이 된다.
   */
  it('순서는 1부터다 — 0·음수·소수를 막는다', () => {
    expect(validateInspectionItem(visual({ sequenceNo: '1' }), CREATE).sequenceNo).toBeUndefined();

    for (const value of ['0', '-1', '1.5']) {
      expect(validateInspectionItem(visual({ sequenceNo: value }), CREATE).sequenceNo).toBe(
        t.sequencePositive,
      );
    }
  });
});

/**
 * ⛔ **짝 제약을 화면이 건다**(계약 · 설계 회신 `omf-mes#186`). 걸지 않으면 등록·수정이
 * **반드시 실패하는 경로**가 되고, 사용자는 무엇을 더 채워야 하는지 서버 문구로만 알게 된다.
 */
describe('점검 항목 검증 — 측정값의 짝 제약', () => {
  it('다 채우면 오류가 없다', () => {
    expect(validateInspectionItem(measured(), CREATE)).toEqual({});
  });

  it('단위·하한·상한이 함께 필요하다', () => {
    const errors = validateInspectionItem(
      measured({ uomId: '', lowerLimit: '', upperLimit: '' }),
      CREATE,
    );

    expect(errors.uomId).toBe(t.required);
    expect(errors.lowerLimit).toBe(t.required);
    expect(errors.upperLimit).toBe(t.required);
  });

  /** ⛔ 하나만 채운 상태로 저장하면 서버가 거절한다 — 셋이 한 묶음이다. */
  it('하나만 채워도 나머지를 묻는다', () => {
    const errors = validateInspectionItem(measured({ lowerLimit: '', upperLimit: '' }), CREATE);

    expect(errors.uomId).toBeUndefined();
    expect(errors.lowerLimit).toBe(t.required);
    expect(errors.upperLimit).toBe(t.required);
  });

  it('수가 아닌 상하한은 「비었다」가 아니라 「수가 아니다」다', () => {
    const errors = validateInspectionItem(
      measured({ lowerLimit: '십', upperLimit: '스물' }),
      CREATE,
    );

    expect(errors.lowerLimit).toBe(t.mustBeNumber);
    expect(errors.upperLimit).toBe(t.mustBeNumber);
  });

  it('하한이 상한보다 크면 막는다', () => {
    expect(validateInspectionItem(measured({ lowerLimit: '30' }), CREATE).upperLimit).toBe(
      t.limitOrder,
    );
  });

  /** ⭐ 같은 값은 막지 않는다 — 「정확히 이 값」이라는 규격이 있을 수 있다. */
  it('하한과 상한이 같으면 막지 않는다', () => {
    expect(
      validateInspectionItem(measured({ lowerLimit: '10', upperLimit: '10' }), CREATE).upperLimit,
    ).toBeUndefined();
  });

  /**
   * ⭐ **한 칸에 두 문제를 겹쳐 내지 않는다** — 「수가 아니다」가 먼저이고, 그것을 고치기
   * 전에는 순서를 견줄 수 없다.
   */
  it('읽을 수 없는 값에는 순서 문제를 겹쳐 내지 않는다', () => {
    expect(
      validateInspectionItem(measured({ lowerLimit: '십' }), CREATE).upperLimit,
    ).toBeUndefined();
  });

  /** ⛔ 「육안」인데 상하한을 요구하지 않는다 — 그 값들은 그때 뜻이 없다. */
  it('육안이면 단위·상하한을 묻지 않는다', () => {
    const errors = validateInspectionItem(
      visual({ uomId: '', lowerLimit: '', upperLimit: '' }),
      CREATE,
    );

    expect(errors.uomId).toBeUndefined();
    expect(errors.lowerLimit).toBeUndefined();
    expect(errors.upperLimit).toBeUndefined();
  });
});

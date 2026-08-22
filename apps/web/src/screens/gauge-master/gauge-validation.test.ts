import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { emptyFormValues } from './mappers';
import { decimalPlaces, validateGauge, type GaugeValidationContext } from './gauge-validation';
import type { GaugeFormValues } from './types';

const t = messages.gaugeMaster.validation;

const EDIT: GaugeValidationContext = { isCreate: false, decimalScale: null };

const filled = (overrides: Partial<GaugeFormValues> = {}): GaugeFormValues => ({
  ...emptyFormValues('11'),
  equipmentCode: 'GA-01',
  equipmentName: '버니어 캘리퍼스',
  ...overrides,
});

describe('소수 자릿수', () => {
  it('점이 없으면 0이다', () => {
    expect(decimalPlaces('12')).toBe(0);
  });

  it('점 뒤의 자릿수를 센다', () => {
    expect(decimalPlaces('0.01')).toBe(2);
  });

  /* 적힌 대로 센다 — 「1.250」을 두 자리로 보면 사용자가 적은 것과 다른 답이 된다. */
  it('뒤에 붙은 0도 자릿수로 센다', () => {
    expect(decimalPlaces('1.250')).toBe(3);
  });
});

describe('계측기 검증', () => {
  it('다 채우면 오류가 없다', () => {
    expect(validateGauge(filled(), EDIT)).toEqual({});
  });

  it('계측기번호와 이름은 필수다', () => {
    const errors = validateGauge(filled({ equipmentCode: '', equipmentName: '' }), EDIT);

    expect(errors.equipmentCode).toBe(t.required);
    expect(errors.equipmentName).toBe(t.required);
  });

  /* 공백만 넣은 것은 「안 넣음」과 다른 실수라 다른 말을 한다. */
  it('공백만 넣은 계측기번호는 따로 말한다', () => {
    expect(validateGauge(filled({ equipmentCode: '   ' }), EDIT).equipmentCode).toBe(t.codeBlank);
  });

  it('이름이 공백뿐이면 필수로 잡는다', () => {
    expect(validateGauge(filled({ equipmentName: '  ' }), EDIT).equipmentName).toBe(t.required);
  });

  it('공장은 등록에서만 필수다', () => {
    const values = filled({ plantId: '' });

    expect(validateGauge(values, { isCreate: true, decimalScale: null }).plantId).toBe(t.required);
    expect(validateGauge(values, EDIT).plantId).toBeUndefined();
  });

  /* ⭐ 이 화면의 본론 — 형제 화면이 일부러 재지 않는 짝이다. */
  describe('검교정 짝 제약', () => {
    it('대상이 아니면 주기를 묻지 않는다', () => {
      const errors = validateGauge(
        filled({
          calibrationRequired: false,
          calibrationCycleTypeCode: '',
          calibrationCycleInterval: '',
        }),
        EDIT,
      );

      expect(errors.calibrationCycleTypeCode).toBeUndefined();
      expect(errors.calibrationCycleInterval).toBeUndefined();
    });

    it('대상이면 단위와 간격을 함께 요구한다', () => {
      const errors = validateGauge(filled({ calibrationRequired: true }), EDIT);

      expect(errors.calibrationCycleTypeCode).toBe(t.cycleRequired);
      expect(errors.calibrationCycleInterval).toBe(t.cycleRequired);
    });

    it('단위만 골라도 간격을 요구한다', () => {
      const errors = validateGauge(
        filled({ calibrationRequired: true, calibrationCycleTypeCode: 'MONTH' }),
        EDIT,
      );

      expect(errors.calibrationCycleTypeCode).toBeUndefined();
      expect(errors.calibrationCycleInterval).toBe(t.cycleRequired);
    });

    it('간격만 넣어도 단위를 요구한다', () => {
      const errors = validateGauge(
        filled({ calibrationRequired: true, calibrationCycleInterval: '12' }),
        EDIT,
      );

      expect(errors.calibrationCycleTypeCode).toBe(t.cycleRequired);
      expect(errors.calibrationCycleInterval).toBeUndefined();
    });

    it('둘 다 있으면 통과한다', () => {
      const errors = validateGauge(
        filled({
          calibrationRequired: true,
          calibrationCycleTypeCode: 'MONTH',
          calibrationCycleInterval: '12',
        }),
        EDIT,
      );

      expect(errors.calibrationCycleTypeCode).toBeUndefined();
      expect(errors.calibrationCycleInterval).toBeUndefined();
    });

    it.each([['0'], ['-3'], ['1.5'], ['열두달']])('간격 %s 은 정수가 아니라 막는다', (interval) => {
      const errors = validateGauge(
        filled({
          calibrationRequired: true,
          calibrationCycleTypeCode: 'MONTH',
          calibrationCycleInterval: interval,
        }),
        EDIT,
      );

      expect(errors.calibrationCycleInterval).toBe(t.intervalPositiveInteger);
    });
  });

  describe('정밀도 짝 제약', () => {
    it('둘 다 비어 있으면 묻지 않는다 — 정밀도는 필수가 아니다', () => {
      expect(validateGauge(filled(), EDIT)).toEqual({});
    });

    it('값만 넣으면 단위를 요구한다', () => {
      const errors = validateGauge(filled({ precisionValue: '0.01' }), EDIT);

      expect(errors.precisionUomId).toBe(t.precisionUomRequired);
    });

    it('단위만 고르면 값을 요구한다', () => {
      const errors = validateGauge(filled({ precisionUomId: '1001' }), EDIT);

      expect(errors.precisionValue).toBe(t.precisionValueRequired);
    });

    it.each([['0'], ['-1'], ['일점영']])('정밀도 %s 는 막는다', (precisionValue) => {
      const errors = validateGauge(filled({ precisionValue, precisionUomId: '1001' }), EDIT);

      expect(errors.precisionValue).toBe(t.precisionPositive);
    });

    /* 고른 단위가 허용하는 자릿수를 넘으면 서버가 잘라 버려 적은 것과 다른 값이 저장된다. */
    it('단위가 허용하는 소수 자릿수를 넘으면 막는다', () => {
      const errors = validateGauge(filled({ precisionValue: '0.001', precisionUomId: '1001' }), {
        isCreate: false,
        decimalScale: 2,
      });

      expect(errors.precisionValue).toBe(t.precisionScale(2));
    });

    it('허용 자릿수와 같으면 통과한다', () => {
      const errors = validateGauge(filled({ precisionValue: '0.01', precisionUomId: '1001' }), {
        isCreate: false,
        decimalScale: 2,
      });

      expect(errors.precisionValue).toBeUndefined();
    });

    it('소수를 못 쓰는 단위는 그렇게 말한다', () => {
      const errors = validateGauge(filled({ precisionValue: '0.5', precisionUomId: '1001' }), {
        isCreate: false,
        decimalScale: 0,
      });

      expect(errors.precisionValue).toBe(t.precisionScale(0));
      expect(t.precisionScale(0)).not.toBe(t.precisionScale(2));
    });

    /* 단위를 아직 모르면 자릿수를 판정할 수 없다 — 모르는 것을 아는 척하지 않는다. */
    it('단위를 고르지 않았으면 자릿수를 재지 않는다', () => {
      const errors = validateGauge(filled({ precisionValue: '0.00001' }), EDIT);

      expect(errors.precisionValue).toBeUndefined();
    });
  });
});

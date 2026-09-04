import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER_TYPE_CODE, isEmergencyTypeCodeKnown } from './work-order-type';

describe('긴급 유형 코드', () => {
  it('빈 값·공백만인 값은 「모른다」로 본다', () => {
    expect(isEmergencyTypeCodeKnown('')).toBe(false);
    expect(isEmergencyTypeCodeKnown('   ')).toBe(false);
  });

  it('상수는 알고 있는 값이다', () => {
    expect(isEmergencyTypeCodeKnown()).toBe(true);
    expect(isEmergencyTypeCodeKnown(EMERGENCY_WORK_ORDER_TYPE_CODE)).toBe(true);
  });
});

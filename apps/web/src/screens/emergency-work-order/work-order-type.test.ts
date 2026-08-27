import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER_TYPE_CODE, isEmergencyTypeCodeKnown } from './work-order-type';

describe('긴급 W/O 유형 코드', () => {
  it('⛔ 값을 지어내지 않았다 — 계약이 정해 주지 않은 자리다', () => {
    expect(EMERGENCY_WORK_ORDER_TYPE_CODE).toBe('');
  });

  it('값이 비어 있으면 모르는 것으로 본다', () => {
    expect(isEmergencyTypeCodeKnown()).toBe(false);
    expect(isEmergencyTypeCodeKnown('')).toBe(false);
    expect(isEmergencyTypeCodeKnown('   ')).toBe(false);
  });

  it('값이 오면 아는 것으로 본다 — 회신 전에 열린 쪽 경로를 확인해 둔다', () => {
    expect(isEmergencyTypeCodeKnown('SYN_EMERGENCY')).toBe(true);
  });
});

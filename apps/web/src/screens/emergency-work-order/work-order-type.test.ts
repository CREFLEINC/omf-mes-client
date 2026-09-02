import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER_TYPE_CODE, isEmergencyTypeCodeKnown } from './work-order-type';

describe('긴급 W/O 유형 코드', () => {
  /*
   * ⛔ **값 자체를 고정한다.** 이 자리가 틀리면 오류 없이 조용히 **양산 W/O 가 만들어진다** —
   * 화면은 「유형: 긴급」이라 적어 놓고, 그렇게 만들어진 지시는 긴급으로 세어지지 않는다.
   * 「비어 있지 않다」로는 그 사고를 막지 못하므로 값을 그대로 적어 둔다.
   */
  it('⛔ 계약이 정한 값이다 — 다른 값이면 양산 W/O 가 조용히 만들어진다', () => {
    expect(EMERGENCY_WORK_ORDER_TYPE_CODE).toBe('EMERGENCY');
  });

  /*
   * ⛔ **값이 정해진 뒤에도 이 판정은 남는다.** 어떤 경위로든 빈 값이 흘러들면 발행이
   * 열려서는 안 된다 — 상수를 채운 것과 「빈 값으로는 못 보낸다」는 다른 보장이다.
   */
  it('빈 값은 모르는 것으로 본다 — 공백만 있어도 마찬가지다', () => {
    expect(isEmergencyTypeCodeKnown('')).toBe(false);
    expect(isEmergencyTypeCodeKnown('   ')).toBe(false);
  });

  it('기본값은 상수를 읽는다 — 이제 아는 값이라 열린다', () => {
    expect(isEmergencyTypeCodeKnown()).toBe(true);
  });

  it('값이 있으면 아는 것으로 본다', () => {
    expect(isEmergencyTypeCodeKnown('SYN_EMERGENCY')).toBe(true);
  });
});

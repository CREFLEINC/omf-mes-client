import { describe, expect, it } from 'vitest';

import { toRuleView } from './types';
import type { PutawayRule } from './types';

/**
 * 계약의 세 상태(응답에 없음 · `null` · 값)를 화면의 두 상태로 줄이는 자리를 잰다.
 * 줄이지 않으면 읽는 자리마다 `?? null`이 흩어지고, 한 자리라도 빠뜨리면 그 자리에서만
 * 「비었다」와 「안 왔다」가 갈린다.
 */
const baseRule: PutawayRule = {
  putawayRuleId: 9001,
  itemId: 9101,
  warehouseId: 9201,
  locationId: 9301,
  capacityQty: 500,
  uomId: 9401,
  priorityNo: 100,
  remarks: '합성 비고',
  isActive: true,
};

describe('toRuleView', () => {
  it('계약 필드를 그대로 옮긴다', () => {
    expect(toRuleView(baseRule)).toEqual({
      putawayRuleId: 9001,
      itemId: 9101,
      warehouseId: 9201,
      locationId: 9301,
      capacityQty: 500,
      uomId: 9401,
      priorityNo: 100,
      remarks: '합성 비고',
      isActive: true,
    });
  });

  it('위치가 null이면 null로 남는다 — 창고 전체 규칙이라는 확정된 뜻이다', () => {
    expect(toRuleView({ ...baseRule, locationId: null }).locationId).toBeNull();
  });

  it('위치 키가 응답에 없어도 null이다 — 「안 왔다」와 「비웠다」가 화면에서 같은 뜻이다', () => {
    const { locationId: _omitted, ...withoutLocation } = baseRule;

    expect(toRuleView(withoutLocation).locationId).toBeNull();
  });

  it('비고가 없으면 null이다', () => {
    const { remarks: _omitted, ...withoutRemarks } = baseRule;

    expect(toRuleView(withoutRemarks).remarks).toBeNull();
    expect(toRuleView({ ...baseRule, remarks: null }).remarks).toBeNull();
  });

  /**
   * `??`는 0을 통과시킨다. `||`로 줄이면 용량 0·우선순위 0이 「없음」이 되어 뜻이 바뀐다 —
   * 계약이 용량 0을 「넣을 수 없다」는 값으로 두었으므로 지워지면 안 된다.
   */
  it('용량 0과 우선순위 0이 값으로 남는다', () => {
    const zeroed = toRuleView({ ...baseRule, capacityQty: 0, priorityNo: 0 });

    expect(zeroed.capacityQty).toBe(0);
    expect(zeroed.priorityNo).toBe(0);
  });

  it('비고 빈 문자열을 null로 바꾸지 않는다 — 서버가 보낸 값을 화면이 고치지 않는다', () => {
    expect(toRuleView({ ...baseRule, remarks: '' }).remarks).toBe('');
  });
});

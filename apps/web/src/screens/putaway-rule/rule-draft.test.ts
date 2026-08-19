import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRIORITY_NO,
  emptyRuleFormValues,
  isSameRuleValues,
  ruleToFormValues,
  withWarehouse,
} from './rule-draft';
import { RULE_WAREHOUSE_WIDE, RULE_WITH_LOCATION } from './fixtures';

describe('emptyRuleFormValues', () => {
  /**
   * 계약의 생성 타입에서 `priorityNo`가 **기본값을 가진 필수**라 폼이 늘 값을 들고 있어야 한다
   * (부록 A ⓐ 실측). 비워 두면 등록 본문을 만들 수 없다.
   */
  it('우선순위만 기본값을 갖는다', () => {
    const values = emptyRuleFormValues('9201');

    expect(values.priorityNo).toBe(DEFAULT_PRIORITY_NO);
    expect(values.itemId).toBe('');
    expect(values.locationId).toBe('');
    expect(values.capacityQty).toBe('');
    expect(values.uomId).toBe('');
    expect(values.remarks).toBe('');
  });

  /** 기본값이 계약이 적어 둔 값과 갈리면 화면이 제 값을 지어내는 것이다. */
  it('기본 우선순위가 계약의 기본값과 같다', () => {
    expect(DEFAULT_PRIORITY_NO).toBe('100');
  });

  /** 비워 두면 방금 고른 창고를 폼에서 한 번 더 골라야 한다. */
  it('고른 창고를 미리 채운다', () => {
    expect(emptyRuleFormValues('9201').warehouseId).toBe('9201');
  });
});

describe('ruleToFormValues', () => {
  it('서버 값을 그대로 옮긴다', () => {
    expect(ruleToFormValues(RULE_WITH_LOCATION)).toEqual({
      itemId: '9101',
      warehouseId: '9201',
      locationId: '9301',
      capacityQty: '500',
      uomId: '9401',
      priorityNo: '10',
      remarks: '합성 비고',
    });
  });

  /** 위치를 비운 창고 전체 규칙은 **빈 칸**이 된다 — 그것이 「비어 있다」의 폼 표현이다. */
  it('창고 전체 규칙의 위치가 빈 칸이 된다', () => {
    expect(ruleToFormValues(RULE_WAREHOUSE_WIDE).locationId).toBe('');
  });

  it('비고가 없으면 빈 칸이 된다', () => {
    expect(ruleToFormValues(RULE_WAREHOUSE_WIDE).remarks).toBe('');
  });

  /** `||`로 줄이면 우선순위 0이 사라져 다음 저장에서 다른 값이 된다. */
  it('0을 빈 칸으로 뭉개지 않는다', () => {
    const values = ruleToFormValues({ ...RULE_WITH_LOCATION, priorityNo: 0, capacityQty: 0 });

    expect(values.priorityNo).toBe('0');
    expect(values.capacityQty).toBe('0');
  });
});

describe('isSameRuleValues', () => {
  const base = ruleToFormValues(RULE_WITH_LOCATION);

  it('같은 값이면 참이다', () => {
    expect(isSameRuleValues(base, { ...base })).toBe(true);
  });

  /** 일곱 칸 중 하나라도 빠뜨리면 그 칸만 고친 상태가 「고친 것 없음」으로 읽혀 저장이 잠긴다. */
  it.each([
    ['itemId', { itemId: '9102' }],
    ['warehouseId', { warehouseId: '9202' }],
    ['locationId', { locationId: '' }],
    ['capacityQty', { capacityQty: '501' }],
    ['uomId', { uomId: '9402' }],
    ['priorityNo', { priorityNo: '11' }],
    ['remarks', { remarks: '다른 비고' }],
  ])('%s를 고치면 거짓이다', (_field, patch) => {
    expect(isSameRuleValues(base, { ...base, ...patch })).toBe(false);
  });
});

describe('withWarehouse', () => {
  const base = ruleToFormValues(RULE_WITH_LOCATION);

  /** 다른 창고의 위치를 실은 규칙은 성립하지 않는다 — 화면에 없는 값이 본문에 실리는 자리다. */
  it('창고를 바꾸면 위치를 함께 비운다', () => {
    const next = withWarehouse(base, '9202');

    expect(next.warehouseId).toBe('9202');
    expect(next.locationId).toBe('');
  });

  /** 용량·단위·우선순위·비고는 창고에 속하지 않는다 — 함께 지우면 사용자가 친 값이 사라진다. */
  it('나머지 칸은 건드리지 않는다', () => {
    const next = withWarehouse(base, '9202');

    expect(next.capacityQty).toBe(base.capacityQty);
    expect(next.uomId).toBe(base.uomId);
    expect(next.priorityNo).toBe(base.priorityNo);
    expect(next.remarks).toBe(base.remarks);
    expect(next.itemId).toBe(base.itemId);
  });
});

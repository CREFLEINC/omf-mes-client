import { describe, expect, it } from 'vitest';

import { emptyRuleFormValues, ruleToFormValues, type RuleFormValues } from './rule-draft';
import { RULE_WITH_LOCATION } from './fixtures';
import { toRuleCreate, toRuleUpdate } from './rule-request';

const validCreate = (patch: Partial<RuleFormValues> = {}): RuleFormValues => ({
  ...emptyRuleFormValues('9201'),
  itemId: '9101',
  capacityQty: '500',
  uomId: '9401',
  ...patch,
});

describe('toRuleCreate', () => {
  it('폼 값을 계약 본문으로 옮긴다', () => {
    expect(toRuleCreate(validCreate({ locationId: '9301', remarks: '합성 비고' }))).toEqual({
      itemId: 9101,
      warehouseId: 9201,
      locationId: 9301,
      capacityQty: 500,
      uomId: 9401,
      priorityNo: 100,
      remarks: '합성 비고',
    });
  });

  /**
   * 계약 정본에서 `required`가 아니지만 기본값이 있어 **생성 타입에서는 선택이 아니다**
   * (부록 A ⓐ 실측). 빠뜨리면 타입이 서지 않고, 서더라도 서버 기본값에 맡기는 것이 된다.
   */
  it('우선순위를 늘 싣는다', () => {
    expect(toRuleCreate(validCreate())?.priorityNo).toBe(100);
  });

  /** 비운 위치는 「창고 전체」라는 **값**이다 — 생략이 아니라 `null`을 명시해 싣는다. */
  it('위치를 비우면 null을 명시해 싣는다', () => {
    const body = toRuleCreate(validCreate({ locationId: '' }));

    expect(body).not.toBeNull();
    expect(body && 'locationId' in body).toBe(true);
    expect(body?.locationId).toBeNull();
  });

  it('비고를 비우면 null을 싣는다', () => {
    expect(toRuleCreate(validCreate({ remarks: '   ' }))?.remarks).toBeNull();
  });

  it('비고의 앞뒤 공백을 턴다', () => {
    expect(toRuleCreate(validCreate({ remarks: '  합성  ' }))?.remarks).toBe('합성');
  });

  /** 계약이 `isActive`를 받지 않는다 — 신규는 항상 사용 중이다. */
  it('사용 여부를 싣지 않는다', () => {
    expect(toRuleCreate(validCreate())).not.toHaveProperty('isActive');
  });

  /** **번호 0으로 나가는 요청**을 만들 여지를 두지 않는다. */
  it.each([
    ['품목', { itemId: '' }],
    ['창고', { warehouseId: '' }],
    ['단위', { uomId: '' }],
    ['용량', { capacityQty: '' }],
    ['용량 0', { capacityQty: '0' }],
    ['용량 형식', { capacityQty: '오백' }],
    ['우선순위', { priorityNo: '' }],
    ['우선순위 소수', { priorityNo: '1.5' }],
  ])('%s를 읽을 수 없으면 본문을 만들지 않는다', (_name, patch) => {
    expect(toRuleCreate(validCreate(patch))).toBeNull();
  });
});

describe('toRuleUpdate', () => {
  const edit = ruleToFormValues(RULE_WITH_LOCATION);

  /**
   * 계약이 「바꾸면 다른 규칙이다」로 두 키를 뺐다. 폼이 값을 들고 있어도 실을 자리가 없다는
   * 사실이 이 함수의 결과로 드러나야 한다.
   */
  it('품목과 창고를 싣지 않는다', () => {
    const body = toRuleUpdate(edit);

    expect(body).not.toHaveProperty('itemId');
    expect(body).not.toHaveProperty('warehouseId');
  });

  it('나머지 다섯 키를 늘 명시해 싣는다', () => {
    expect(toRuleUpdate(edit)).toEqual({
      locationId: 9301,
      capacityQty: 500,
      uomId: 9401,
      priorityNo: 10,
      remarks: '합성 비고',
    });
  });

  /** 부분 수정이 아니다 — 비운 칸은 「그대로 둔다」가 아니라 「비운다」로 나간다. */
  it('위치를 비우면 null이 실린다', () => {
    expect(toRuleUpdate({ ...edit, locationId: '' })?.locationId).toBeNull();
  });

  it('비고를 비우면 null이 실린다', () => {
    expect(toRuleUpdate({ ...edit, remarks: '' })?.remarks).toBeNull();
  });

  it.each([
    ['단위', { uomId: '' }],
    ['용량 0', { capacityQty: '0' }],
    ['우선순위 소수', { priorityNo: '1.5' }],
  ])('%s를 읽을 수 없으면 본문을 만들지 않는다', (_name, patch) => {
    expect(toRuleUpdate({ ...edit, ...patch })).toBeNull();
  });

  /** 품목·창고가 비어도 수정 본문은 만들 수 있다 — 그 두 키가 본문에 없기 때문이다. */
  it('품목·창고가 비어도 본문을 만든다', () => {
    expect(toRuleUpdate({ ...edit, itemId: '', warehouseId: '' })).not.toBeNull();
  });
});

import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { DuplicateCheck } from './duplicate-check';
import { emptyRuleFormValues, ruleToFormValues, type RuleFormValues } from './rule-draft';
import { RULE_WITH_LOCATION } from './fixtures';
import {
  RULE_FORM_FIELDS,
  parseIdentifier,
  parseIntegerValue,
  parseNumber,
  saveBlockedReason,
  validateRuleForm,
} from './rule-validation';

const t = messages.putawayRule;

/** 저장할 수 있는 등록 값 한 벌. 갈래마다 칸 하나만 어긋나게 해 무엇이 갈랐는지 읽히게 한다. */
const validCreate = (patch: Partial<RuleFormValues> = {}): RuleFormValues => ({
  ...emptyRuleFormValues('9201'),
  itemId: '9101',
  capacityQty: '500',
  uomId: '9401',
  ...patch,
});

describe('parseNumber', () => {
  it('빈 칸과 읽을 수 없는 값을 가른다', () => {
    expect(parseNumber('')).toEqual({ kind: 'empty' });
    expect(parseNumber('   ')).toEqual({ kind: 'empty' });
    expect(parseNumber('abc')).toEqual({ kind: 'invalid' });
  });

  /** `Number('')`는 0이고 `Number('Infinity')`는 유한하지 않다 — 둘 다 본문에 실리면 안 된다. */
  it('무한대를 숫자로 보지 않는다', () => {
    expect(parseNumber('Infinity')).toEqual({ kind: 'invalid' });
  });

  it('0과 음수도 읽어 낸다', () => {
    expect(parseNumber('0')).toEqual({ kind: 'number', value: 0 });
    expect(parseNumber('-3')).toEqual({ kind: 'number', value: -3 });
  });
});

describe('parseIntegerValue', () => {
  it('소수를 읽을 수 없는 값으로 본다', () => {
    expect(parseIntegerValue('1.5')).toEqual({ kind: 'invalid' });
  });

  it('정수는 그대로 읽는다', () => {
    expect(parseIntegerValue('100')).toEqual({ kind: 'number', value: 100 });
  });

  /** 빈 칸은 형식 오류가 아니다 — 사용자가 할 일이 다르다(채워라 / 고쳐라). */
  it('빈 칸을 형식 오류로 바꾸지 않는다', () => {
    expect(parseIntegerValue('')).toEqual({ kind: 'empty' });
  });
});

describe('parseIdentifier', () => {
  it('1부터 매겨진 번호만 값으로 본다', () => {
    expect(parseIdentifier('9101')).toBe(9101);
    expect(parseIdentifier('0')).toBeNull();
    expect(parseIdentifier('-1')).toBeNull();
    expect(parseIdentifier('abc')).toBeNull();
    expect(parseIdentifier('')).toBeNull();
  });
});

describe('RULE_FORM_FIELDS', () => {
  /**
   * 입력칸 없는 이름을 담으면 그 오류가 인라인으로 흘러가 **어디에도 보이지 않는다.**
   * 사용 여부는 전용 액션으로만 바뀌므로 여기 없다.
   */
  it('사용 여부를 담지 않는다', () => {
    expect(RULE_FORM_FIELDS).not.toContain('isActive');
  });

  it('폼이 가진 일곱 칸을 담는다', () => {
    expect([...RULE_FORM_FIELDS].sort()).toEqual([
      'capacityQty',
      'itemId',
      'locationId',
      'priorityNo',
      'remarks',
      'uomId',
      'warehouseId',
    ]);
  });
});

describe('validateRuleForm — 등록', () => {
  it('갖춘 값에서는 오류가 없다', () => {
    expect(validateRuleForm(validCreate(), 'create')).toEqual({});
  });

  it('품목을 고르지 않으면 그 칸에 말한다', () => {
    expect(validateRuleForm(validCreate({ itemId: '' }), 'create').itemId).toBe(
      t.validation.itemRequired,
    );
  });

  it('창고를 고르지 않으면 그 칸에 말한다', () => {
    expect(validateRuleForm(validCreate({ warehouseId: '' }), 'create').warehouseId).toBe(
      t.validation.warehouseRequired,
    );
  });

  /** 위치를 비우는 것은 **정상 값**(창고 전체 규칙)이라 오류가 아니다. */
  it('위치를 비워도 오류가 아니다', () => {
    expect(validateRuleForm(validCreate({ locationId: '' }), 'create')).toEqual({});
  });
});

describe('validateRuleForm — 용량·단위·우선순위', () => {
  it('용량이 비면 채우라고 말한다', () => {
    expect(validateRuleForm(validCreate({ capacityQty: '' }), 'create').capacityQty).toBe(
      t.validation.capacityRequired,
    );
  });

  it('용량이 숫자가 아니면 형식을 말한다', () => {
    expect(validateRuleForm(validCreate({ capacityQty: '오백' }), 'create').capacityQty).toBe(
      t.validation.capacityNotNumber,
    );
  });

  /** C3-5 — 계약이 「0 은 넣을 수 없다」로 못 박았다. */
  it('용량 0을 막는다', () => {
    expect(validateRuleForm(validCreate({ capacityQty: '0' }), 'create').capacityQty).toBe(
      t.validation.capacityNotPositive,
    );
  });

  it('용량 음수를 막는다', () => {
    expect(validateRuleForm(validCreate({ capacityQty: '-1' }), 'create').capacityQty).toBe(
      t.validation.capacityNotPositive,
    );
  });

  it('단위를 고르지 않으면 그 칸에 말한다', () => {
    expect(validateRuleForm(validCreate({ uomId: '' }), 'create').uomId).toBe(
      t.validation.uomRequired,
    );
  });

  it('우선순위가 비면 채우라고 말한다', () => {
    expect(validateRuleForm(validCreate({ priorityNo: '' }), 'create').priorityNo).toBe(
      t.validation.priorityRequired,
    );
  });

  it('우선순위가 정수가 아니면 형식을 말한다', () => {
    expect(validateRuleForm(validCreate({ priorityNo: '1.5' }), 'create').priorityNo).toBe(
      t.validation.priorityNotInteger,
    );
  });

  /** 여러 칸이 함께 어긋나면 **함께** 말한다 — 하나씩 고치게 하면 저장을 여러 번 누르게 된다. */
  it('어긋난 칸을 함께 낸다', () => {
    const errors = validateRuleForm(
      validCreate({ capacityQty: '', uomId: '', priorityNo: 'x' }),
      'create',
    );

    expect(Object.keys(errors).sort()).toEqual(['capacityQty', 'priorityNo', 'uomId']);
  });
});

describe('validateRuleForm — 수정', () => {
  /**
   * 계약의 수정 본문에 품목·창고 키가 없다. 수정에서 두 칸을 검사하면 **잠겨 있어 고칠 수도
   * 없는 칸**이 저장을 막는다.
   */
  it('품목·창고가 비어도 막지 않는다', () => {
    const values = { ...ruleToFormValues(RULE_WITH_LOCATION), itemId: '', warehouseId: '' };

    expect(validateRuleForm(values, 'edit')).toEqual({});
  });

  it('용량 규칙은 수정에도 그대로 걸린다', () => {
    const values = { ...ruleToFormValues(RULE_WITH_LOCATION), capacityQty: '0' };

    expect(validateRuleForm(values, 'edit').capacityQty).toBe(t.validation.capacityNotPositive);
  });
});

describe('saveBlockedReason', () => {
  const clear: DuplicateCheck = { kind: 'clear' };

  it('등록은 고친 것이 없어도 막지 않는다', () => {
    expect(saveBlockedReason({ mode: 'create', isDirty: false, duplicate: clear })).toBeNull();
  });

  it('수정은 고친 것이 없으면 막는다', () => {
    expect(saveBlockedReason({ mode: 'edit', isDirty: false, duplicate: clear })).toBe(
      t.actionReasons.saveNoChanges,
    );
  });

  it('활성 중복이면 막는다', () => {
    const duplicate: DuplicateCheck = { kind: 'blocked', existingCount: 1, existingRuleId: 9001 };

    expect(saveBlockedReason({ mode: 'create', isDirty: true, duplicate })).toBe(
      t.actionReasons.duplicateActive,
    );
  });

  /** C3-9 — 판정하지 못한 갈래는 **막지 않는다.** 계약이 같은 조건을 다시 검사한다. */
  it.each(['loading', 'failed', 'truncated', 'incomplete'] as const)(
    '중복을 판정하지 못한 갈래(%s)는 막지 않는다',
    (reason) => {
      expect(
        saveBlockedReason({
          mode: 'create',
          isDirty: true,
          duplicate: { kind: 'unknown', reason },
        }),
      ).toBeNull();
    },
  );

  /** 필수 누락은 **버튼이 아니라 칸 옆에서** 말한다 — 모자란 칸이 여럿일 수 있다. */
  it('필수 누락으로 버튼을 잠그지 않는다', () => {
    expect(saveBlockedReason({ mode: 'create', isDirty: true, duplicate: clear })).toBeNull();
  });
});

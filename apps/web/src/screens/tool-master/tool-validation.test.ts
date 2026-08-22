import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { TOOL_FORM_FIELDS, validateTool } from './tool-validation';
import type { ToolFormValues } from './types';

const t = messages.toolMaster.validation;

const make = (overrides: Partial<ToolFormValues> = {}): ToolFormValues => ({
  moldCode: 'TL-01',
  moldName: '프레스 금형',
  toolTypeCode: 'MOLD',
  plantId: '11',
  cavityCount: '1',
  guaranteedShotCount: '',
  pmTriggerTypeCode: 'NONE',
  pmCycleInterval: '',
  pmCycleUnitCode: '',
  ...overrides,
});

const validate = (overrides: Partial<ToolFormValues> = {}, isCreate = true) =>
  validateTool(make(overrides), { isCreate });

describe('validateTool — 필수', () => {
  it('빈 값이 없으면 오류가 없다', () => {
    expect(validate()).toEqual({});
  });

  it.each(['moldCode', 'moldName', 'toolTypeCode'] as const)('%s 가 비면 막는다', (field) => {
    expect(validate({ [field]: '' })[field]).toBe(t.required);
  });

  /* 공백만 친 것은 「비었다」와 다른 실수다 — 다른 말로 짚어야 무엇을 고칠지 안다. */
  it('툴코드가 공백뿐이면 다른 말로 짚는다', () => {
    expect(validate({ moldCode: '   ' }).moldCode).toBe(t.codeBlank);
  });

  it('툴명은 공백뿐이어도 「필수」다 — 이름은 다듬어 담는다', () => {
    expect(validate({ moldName: '   ' }).moldName).toBe(t.required);
  });

  /* 공장은 등록에서만 고른다 — 계약이 수정 본문에 받지 않는다. */
  it('공장은 등록에서만 필수다', () => {
    expect(validate({ plantId: '' }).plantId).toBe(t.required);
    expect(validate({ plantId: '' }, false).plantId).toBeUndefined();
  });
});

describe('validateTool — 캐비티 수', () => {
  it('비면 막는다', () => {
    expect(validate({ cavityCount: '' }).cavityCount).toBe(t.required);
  });

  /* 캐비티 0 은 「한 번에 하나도 못 뽑는다」라 뜻이 없다. */
  it.each(['0', '-1', '1.5', 'a', '１'])('%s 은 1 이상의 정수가 아니다', (value) => {
    expect(validate({ cavityCount: value }).cavityCount).toBe(t.cavityPositiveInteger);
  });

  it('1 이상의 정수는 통과한다', () => {
    expect(validate({ cavityCount: '4' }).cavityCount).toBeUndefined();
  });
});

describe('validateTool — 적정타수', () => {
  /*
   * ⭐ **비어 있어도 막지 않는다.** 「적정타수 없는 것만」 조회 조건이 그 상태를 전제한다 —
   * 막으면 나중에 채우는 길이 사라지고 그 조회 조건이 셀 것이 없어진다.
   */
  it('비어 있어도 막지 않는다', () => {
    expect(validate({ guaranteedShotCount: '' }).guaranteedShotCount).toBeUndefined();
  });

  it('타발수 축을 써도 비어 있는 것을 막지 않는다', () => {
    expect(
      validate({ pmTriggerTypeCode: 'SHOT', guaranteedShotCount: '' }).guaranteedShotCount,
    ).toBeUndefined();
  });

  /* ⛔ 0 은 「없음」이 아니라 「이미 다 썼다」로 셈된다 — 비우는 것과 다른 뜻이다. */
  it.each(['0', '-5', '1.5'])('%s 은 받지 않는다', (value) => {
    expect(validate({ guaranteedShotCount: value }).guaranteedShotCount).toBe(
      t.guaranteedPositiveInteger,
    );
  });

  it('1 이상의 정수는 통과한다', () => {
    expect(validate({ guaranteedShotCount: '500000' }).guaranteedShotCount).toBeUndefined();
  });
});

describe('validateTool — 예방보전 주기 짝', () => {
  /* 하나만 있으면 「6」인지 「6일」인지 「6개월」인지 알 수 없다. */
  it.each(['DATE', 'BOTH'])('%s 이면 주기 두 칸을 함께 요구한다', (trigger) => {
    const errors = validate({ pmTriggerTypeCode: trigger });

    expect(errors.pmCycleInterval).toBe(t.cycleRequired);
    expect(errors.pmCycleUnitCode).toBe(t.cycleRequired);
  });

  it.each(['NONE', 'SHOT'])('%s 이면 주기를 요구하지 않는다', (trigger) => {
    const errors = validate({ pmTriggerTypeCode: trigger });

    expect(errors.pmCycleInterval).toBeUndefined();
    expect(errors.pmCycleUnitCode).toBeUndefined();
  });

  it('두 칸이 차면 통과한다', () => {
    expect(
      validate({ pmTriggerTypeCode: 'BOTH', pmCycleInterval: '6', pmCycleUnitCode: 'MONTH' }),
    ).toEqual({});
  });

  it.each(['0', '-1', '1.5', 'x'])('주기 간격 %s 은 1 이상의 정수가 아니다', (value) => {
    expect(
      validate({ pmTriggerTypeCode: 'DATE', pmCycleInterval: value, pmCycleUnitCode: 'DAY' })
        .pmCycleInterval,
    ).toBe(t.intervalPositiveInteger);
  });

  /* 「비었다」와 「셀 수 없는 값이다」는 고칠 것이 달라 다른 말로 짚는다. */
  it('빈 칸과 잘못된 값을 다른 말로 짚는다', () => {
    expect(t.cycleRequired).not.toBe(t.intervalPositiveInteger);
  });
});

describe('TOOL_FORM_FIELDS', () => {
  /*
   * ⛔ **오류를 그릴 자리가 없는 칸을 넣으면 그 오류는 어디에도 표시되지 않는다.**
   * 아홉 이름이 모두 입력칸을 가진다는 것이 이 목록의 전제다.
   */
  it('폼 값의 이름과 정확히 같은 아홉이다', () => {
    expect([...TOOL_FORM_FIELDS].sort()).toEqual(Object.keys(make()).sort());
  });
});

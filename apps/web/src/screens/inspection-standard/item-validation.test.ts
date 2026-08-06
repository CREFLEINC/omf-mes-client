import { describe, expect, it } from 'vitest';

import { inspectionItemSpecFixtures } from './fixtures';
import { toItemDrafts } from './item-order';
import { hasInvalidItemDraft, validateItemDraft, warnItemDraft } from './item-validation';
import type { ItemDraft } from './types';

const saved = (): ItemDraft[] => toItemDrafts(inspectionItemSpecFixtures);

const draft = (overrides: Partial<ItemDraft> = {}): ItemDraft => ({
  draftId: 'new:1',
  inspectionItemSpecId: null,
  inspectionItemCode: 'SYN-ITEM-CODE-09',
  inspectionItemName: '합성 항목 Z',
  dataTypeCode: 'PENDING',
  uomId: '',
  targetValue: '',
  lowerLimit: '',
  upperLimit: '',
  measurementCount: '1',
  inspectionMethodCode: '',
  defaultInspectionEquipmentId: '',
  requiredFlag: true,
  automaticJudgment: true,
  ...overrides,
});

describe('validateItemDraft — 필수', () => {
  it('필수를 채우면 오류가 없다', () => {
    expect(validateItemDraft(draft(), [])).toEqual({});
  });

  it('항목코드·항목명이 비면 필수 오류를 낸다', () => {
    const errors = validateItemDraft(
      draft({ inspectionItemCode: '', inspectionItemName: '' }),
      [],
    );

    expect(errors.inspectionItemCode).toBe('필수 입력 항목입니다.');
    expect(errors.inspectionItemName).toBe('필수 입력 항목입니다.');
  });
});

describe('validateItemDraft — 항목코드 중복', () => {
  /*
   * 계약이 버전 내 유일 제약을 두지 않았다 — 막는 곳이 화면과 서버뿐이다.
   * 중복이 저장되면 측정 기록이 어느 항목의 것인지 가릴 수 없다.
   */
  it('같은 코드가 다른 행에 있으면 막는다', () => {
    const errors = validateItemDraft(draft({ inspectionItemCode: 'SYN-ITEM-CODE-01' }), saved());

    expect(errors.inspectionItemCode).toBe(
      '같은 항목코드가 이 버전에 이미 있습니다. 다른 코드를 입력하세요.',
    );
  });

  /* 수정할 때 자기 코드가 그대로여도 통과해야 한다. */
  it('자기 자신은 중복으로 세지 않는다', () => {
    const list = saved();
    const target = list[0]!;

    expect(validateItemDraft(target, list).inspectionItemCode).toBeUndefined();
  });

  it('앞뒤 공백만 다른 코드도 중복으로 본다', () => {
    const errors = validateItemDraft(draft({ inspectionItemCode: ' SYN-ITEM-CODE-01 ' }), saved());

    expect(errors.inspectionItemCode).toBeDefined();
  });
});

describe('validateItemDraft — 상하한', () => {
  /* 계약 ck_inspection_limits — 데이터베이스가 막는다. 먼저 막는 것이 사용자에게 이롭다. */
  it('상한이 하한보다 작으면 두 칸 모두에 오류를 낸다', () => {
    const errors = validateItemDraft(draft({ lowerLimit: '11', upperLimit: '9' }), []);

    expect(errors.lowerLimit).toBe('상한은 하한과 같거나 그보다 커야 합니다.');
    expect(errors.upperLimit).toBe('상한은 하한과 같거나 그보다 커야 합니다.');
  });

  it('상한과 하한이 같으면 통과한다', () => {
    expect(validateItemDraft(draft({ lowerLimit: '10', upperLimit: '10' }), [])).toEqual({});
  });

  /* 계약: 둘 다 있을 때만 성립하는 제약이다 — 한쪽만 있으면 막지 않는다. */
  it('한쪽만 있으면 막지 않는다', () => {
    expect(validateItemDraft(draft({ lowerLimit: '11' }), [])).toEqual({});
    expect(validateItemDraft(draft({ upperLimit: '9' }), [])).toEqual({});
  });
});

describe('validateItemDraft — 측정 횟수', () => {
  /* 계약 CHECK > 0. 표본 번호의 상한이라 정수여야 한다. */
  it('0·음수·소수·문자를 막는다', () => {
    expect(validateItemDraft(draft({ measurementCount: '0' }), []).measurementCount).toBe(
      '측정 횟수는 1 이상의 정수여야 합니다.',
    );
    expect(validateItemDraft(draft({ measurementCount: '-1' }), []).measurementCount).toBeDefined();
    expect(validateItemDraft(draft({ measurementCount: '1.5' }), []).measurementCount).toBeDefined();
    expect(validateItemDraft(draft({ measurementCount: '한' }), []).measurementCount).toBeDefined();
  });

  it('비어 있으면 필수 오류를 낸다', () => {
    expect(validateItemDraft(draft({ measurementCount: '' }), []).measurementCount).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('1 이상의 정수를 통과시킨다', () => {
    expect(validateItemDraft(draft({ measurementCount: '5' }), []).measurementCount).toBeUndefined();
  });
});

describe('warnItemDraft — 목표값 범위', () => {
  /*
   * **경고이지 차단이 아니다.** 계약이 목표값 범위 밖을 데이터베이스로 막지 않고
   * 서버가 경고 등급으로 다룬다 — 화면이 막으면 서버가 허용한 값을 넣을 방법이 없어진다.
   */
  it('목표값이 범위 밖이면 경고를 낸다', () => {
    const warnings = warnItemDraft(draft({ targetValue: '12', lowerLimit: '9', upperLimit: '11' }));

    expect(warnings.targetValue).toBe('목표값이 하한~상한 밖입니다. 의도한 값인지 확인하세요.');
  });

  it('하한보다 작아도 경고를 낸다', () => {
    expect(
      warnItemDraft(draft({ targetValue: '8', lowerLimit: '9', upperLimit: '11' })).targetValue,
    ).toBeDefined();
  });

  it('범위 안이면 경고가 없다', () => {
    expect(warnItemDraft(draft({ targetValue: '10', lowerLimit: '9', upperLimit: '11' }))).toEqual(
      {},
    );
  });

  it('한쪽만 있어도 그 쪽만으로 판정한다', () => {
    expect(warnItemDraft(draft({ targetValue: '8', lowerLimit: '9' })).targetValue).toBeDefined();
    expect(warnItemDraft(draft({ targetValue: '12', upperLimit: '11' })).targetValue).toBeDefined();
  });

  it('목표값이 없으면 경고가 없다', () => {
    expect(warnItemDraft(draft({ lowerLimit: '9', upperLimit: '11' }))).toEqual({});
  });

  /* 경고를 차단으로 올리면 서버가 허용한 값을 넣을 수 없다. */
  it('범위 밖 목표값을 차단 검증이 막지 않는다', () => {
    expect(
      validateItemDraft(draft({ targetValue: '12', lowerLimit: '9', upperLimit: '11' }), []),
    ).toEqual({});
  });
});

describe('hasInvalidItemDraft', () => {
  it('모두 온전하면 거짓이다', () => {
    expect(hasInvalidItemDraft(saved())).toBe(false);
  });

  /*
   * 서버가 준 목록에 이미 중복이 있을 수 있다 — 화면이 만든 행만 검사하면
   * 옛 중복이 전체 치환에 실려 나가 저장 전체가 거부된다.
   */
  it('서버가 준 목록에 이미 중복 코드가 있으면 참이다', () => {
    const list = saved();
    list[1] = { ...list[1]!, inspectionItemCode: list[0]!.inspectionItemCode };

    expect(hasInvalidItemDraft(list)).toBe(true);
  });

  it('값이 어긋난 행이 섞여 있으면 참이다', () => {
    expect(hasInvalidItemDraft([...saved(), draft({ inspectionItemCode: '' })])).toBe(true);
  });

  /* 경고는 저장을 막지 않는다. */
  it('경고만 있는 목록은 거짓이다', () => {
    expect(
      hasInvalidItemDraft([draft({ targetValue: '12', lowerLimit: '9', upperLimit: '11' })]),
    ).toBe(false);
  });
});

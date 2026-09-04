import { describe, expect, it } from 'vitest';

import { itemFixtures } from './fixtures';
import { itemToAttrsFormValues } from './item-attrs-mappers';
import { ITEM_ATTRS_FORM_FIELDS, validateItemAttrsForm } from './item-attrs-validation';
import type { ItemAttrsFormValues } from './types';

const base = itemToAttrsFormValues(itemFixtures[0]!);

const withValues = (patch: Partial<ItemAttrsFormValues>): ItemAttrsFormValues => ({
  ...base,
  ...patch,
});

describe('ITEM_ATTRS_FORM_FIELDS', () => {
  /* 대응하는 입력칸이 없는 필드의 오류를 인라인으로 내면 어디에도 표시되지 않는다. */
  it('화면에 컨트롤이 없는 사용 여부를 담지 않는다', () => {
    expect(ITEM_ATTRS_FORM_FIELDS).not.toContain('isActive');
  });

  /* 계약 필드가 아닌 이름을 서버 오류 대조에 쓰면 영영 맞지 않는다. */
  it('계약 필드가 아닌 토글 이름을 담지 않는다', () => {
    expect(ITEM_ATTRS_FORM_FIELDS).not.toContain('shelfLifeManaged');
  });

  it('최신 계약의 편집 필드를 담는다', () => {
    for (const field of [
      'nameKo',
      'nameVi',
      'developmentItem',
      'defaultLotStorageUomId',
      'defaultProductionLotSize',
    ]) {
      expect(ITEM_ATTRS_FORM_FIELDS).toContain(field);
    }
  });
});

describe('validateItemAttrsForm — LOT 기본값', () => {
  it('보관 단위는 비우거나 양의 정수 식별자를 선택한다', () => {
    expect(validateItemAttrsForm(withValues({ defaultLotStorageUomId: '' }))).toEqual({});
    expect(validateItemAttrsForm(withValues({ defaultLotStorageUomId: '7003' }))).toEqual({});

    for (const value of ['0', '-1', '1.5', 'abc']) {
      expect(validateItemAttrsForm(withValues({ defaultLotStorageUomId: value }))).toHaveProperty(
        'defaultLotStorageUomId',
      );
    }
  });

  it('생산 LOT 기본크기는 비우거나 유한한 숫자다', () => {
    expect(validateItemAttrsForm(withValues({ defaultProductionLotSize: '' }))).toEqual({});
    expect(validateItemAttrsForm(withValues({ defaultProductionLotSize: '0.5' }))).toEqual({});
    expect(
      validateItemAttrsForm(withValues({ defaultProductionLotSize: 'not-a-number' })),
    ).toHaveProperty('defaultProductionLotSize');
  });
});

describe('validateItemAttrsForm — 필수 코드', () => {
  it('조회한 값 그대로는 통과한다', () => {
    expect(validateItemAttrsForm(base)).toEqual({});
  });

  it.each(['serialControlTypeCode', 'fifoPolicyCode'] as const)(
    '%s가 비면 필수 오류다',
    (field) => {
      expect(validateItemAttrsForm(withValues({ [field]: '' }))).toHaveProperty(field);
    },
  );

  it.each(['serialControlTypeCode', 'fifoPolicyCode'] as const)(
    '%s가 공백만이면 필수 오류다',
    (field) => {
      expect(validateItemAttrsForm(withValues({ [field]: '   ' }))).toHaveProperty(field);
    },
  );

  /* 상한 자체는 허용값이며 그것을 넘을 때만 막는다. */
  it('코드 50자는 통과하고 51자는 막힌다', () => {
    expect(validateItemAttrsForm(withValues({ serialControlTypeCode: 'a'.repeat(50) }))).toEqual(
      {},
    );
    expect(
      validateItemAttrsForm(withValues({ serialControlTypeCode: 'a'.repeat(51) })),
    ).toHaveProperty('serialControlTypeCode');
  });

  /*
   * 값 목록이 확정되지 않았다 — 화면이 없는 목록을 흉내 내면 서버가 허용하는 값을 막는다.
   * 선출 정책도 서버가 준 값이 목록 밖일 수 있다.
   */
  it('코드가 어떤 목록에 속하는지 검사하지 않는다', () => {
    expect(
      validateItemAttrsForm(
        withValues({ serialControlTypeCode: 'SYN-ANY-CODE', fifoPolicyCode: 'SYN-POLICY-X' }),
      ),
    ).toEqual({});
  });
});

/**
 * M05 — 유효기한 토글 ON에 값이 비면 요청이 없다.
 * 로컬 조건부 필수를 빼고 서버 400에 맡기면 여기서 잡힌다.
 */
describe('validateItemAttrsForm — 유효기한 조건부 필수 (M05)', () => {
  it('토글이 켜져 있는데 비면 오류다', () => {
    expect(
      validateItemAttrsForm(withValues({ shelfLifeManaged: true, shelfLifeDays: '' })),
    ).toHaveProperty('shelfLifeDays');
  });

  /* 토글이 꺼져 있으면 값 칸이 무엇이든 저장할 때 널이 실린다. */
  it('토글이 꺼져 있으면 값이 없어도 통과한다', () => {
    expect(
      validateItemAttrsForm(withValues({ shelfLifeManaged: false, shelfLifeDays: '' })),
    ).toEqual({});
  });

  it('토글이 꺼져 있으면 값이 이상해도 막지 않는다 — 보내지 않을 값이다', () => {
    expect(
      validateItemAttrsForm(withValues({ shelfLifeManaged: false, shelfLifeDays: 'abc' })),
    ).toEqual({});
  });

  /* 계약 `minimum: 0` — 0은 허용값이다. 「비었다」로 다루면 정상 입력이 막힌다. */
  it('0은 허용값이다', () => {
    expect(
      validateItemAttrsForm(withValues({ shelfLifeManaged: true, shelfLifeDays: '0' })),
    ).toEqual({});
  });

  it.each(['-1', '1.5', 'abc', '1일'])('%s는 정수가 아니라 막힌다', (value) => {
    expect(
      validateItemAttrsForm(withValues({ shelfLifeManaged: true, shelfLifeDays: value })),
    ).toHaveProperty('shelfLifeDays');
  });
});

/**
 * M06 — `openedShelfLifeHours` 0을 거부한다.
 *
 * 계약이 `exclusiveMinimum: 0`으로 두었다 — `shelfLifeDays`의 `minimum: 0`과 **규칙이 다르다.**
 * 둘을 한 규칙으로 뭉치면 반드시 하나가 어긋난다.
 */
describe('validateItemAttrsForm — 개봉 후 유효시간 (M06)', () => {
  it('0을 거부한다', () => {
    expect(validateItemAttrsForm(withValues({ openedShelfLifeHours: '0' }))).toHaveProperty(
      'openedShelfLifeHours',
    );
  });

  it('1은 통과한다', () => {
    expect(validateItemAttrsForm(withValues({ openedShelfLifeHours: '1' }))).toEqual({});
  });

  /* 계약이 널을 허용한다 — 비우는 것이 정상 값이다. */
  it('비우면 통과한다', () => {
    expect(validateItemAttrsForm(withValues({ openedShelfLifeHours: '' }))).toEqual({});
  });

  it.each(['-1', '0.5', 'abc'])('%s는 막힌다', (value) => {
    expect(validateItemAttrsForm(withValues({ openedShelfLifeHours: value }))).toHaveProperty(
      'openedShelfLifeHours',
    );
  });

  /* 같은 입력에서 두 필드의 답이 갈리는 것이 이 규칙의 핵심이다. */
  it('0에 대해 유효기한(일)과 답이 갈린다', () => {
    const values = withValues({
      shelfLifeManaged: true,
      shelfLifeDays: '0',
      openedShelfLifeHours: '0',
    });
    const errors = validateItemAttrsForm(values);

    expect(errors).not.toHaveProperty('shelfLifeDays');
    expect(errors).toHaveProperty('openedShelfLifeHours');
  });
});

describe('validateItemAttrsForm — 보관 조건', () => {
  it('비우면 통과한다 — 계약이 널을 허용한다', () => {
    expect(validateItemAttrsForm(withValues({ storageConditionCode: '' }))).toEqual({});
  });

  it('50자를 넘으면 막힌다', () => {
    expect(
      validateItemAttrsForm(withValues({ storageConditionCode: 'a'.repeat(51) })),
    ).toHaveProperty('storageConditionCode');
  });
});

/**
 * 이슈 #14 §4 — 유효기한 관리와 선출 정책을 **연동하지 않는다.**
 * 경고도 내지 않는다: 경고는 자동 연동의 절반이라 무엇이 강제인지 알 수 없게 된다.
 */
describe('validateItemAttrsForm — 유효기한과 선출 정책을 연동하지 않는다', () => {
  it('유효기한을 관리하는데 FIFO여도 막지 않는다', () => {
    expect(
      validateItemAttrsForm(
        withValues({ shelfLifeManaged: true, shelfLifeDays: '30', fifoPolicyCode: 'FIFO' }),
      ),
    ).toEqual({});
  });

  it('유효기한을 관리하지 않는데 FEFO여도 막지 않는다', () => {
    expect(
      validateItemAttrsForm(
        withValues({ shelfLifeManaged: false, shelfLifeDays: '', fifoPolicyCode: 'FEFO' }),
      ),
    ).toEqual({});
  });
});

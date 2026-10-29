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

  it('화면에 있는 편집 필드를 담는다', () => {
    for (const field of ['defaultLotStorageUomId', 'defaultProductionLotSize', 'fifoPolicyCode']) {
      expect(ITEM_ATTRS_FORM_FIELDS).toContain(field);
    }
  });

  /* 화면에서 뺀 칸(사용자 지시 2026-10-28)의 서버 오류는 배너로 — 보이지 않는 칸에 붙이면 아무도 못 본다. */
  it('화면에서 뺀 칸을 담지 않는다', () => {
    for (const field of [
      'nameKo',
      'nameVi',
      'developmentItem',
      'serialControlTypeCode',
      'openedShelfLifeHours',
      'storageConditionCode',
      'lotControlled',
    ]) {
      expect(ITEM_ATTRS_FORM_FIELDS).not.toContain(field);
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

  it.each(['fifoPolicyCode'] as const)('%s가 비면 필수 오류다', (field) => {
    expect(validateItemAttrsForm(withValues({ [field]: '' }))).toHaveProperty(field);
  });

  it.each(['fifoPolicyCode'] as const)('%s가 공백만이면 필수 오류다', (field) => {
    expect(validateItemAttrsForm(withValues({ [field]: '   ' }))).toHaveProperty(field);
  });

  /* 상한 자체는 허용값이며 그것을 넘을 때만 막는다. */
  it('코드 50자는 통과하고 51자는 막힌다', () => {
    expect(validateItemAttrsForm(withValues({ fifoPolicyCode: 'a'.repeat(50) }))).toEqual({});
    expect(validateItemAttrsForm(withValues({ fifoPolicyCode: 'a'.repeat(51) }))).toHaveProperty(
      'fifoPolicyCode',
    );
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

/* 화면에서 뺀 칸은 화면이 검사하지 않는다 — 조회한 값을 그대로 되돌려 싣는다(사용자 지시 2026-10-28). */
describe('validateItemAttrsForm — 화면에서 뺀 칸', () => {
  it('시리얼 관리 유형 · 개봉 후 유효시간 · 보관 조건이 무엇이든 막지 않는다', () => {
    expect(
      validateItemAttrsForm(
        withValues({
          serialControlTypeCode: '',
          openedShelfLifeHours: '0',
          storageConditionCode: 'a'.repeat(51),
        }),
      ),
    ).toEqual({});
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

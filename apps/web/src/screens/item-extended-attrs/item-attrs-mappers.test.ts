import { describe, expect, it } from 'vitest';

import { itemFixtures } from './fixtures';
import { isSameItemAttrsValues, itemToAttrsFormValues, toItemUpdate } from './item-attrs-mappers';
import type { Item, ItemAttrsFormValues } from './types';

const activeItem = itemFixtures[0]!;
const nullableItem = itemFixtures[1]!;
const inactiveItem = itemFixtures[2]!;

/** 계약이 `ItemUpdate`에 두는 키 아홉. 이 집합에서 하나라도 어긋나면 잡힌다. */
const UPDATE_KEYS = [
  'lotControlTypeCode',
  'serialControlTypeCode',
  'shelfLifeDays',
  'inspectionRequired',
  'fifoPolicyCode',
  'negativeStockAllowed',
  'storageConditionCode',
  'openedShelfLifeHours',
  'isActive',
];

/** 외부 시스템이 소유하는 열. 요청 본문에 하나라도 실리면 안 된다. */
const ORIGIN_KEYS = ['itemCode', 'itemName', 'itemTypeCode', 'baseUomId', 'itemId'];

describe('itemToAttrsFormValues', () => {
  it('계약 표현을 폼 표현으로 옮긴다', () => {
    expect(itemToAttrsFormValues(activeItem)).toEqual<ItemAttrsFormValues>({
      lotControlTypeCode: 'SYN-LOT-01',
      serialControlTypeCode: 'NONE',
      shelfLifeManaged: true,
      shelfLifeDays: '30',
      inspectionRequired: true,
      fifoPolicyCode: 'FIFO',
      negativeStockAllowed: false,
      storageConditionCode: 'SYN-STORAGE-01',
      openedShelfLifeHours: '48',
    });
  });

  /* 계약에 「유효기한 관리」 컬럼이 없다 — `shelfLifeDays`의 널 여부가 그 토글이다. */
  it('유효기한이 널이면 관리 토글이 꺼진다', () => {
    const values = itemToAttrsFormValues(nullableItem);

    expect(values.shelfLifeManaged).toBe(false);
    expect(values.shelfLifeDays).toBe('');
  });

  /* 0은 「비었다」가 아니다 — 계약 `minimum: 0`이라 0도 관리 중인 값이다. */
  it('유효기한이 0이면 관리 토글이 켜진다', () => {
    const values = itemToAttrsFormValues(inactiveItem);

    expect(values.shelfLifeManaged).toBe(true);
    expect(values.shelfLifeDays).toBe('0');
  });

  it('널 선택 항목을 빈 문자열로 모은다', () => {
    const values = itemToAttrsFormValues(nullableItem);

    expect(values.storageConditionCode).toBe('');
    expect(values.openedShelfLifeHours).toBe('');
  });
});

/**
 * M02 — 확장 저장 본문에 원본 4열이 없다.
 *
 * 서버가 이 경계를 막지 않는다(계약 실측 P — 원본 열을 섞어 보내도 200이다).
 * 매퍼가 키를 열거해 만들지 않고 폼을 스프레드하면 여기서 잡힌다.
 */
describe('toItemUpdate — 원본 열이 실리지 않는다 (M02)', () => {
  it('키 집합이 계약의 아홉과 정확히 같다', () => {
    const body = toItemUpdate(itemToAttrsFormValues(activeItem), activeItem);

    expect(Object.keys(body).sort()).toEqual([...UPDATE_KEYS].sort());
  });

  it('원본 4열과 번호를 담지 않는다', () => {
    const body = toItemUpdate(itemToAttrsFormValues(activeItem), activeItem);

    for (const key of ORIGIN_KEYS) {
      expect(body).not.toHaveProperty(key);
    }
  });
});

/**
 * M03 — 확장 저장 본문의 `isActive`가 조회값이다.
 *
 * 계약이 이 값을 요청에 필수로 요구하는데 「사용 중지 액션이 화면에 없다」고 같은 계약이 못 박았다 —
 * `true`로 굳히면 **미사용 품목이 저장하는 순간 조용히 되살아난다.**
 */
describe('toItemUpdate — isActive를 되돌려 싣는다 (M03)', () => {
  it('사용 중인 품목은 사용 중으로 실린다', () => {
    expect(toItemUpdate(itemToAttrsFormValues(activeItem), activeItem).isActive).toBe(true);
  });

  it('미사용 품목은 미사용 그대로 실린다 — 되살아나지 않는다', () => {
    expect(toItemUpdate(itemToAttrsFormValues(inactiveItem), inactiveItem).isActive).toBe(false);
  });

  /* 출처는 폼이 아니라 조회 결과다 — 폼을 아무리 고쳐도 이 값은 따라오지 않는다. */
  it('폼을 고쳐도 사용 여부는 조회한 값을 따른다', () => {
    const edited: ItemAttrsFormValues = {
      ...itemToAttrsFormValues(inactiveItem),
      lotControlTypeCode: 'SYN-LOT-99',
    };

    expect(toItemUpdate(edited, inactiveItem).isActive).toBe(false);
  });
});

/**
 * M04 — 유효기한 토글 OFF면 `shelfLifeDays`가 널이다.
 * 토글 OFF는 「값을 비운다」가 아니라 「유효기한을 관리하지 않는다」다.
 */
describe('toItemUpdate — 유효기한 (M04)', () => {
  it('토글을 끄면 이전 값이 남아 있어도 널이 실린다', () => {
    const values: ItemAttrsFormValues = {
      ...itemToAttrsFormValues(activeItem),
      shelfLifeManaged: false,
    };

    expect(toItemUpdate(values, activeItem).shelfLifeDays).toBeNull();
    // 키를 빼면 서버가 이전 값을 남길 수 있다 — 널을 명시한다.
    expect(Object.keys(toItemUpdate(values, activeItem))).toContain('shelfLifeDays');
  });

  it('토글이 켜져 있으면 숫자로 실린다', () => {
    expect(toItemUpdate(itemToAttrsFormValues(activeItem), activeItem).shelfLifeDays).toBe(30);
  });

  /* 0은 허용값이다 — 계약 `minimum: 0`. 0을 널로 바꾸면 관리 상태가 뒤집힌다. */
  it('0도 그대로 0으로 실린다', () => {
    expect(toItemUpdate(itemToAttrsFormValues(inactiveItem), inactiveItem).shelfLifeDays).toBe(0);
  });
});

describe('toItemUpdate — 널 허용 항목', () => {
  it('비운 선택 항목은 키를 빼지 않고 널을 명시한다', () => {
    const body = toItemUpdate(itemToAttrsFormValues(nullableItem), nullableItem);

    expect(body.storageConditionCode).toBeNull();
    expect(body.openedShelfLifeHours).toBeNull();
    expect(Object.keys(body)).toContain('storageConditionCode');
    expect(Object.keys(body)).toContain('openedShelfLifeHours');
  });

  it('값이 있으면 숫자·문자열로 실린다', () => {
    const body = toItemUpdate(itemToAttrsFormValues(activeItem), activeItem);

    expect(body.storageConditionCode).toBe('SYN-STORAGE-01');
    expect(body.openedShelfLifeHours).toBe(48);
  });

  /* 앞뒤 공백이 붙은 코드는 눈으로 구분되지 않는 다른 값이 된다. */
  it('코드의 앞뒤 공백을 턴다', () => {
    const values: ItemAttrsFormValues = {
      ...itemToAttrsFormValues(activeItem),
      lotControlTypeCode: '  SYN-LOT-01  ',
      fifoPolicyCode: ' FEFO ',
      storageConditionCode: '  ',
    };
    const body = toItemUpdate(values, activeItem);

    expect(body.lotControlTypeCode).toBe('SYN-LOT-01');
    expect(body.fifoPolicyCode).toBe('FEFO');
    // 공백만 남은 칸은 「지정하지 않음」이다.
    expect(body.storageConditionCode).toBeNull();
  });
});

describe('isSameItemAttrsValues', () => {
  it('같은 값이면 참이다', () => {
    expect(
      isSameItemAttrsValues(itemToAttrsFormValues(activeItem), itemToAttrsFormValues(activeItem)),
    ).toBe(true);
  });

  /* 아홉 필드 중 하나라도 빠뜨리면 「고친 것이 없다」로 읽혀 저장 버튼이 열리지 않는다. */
  it.each([
    ['lotControlTypeCode', { lotControlTypeCode: 'SYN-LOT-99' }],
    ['serialControlTypeCode', { serialControlTypeCode: 'SYN-SERIAL-99' }],
    ['shelfLifeManaged', { shelfLifeManaged: false }],
    ['shelfLifeDays', { shelfLifeDays: '90' }],
    ['inspectionRequired', { inspectionRequired: false }],
    ['fifoPolicyCode', { fifoPolicyCode: 'FEFO' }],
    ['negativeStockAllowed', { negativeStockAllowed: true }],
    ['storageConditionCode', { storageConditionCode: 'SYN-STORAGE-99' }],
    ['openedShelfLifeHours', { openedShelfLifeHours: '99' }],
  ])('%s가 달라지면 거짓이다', (_label, patch: Partial<ItemAttrsFormValues>) => {
    const base = itemToAttrsFormValues(activeItem);

    expect(isSameItemAttrsValues(base, { ...base, ...patch })).toBe(false);
  });
});

describe('toItemUpdate — 없는 값을 지어내지 않는다', () => {
  /* 서버가 선택 항목을 아예 내려주지 않는 경우도 계약이 허용한다. */
  it('응답에 선택 항목이 없어도 폼이 서지 않는 값을 만들지 않는다', () => {
    const sparse = {
      itemId: 2001,
      itemCode: 'SYN-ITEM-09',
      itemName: '합성 품목 I',
      itemTypeCode: 'SYN-TYPE-C',
      baseUomId: 7001,
      lotControlTypeCode: 'SYN-LOT-09',
      serialControlTypeCode: 'NONE',
      inspectionRequired: false,
      fifoPolicyCode: 'FIFO',
      negativeStockAllowed: false,
      isActive: true,
    } satisfies Item;

    const values = itemToAttrsFormValues(sparse);

    expect(values.shelfLifeManaged).toBe(false);
    expect(values.openedShelfLifeHours).toBe('');
    expect(toItemUpdate(values, sparse).shelfLifeDays).toBeNull();
  });
});

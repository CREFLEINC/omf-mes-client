import { describe, expect, it } from 'vitest';

import { itemLotDefaultOf, prefillBatch, type ItemLotDefault } from './material-lot-batch';

/**
 * 수동 [만들기] 창의 처음 값 순서(피처 014 FR-019 · plan D-6) — 품목 기본값(패키징 포함) → 품목 보관 단위 →
 * 빈 칸.
 */

const ITEM_DEFAULT: ItemLotDefault = {
  lotQty: 100,
  package: { uomId: 42, count: 10, qtyPerPackage: 10 },
};

const STORAGE = { uomId: 43, qtyPerPackage: 25 };

describe('FR-019 prefillBatch — 품목 기본값이 먼저', () => {
  it('FR-019 품목 기본값(패키징 포함)이 있으면 보관 단위보다 먼저 채운다', () => {
    const prefill = prefillBatch(ITEM_DEFAULT, STORAGE);

    expect(prefill.source).toBe('item');
    expect(prefill.draft).toMatchObject({
      packageOn: true,
      packageUomId: 42,
      packageCount: '10',
      qtyPerPackage: '10',
      lotQty: '100',
      lotQtyEdited: false,
    });
    expect(prefill.defaultWithoutPackage).toBe(false);
  });

  it('FR-019 품목 기본값에 패키징이 없으면 패키징 없이 수량만 채운다', () => {
    const prefill = prefillBatch({ lotQty: 500, package: null }, STORAGE);

    expect(prefill.source).toBe('item');
    expect(prefill.draft).toMatchObject({ packageOn: false, lotQty: '500', lotQtyEdited: true });
    /* 패키징 단위 칸은 보관 단위로 미리 골라 둔다 — 넣기로 바꾸면 바로 쓴다. */
    expect(prefill.draft.packageUomId).toBe(43);
    expect(prefill.defaultWithoutPackage).toBe(true);
  });

  it('FR-019 품목 기본값이 없으면 보관 단위 → 빈 칸 순이다', () => {
    expect(prefillBatch(null, STORAGE).source).toBe('itemStorage');
    expect(prefillBatch(null, STORAGE).draft).toMatchObject({
      packageUomId: 43,
      packageCount: '',
      qtyPerPackage: '25',
      lotQty: '',
    });
    expect(prefillBatch(null, null).source).toBe('none');
  });
});

describe('FR-019 itemLotDefaultOf — 품목 마스터에서 LOT 하나의 기본값', () => {
  const base = {
    baseUomId: 1,
    defaultLotStorageUomId: 1,
    defaultProductionLotSize: 100,
    defaultPackageUomId: 42,
    defaultPackageCount: 10,
  };

  it('US1-6 보관 단위가 기본 단위면 기본크기 그대로, 패키징은 수량 ÷ 패키징 수', () => {
    expect(itemLotDefaultOf(base, null)).toEqual({
      lotQty: 100,
      package: { uomId: 42, count: 10, qtyPerPackage: 10 },
    });
  });

  it('US1-6 패키징 기본값이 없으면 패키징 없음', () => {
    expect(
      itemLotDefaultOf({ ...base, defaultPackageUomId: null, defaultPackageCount: null }, null),
    ).toEqual({ lotQty: 100, package: null });
  });

  it('US1-4 보관 단위나 기본크기가 없으면 품목 기본값이 없다', () => {
    expect(itemLotDefaultOf({ ...base, defaultLotStorageUomId: null }, null)).toBeNull();
    expect(itemLotDefaultOf({ ...base, defaultProductionLotSize: null }, null)).toBeNull();
    expect(itemLotDefaultOf({ ...base, defaultProductionLotSize: 0 }, null)).toBeNull();
  });

  it('경계-환산 보관 단위가 다르면 환산(보관 → 기본)으로 바꾸고, 환산이 없으면 기본값이 없다', () => {
    const roll = { ...base, defaultLotStorageUomId: 5, defaultProductionLotSize: 2 };

    expect(itemLotDefaultOf(roll, 50)).toEqual({
      lotQty: 100,
      package: { uomId: 42, count: 10, qtyPerPackage: 10 },
    });
    expect(itemLotDefaultOf(roll, null)).toBeNull();
  });
});

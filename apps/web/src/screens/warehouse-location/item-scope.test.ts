import { describe, expect, it } from 'vitest';

import { itemTypesForWarehouse } from './item-scope';

describe('itemTypesForWarehouse', () => {
  it('창고 유형마다 고를 수 있는 품목 유형', () => {
    expect(itemTypesForWarehouse('MATERIAL')).toEqual(['RAW_MATERIAL', 'SUBSIDIARY_MATERIAL']);
    expect(itemTypesForWarehouse('PRODUCT')).toEqual(['FINISHED', 'SEMI_FINISHED', 'MERCHANDISE']);
    // 일반창고 · 표에 없는 유형은 제한 없음, 예비품창고는 보관 품목을 두지 않는다.
    expect(itemTypesForWarehouse('GENERAL')).toEqual([]);
    expect(itemTypesForWarehouse('CUSTOM')).toEqual([]);
    expect(itemTypesForWarehouse('SPARE_PART')).toBeNull();
  });
});

import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { toBalanceView, toGroupKey, toLotDetailView, toRowKey } from './types';

describe('toBalanceView', () => {
  it('선택 필드가 없으면 null로 모은다', () => {
    const response: components['schemas']['InventoryBalance'] = {
      groupBy: 'ITEM',
      itemId: 9301,
      ownershipTypeCode: 'SAMPLE_OWN_A',
      onHandQty: 10,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 0,
      availableQty: 10,
      uomId: 9501,
    };

    const view = toBalanceView(response);

    expect(view.inventoryBalanceId).toBeNull();
    expect(view.warehouseId).toBeNull();
    expect(view.locationId).toBeNull();
    expect(view.lotId).toBeNull();
    expect(view.qualityStatusCode).toBeNull();
    expect(view.inventoryStatusCode).toBeNull();
    expect(view.heldLotCount).toBeNull();
  });

  it('서버가 계산한 가용 수량을 다시 계산하지 않고 그대로 옮긴다', () => {
    const response: components['schemas']['InventoryBalance'] = {
      groupBy: 'ITEM',
      itemId: 9301,
      ownershipTypeCode: 'SAMPLE_OWN_A',
      onHandQty: 100,
      reservedQty: 20,
      pickedQty: 5,
      blockedQty: 10,
      /* 보유-예약-피킹-보류(65)와 일부러 다른 값 — 화면이 다시 빼면 이 단언이 깨진다. */
      availableQty: 42,
      uomId: 9501,
    };

    expect(toBalanceView(response).availableQty).toBe(42);
  });

  it('0과 없음을 가른다', () => {
    const response: components['schemas']['InventoryBalance'] = {
      groupBy: 'ITEM',
      itemId: 9301,
      ownershipTypeCode: 'SAMPLE_OWN_A',
      onHandQty: 0,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 0,
      availableQty: 0,
      uomId: 9501,
      heldLotCount: 0,
    };

    expect(toBalanceView(response).heldLotCount).toBe(0);
  });
});

describe('toRowKey', () => {
  it('축을 가르는 필드 전부를 이어 겹치지 않는 키를 만든다', () => {
    const base = toBalanceView({
      groupBy: 'ITEM',
      itemId: 9301,
      ownershipTypeCode: 'SAMPLE_OWN_A',
      onHandQty: 1,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 0,
      availableQty: 1,
      uomId: 9501,
    });

    const other = toBalanceView({
      groupBy: 'ITEM',
      itemId: 9302,
      ownershipTypeCode: 'SAMPLE_OWN_A',
      onHandQty: 1,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 0,
      availableQty: 1,
      uomId: 9501,
    });

    expect(toRowKey(base)).not.toBe(toRowKey(other));
  });
});

describe('toGroupKey', () => {
  it('이름이 아니라 축의 식별자로 묶는다', () => {
    const row = toBalanceView({
      groupBy: 'LOT',
      itemId: 9301,
      lotId: 9401,
      ownershipTypeCode: 'SAMPLE_OWN_A',
      onHandQty: 1,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 0,
      availableQty: 1,
      uomId: 9501,
    });

    expect(toGroupKey(row, 'item')).toBe('9301');
  });
});

describe('toLotDetailView', () => {
  it('holds만 옮긴다 — lot·externalIdentifiers는 화면 타입에 없다', () => {
    const response: components['schemas']['LotDetailResponse'] = {
      lot: {
        lotId: 9401,
        lotNo: 'SAMPLE-LOT-0001',
        itemId: 9301,
        lotTypeCode: 'SAMPLE_LOT_T_A',
        plantId: 9001,
        statusCode: 'SAMPLE_LOT_S_A',
        sourceTypeCode: 'SAMPLE_SRC_T_A',
        sourceId: 9021,
        initialQty: 10,
        uomId: 9501,
      },
      externalIdentifiers: [
        {
          lotExternalIdentifierId: 9801,
          lotId: 9401,
          identifierTypeCode: 'SAMPLE_EXT_T_A',
          externalIdentifier: 'SAMPLE-EXT-0001',
        },
      ],
      holds: [
        {
          lotHoldId: 9701,
          lotId: 9401,
          reasonCode: 'SAMPLE_HOLD_R_A',
          statusCode: 'SAMPLE_HOLD_S_A',
          heldAt: '2026-08-06T09:12:00+09:00',
        },
      ],
    };

    const view = toLotDetailView(response);

    expect(view).toEqual({
      holds: [
        {
          lotHoldId: 9701,
          reasonCode: 'SAMPLE_HOLD_R_A',
          statusCode: 'SAMPLE_HOLD_S_A',
          heldAt: '2026-08-06T09:12:00+09:00',
          releaseCondition: null,
        },
      ],
    });
    expect(Object.keys(view)).toEqual(['holds']);
  });
});

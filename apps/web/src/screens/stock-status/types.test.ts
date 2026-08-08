import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { toBalanceView, toLotDetailView, toRowKey } from './types';

type InventoryBalanceResponse = components['schemas']['InventoryBalance'];
type LotDetailResponse = components['schemas']['LotDetailResponse'];

/** 계약이 필수로 정한 필드만 담은 최소 응답. 선택 필드가 통째로 빠진 형태다. */
const MINIMAL: InventoryBalanceResponse = {
  groupBy: 'ITEM',
  itemId: 9301,
  ownershipTypeCode: 'SAMPLE_OWN_A',
  onHandQty: 10,
  reservedQty: 2,
  pickedQty: 1,
  blockedQty: 0,
  availableQty: 7,
  uomId: 9501,
};

describe('toBalanceView — 응답을 화면 타입으로 옮기는 유일한 지점', () => {
  /*
   * 키가 없는 경우와 `null`인 경우를 화면이 갈라 다루면 같은 「받지 못했다」가 두 갈래로 흩어져
   * 대시·고유 표기 판정이 자리마다 달라진다. 여기서 한 번에 모은다.
   */
  it('빠진 선택 필드를 전부 null로 모은다', () => {
    const view = toBalanceView(MINIMAL);

    expect(view.inventoryBalanceId).toBeNull();
    expect(view.warehouseId).toBeNull();
    expect(view.locationId).toBeNull();
    expect(view.lotId).toBeNull();
    expect(view.qualityStatusCode).toBeNull();
    expect(view.inventoryStatusCode).toBeNull();
    expect(view.ownerPartnerId).toBeNull();
    expect(view.lastTransactionAt).toBeNull();
  });

  it('null로 온 선택 필드도 null이다', () => {
    const view = toBalanceView({ ...MINIMAL, lotId: null, ownerPartnerId: null });

    expect(view.lotId).toBeNull();
    expect(view.ownerPartnerId).toBeNull();
  });

  it('값이 있는 선택 필드는 그대로 옮긴다', () => {
    const view = toBalanceView({
      ...MINIMAL,
      groupBy: 'LOT',
      lotId: 9401,
      locationId: 9201,
      warehouseId: 9101,
      ownerPartnerId: 9601,
      qualityStatusCode: 'SAMPLE_Q_A',
      inventoryStatusCode: 'SAMPLE_I_A',
      lastTransactionAt: '2026-08-06T09:12:00+09:00',
    });

    expect(view.groupBy).toBe('LOT');
    expect(view.lotId).toBe(9401);
    expect(view.locationId).toBe(9201);
    expect(view.warehouseId).toBe(9101);
    expect(view.ownerPartnerId).toBe(9601);
    expect(view.qualityStatusCode).toBe('SAMPLE_Q_A');
    expect(view.inventoryStatusCode).toBe('SAMPLE_I_A');
    expect(view.lastTransactionAt).toBe('2026-08-06T09:12:00+09:00');
  });

  /* 수량 다섯은 서버가 준 값 그대로다. 화면이 어느 하나도 다시 계산하지 않는다. */
  it('수량 다섯을 그대로 옮긴다', () => {
    const view = toBalanceView({
      ...MINIMAL,
      onHandQty: -4,
      reservedQty: 2,
      pickedQty: 1,
      blockedQty: 3,
      availableQty: 99,
    });

    expect(view.onHandQty).toBe(-4);
    expect(view.reservedQty).toBe(2);
    expect(view.pickedQty).toBe(1);
    expect(view.blockedQty).toBe(3);
    /*
     * **서버가 준 값 그대로다.** 보유−예약−피킹−보류(-4−2−1−3 = -10)로 다시 계산하면
     * 이 단언이 깨진다 — 「가용 수량을 화면이 빼지 마세요」(이슈 #21 §6)를 값으로 고정한다.
     */
    expect(view.availableQty).toBe(99);
  });

  /* 계약이 선택으로 둔 값이라 없을 수 있다. 0과 「없음」을 가른다 — 0은 서버가 센 결과다. */
  it('보류 LOT 수는 없으면 null이고 0이면 0이다', () => {
    expect(toBalanceView(MINIMAL).heldLotCount).toBeNull();
    expect(toBalanceView({ ...MINIMAL, heldLotCount: 0 }).heldLotCount).toBe(0);
    expect(toBalanceView({ ...MINIMAL, heldLotCount: 2 }).heldLotCount).toBe(2);
  });
});

describe('toRowKey — 표의 행 식별자', () => {
  /*
   * `inventoryBalanceId`는 **축을 하나도 접지 않은 줄에만** 있다(계약). 묶인 줄에는 없으므로
   * 그것만으로 키를 만들면 같은 키가 여럿 생겨 쪽을 넘길 때 앞 쪽 행이 남아 보인다.
   */
  it('묶인 줄끼리 서로 다른 키를 만든다', () => {
    const first = toRowKey(toBalanceView({ ...MINIMAL, groupBy: 'LOT', lotId: 9401 }));
    const second = toRowKey(toBalanceView({ ...MINIMAL, groupBy: 'LOT', lotId: 9402 }));

    expect(first).not.toBe(second);
  });

  it('같은 품목이라도 상태·소유가 다르면 키가 다르다', () => {
    const owned = toRowKey(toBalanceView({ ...MINIMAL, ownershipTypeCode: 'SAMPLE_OWN_A' }));
    const consigned = toRowKey(toBalanceView({ ...MINIMAL, ownershipTypeCode: 'SAMPLE_OWN_B' }));
    const qualified = toRowKey(toBalanceView({ ...MINIMAL, qualityStatusCode: 'SAMPLE_Q_A' }));

    expect(owned).not.toBe(consigned);
    expect(owned).not.toBe(qualified);
  });

  it('같은 조합이면 같은 키다', () => {
    expect(toRowKey(toBalanceView(MINIMAL))).toBe(toRowKey(toBalanceView(MINIMAL)));
  });
});

/** 계약이 필수로 정한 필드만 담은 최소 LOT 상세. 선택 필드가 통째로 빠진 형태다. */
const MINIMAL_LOT_DETAIL: LotDetailResponse = {
  lot: {
    lotId: 9401,
    lotNo: 'SAMPLE-LOT-0001',
    itemId: 9301,
    lotTypeCode: 'SAMPLE_LOT_T_A',
    plantId: 9001,
    initialQty: 150,
    uomId: 9501,
    sourceTypeCode: 'SAMPLE_SRC_A',
    sourceId: 9701,
    statusCode: 'SAMPLE_LOT_S_A',
  },
  externalIdentifiers: [],
  holds: [],
};

describe('toLotDetailView — LOT 상세를 화면 타입으로 옮긴다', () => {
  it('빠진 선택 필드를 전부 null로 모은다', () => {
    const { lot } = toLotDetailView(MINIMAL_LOT_DETAIL);

    expect(lot.manufacturedAt).toBeNull();
    expect(lot.expiryDate).toBeNull();
    expect(lot.remarks).toBeNull();
  });

  it('null로 온 선택 필드도 null이다', () => {
    const { lot } = toLotDetailView({
      ...MINIMAL_LOT_DETAIL,
      lot: { ...MINIMAL_LOT_DETAIL.lot, expiryDate: null, remarks: null },
    });

    expect(lot.expiryDate).toBeNull();
    expect(lot.remarks).toBeNull();
  });

  it('값이 있는 필드는 그대로 옮긴다', () => {
    const { lot } = toLotDetailView({
      ...MINIMAL_LOT_DETAIL,
      lot: {
        ...MINIMAL_LOT_DETAIL.lot,
        manufacturedAt: '2026-08-06T09:12:00+09:00',
        expiryDate: '2027-08-06',
        remarks: '합성 비고',
      },
    });

    expect(lot.lotNo).toBe('SAMPLE-LOT-0001');
    expect(lot.lotTypeCode).toBe('SAMPLE_LOT_T_A');
    expect(lot.statusCode).toBe('SAMPLE_LOT_S_A');
    expect(lot.initialQty).toBe(150);
    expect(lot.uomId).toBe(9501);
    expect(lot.manufacturedAt).toBe('2026-08-06T09:12:00+09:00');
    expect(lot.expiryDate).toBe('2027-08-06');
    expect(lot.remarks).toBe('합성 비고');
  });

  /*
   * **`holdQty`가 없는 것과 0인 것을 가른다.** 계약이 「비어 있으면 전량 보류」로 정했고,
   * 0은 「아무것도 안 묶였다」라 정반대 뜻이다. 여기서 뭉개면 화면이 갈라 낼 방법이 없다.
   */
  it('보류 수량은 없으면 null이고 0이면 0이다', () => {
    const hold = {
      lotHoldId: 9801,
      lotId: 9401,
      reasonCode: 'SAMPLE_HOLD_R_A',
      statusCode: 'SAMPLE_HOLD_S_A',
      heldAt: '2026-08-06T09:12:00+09:00',
    };

    const [whole] = toLotDetailView({ ...MINIMAL_LOT_DETAIL, holds: [hold] }).holds;
    const [zero] = toLotDetailView({
      ...MINIMAL_LOT_DETAIL,
      holds: [{ ...hold, holdQty: 0 }],
    }).holds;
    const [partial] = toLotDetailView({
      ...MINIMAL_LOT_DETAIL,
      holds: [{ ...hold, holdQty: 40, uomId: 9501 }],
    }).holds;

    expect(whole?.holdQty).toBeNull();
    expect(whole?.uomId).toBeNull();
    expect(zero?.holdQty).toBe(0);
    expect(partial?.holdQty).toBe(40);
    expect(partial?.uomId).toBe(9501);
  });

  it('보류의 선택 문구를 null로 모은다', () => {
    const [hold] = toLotDetailView({
      ...MINIMAL_LOT_DETAIL,
      holds: [
        {
          lotHoldId: 9801,
          lotId: 9401,
          reasonCode: 'SAMPLE_HOLD_R_A',
          statusCode: 'SAMPLE_HOLD_S_A',
          heldAt: '2026-08-06T09:12:00+09:00',
        },
      ],
    }).holds;

    expect(hold?.releaseCondition).toBeNull();
    expect(hold?.remarks).toBeNull();
    expect(hold?.reasonCode).toBe('SAMPLE_HOLD_R_A');
  });

  it('외부 식별자의 발급처와 외부 시스템을 null로 모은다', () => {
    const [identifier] = toLotDetailView({
      ...MINIMAL_LOT_DETAIL,
      externalIdentifiers: [
        {
          lotExternalIdentifierId: 9901,
          lotId: 9401,
          identifierTypeCode: 'SAMPLE_EXT_T_A',
          externalIdentifier: 'SAMPLE-EXT-0001',
        },
      ],
    }).externalIdentifiers;

    expect(identifier?.partnerId).toBeNull();
    expect(identifier?.externalSystemCode).toBeNull();
    expect(identifier?.externalIdentifier).toBe('SAMPLE-EXT-0001');
  });

  it('여러 건을 순서 그대로 옮긴다', () => {
    const detail = toLotDetailView({
      ...MINIMAL_LOT_DETAIL,
      holds: [
        {
          lotHoldId: 9801,
          lotId: 9401,
          reasonCode: 'SAMPLE_HOLD_R_A',
          statusCode: 'SAMPLE_HOLD_S_A',
          heldAt: '2026-08-06T09:12:00+09:00',
        },
        {
          lotHoldId: 9802,
          lotId: 9401,
          reasonCode: 'SAMPLE_HOLD_R_B',
          statusCode: 'SAMPLE_HOLD_S_A',
          heldAt: '2026-08-07T09:12:00+09:00',
        },
      ],
    });

    expect(detail.holds.map((hold) => hold.lotHoldId)).toEqual([9801, 9802]);
  });
});

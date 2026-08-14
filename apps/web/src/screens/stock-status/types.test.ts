import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  sameNumberTransactionFixtures,
  transactionDetailResponse,
  transactionFixtures,
  transactionLineFixtures,
  transactionResponseFixtures,
} from './fixtures';
import {
  toBalanceView,
  toLotDetailView,
  toRowKey,
  toTransactionDetailView,
  toTransactionRowKey,
  toTransactionView,
  type TransactionView,
} from './types';

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
      /* 재고 상태만 합성값이 아니다 — **계약이 값을 넷으로 못박아** 다른 값은 타입이 막는다. */
      inventoryStatusCode: 'AVAILABLE',
      lastTransactionAt: '2026-08-06T09:12:00+09:00',
    });

    expect(view.groupBy).toBe('LOT');
    expect(view.lotId).toBe(9401);
    expect(view.locationId).toBe(9201);
    expect(view.warehouseId).toBe(9101);
    expect(view.ownerPartnerId).toBe(9601);
    expect(view.qualityStatusCode).toBe('SAMPLE_Q_A');
    expect(view.inventoryStatusCode).toBe('AVAILABLE');
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

type InventoryTransactionResponse = components['schemas']['InventoryTransaction'];

/** 계약이 필수로 정한 필드만 담은 최소 응답. 역처리 필드가 통째로 빠진 형태다. */
const MINIMAL_TRANSACTION: InventoryTransactionResponse = {
  inventoryTransactionId: 9901,
  businessDate: '2026-08-06',
  transactionNo: 'SAMPLE-IT-0001',
  transactionTypeCode: 'SAMPLE_TX_T_A',
  plantId: 9001,
  occurredAt: '2026-08-06T09:12:00+09:00',
  recordedAt: '2026-08-06T09:13:00+09:00',
  sourceDocumentTypeCode: 'SAMPLE_SRC_T_A',
  sourceDocumentId: 9021,
  statusCode: 'SAMPLE_TX_S_A',
};

describe('toTransactionView — 이력 한 줄을 옮기는 유일한 지점', () => {
  /*
   * **번호로만 이어진 필드를 옮기지 않는다**(#44). 담을 자리가 없으면 화면으로 샐 경로도 없다 —
   * 특히 `sourceDocumentId`는 그 이름을 풀 참조가 이 화면에 아예 없다.
   */
  it('원천 전표 번호와 공장 번호를 담지 않는다', () => {
    const view = toTransactionView(MINIMAL_TRANSACTION);

    expect(Object.keys(view)).not.toContain('sourceDocumentId');
    expect(Object.keys(view)).not.toContain('plantId');
    expect(Object.keys(view)).not.toContain('reversalOfTransactionId');
    /* 선행 단언 — 유형 코드는 옮긴다(전부 안 옮기면 위 단언이 저절로 통과한다). */
    expect(view.sourceDocumentTypeCode).toBe('SAMPLE_SRC_T_A');
  });

  /* 역처리 여부는 **있다·없다**로만 옮긴다 — 대상 거래의 번호를 이 자리에서 버린다. */
  it('역처리 대상이 있으면 표식만 참이 된다', () => {
    expect(toTransactionView(MINIMAL_TRANSACTION).isReversal).toBe(false);
    expect(
      toTransactionView({ ...MINIMAL_TRANSACTION, reversalOfTransactionId: 9900 }).isReversal,
    ).toBe(true);
    /* `null`로 온 경우도 「없다」다 — 키 부재와 갈라 두면 판정이 자리마다 달라진다. */
    expect(
      toTransactionView({ ...MINIMAL_TRANSACTION, reversalOfTransactionId: null }).isReversal,
    ).toBe(false);
  });
});

describe('toTransactionDetailView — 거래 상세를 옮기는 유일한 지점', () => {
  /* 바깥 키 이름이 계약과 다르다(`inventoryTransaction` → `transaction`). */
  it('헤더와 라인을 화면 타입으로 옮긴다', () => {
    const view = toTransactionDetailView(transactionDetailResponse());

    expect(view.transaction.transactionNo).toBe('SAMPLE-IT-0001');
    expect(view.lines).toHaveLength(3);
  });

  /*
   * **화면이 쓰지 않는 라인 필드를 담지 않는다.** 담아 두면 다음 사람이 「이미 있으니
   * 그리자」로 읽어 열이 늘고, 축 열이 짓눌린다(계획 결정 13-2와 같은 갈래).
   */
  it('이동 전후 상태·시점 잔액·소유를 담지 않는다', () => {
    const [line] = toTransactionDetailView(transactionDetailResponse()).lines;

    for (const key of [
      'toQualityStatusCode',
      'toInventoryStatusCode',
      'toQtyAfterTransaction',
      'fromQtyAfterTransaction',
      'ownershipTypeCode',
      'ownerPartnerId',
      'handlingUnitId',
    ]) {
      expect(Object.keys(line ?? {})).not.toContain(key);
    }

    /* 선행 단언 — 그리는 필드는 옮긴다. */
    expect(line?.qty).toBe(120);
  });

  /* 입고 라인에는 출발지가 없다 — 빠진 키와 `null`을 한 갈래로 모은다. */
  it('빠진 이동 전후 필드를 null로 모은다', () => {
    const [receipt] = toTransactionDetailView(transactionDetailResponse()).lines;

    expect(receipt?.fromWarehouseId).toBeNull();
    expect(receipt?.fromLocationId).toBeNull();
    expect(receipt?.toWarehouseId).toBe(9101);
  });

  /*
   * **계약 모양 픽스처와 화면 타입 픽스처가 짝이다.** 둘을 따로 적어 두었으므로 한쪽만
   * 고쳐지면 부품 테스트가 계약과 다른 값을 검사하게 된다 — 여기서 값으로 묶어 둔다.
   */
  it('계약 모양 픽스처를 옮기면 화면 타입 픽스처와 같다', () => {
    expect(toTransactionDetailView(transactionDetailResponse())).toEqual(transactionLineFixtures());
    expect(transactionResponseFixtures.map(toTransactionView)).toEqual(transactionFixtures);
  });
});

describe('toTransactionRowKey — 이력 표의 행 식별자', () => {
  /*
   * **번호만으로는 행이 겹친다.** 원장이 영업일로 나뉘어 저장되고 계약이 영업일을 식별자의
   * 일부로 두어 같은 번호가 다른 영업일에 설 수 있다 — 겹치면 React가 두 행을 같은 것으로
   * 보아 쪽을 넘길 때 앞 쪽의 행이 남아 보인다.
   */
  it('번호가 같아도 영업일이 다르면 키가 다르다', () => {
    const [first, second] = sameNumberTransactionFixtures;

    /* 선행 단언 — 두 줄의 번호가 실제로 같다(다르면 아래 단언이 저절로 통과한다). */
    expect(first?.inventoryTransactionId).toBe(second?.inventoryTransactionId);
    expect(first?.businessDate).not.toBe(second?.businessDate);

    expect(toTransactionRowKey(first as TransactionView)).not.toBe(
      toTransactionRowKey(second as TransactionView),
    );
  });

  /* 짝 방향 — 같은 줄은 같은 키다. 아니면 다시 그릴 때마다 행이 통째로 새로 만들어진다. */
  it('같은 줄은 같은 키다', () => {
    const [first] = sameNumberTransactionFixtures;

    expect(toTransactionRowKey(first as TransactionView)).toBe(
      toTransactionRowKey({ ...(first as TransactionView) }),
    );
  });

  /* 키에 영업일과 번호가 **둘 다** 들어 있다 — 한 조각이 빠지면 위 두 단언 중 하나가 죽는다. */
  it('영업일과 번호를 함께 잇는다', () => {
    expect(toTransactionRowKey(transactionFixtures[0] as TransactionView)).toBe('2026-08-06:9901');
  });
});

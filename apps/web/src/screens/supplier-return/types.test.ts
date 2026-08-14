import { describe, expect, it } from 'vitest';

import {
  formatDateTime,
  toBalanceView,
  toReceiptLineView,
  toReceiptView,
  type BalanceResponse,
  type ReceiptLineResponse,
  type ReceiptResponse,
} from './types';

/**
 * 응답 → 화면 타입 변환.
 *
 * **이 파일의 감지기가 지키는 것은 「담지 않는다」다.** 화면이 쓰지 않는 값을 타입에 두면
 * 그 번호가 화면으로 샐 경로가 생긴다(#44). 옮기는 자리가 한 곳이라 그 한 곳만 재면 된다.
 */

const receiptResponse: ReceiptResponse = {
  goodsReceiptId: 9001,
  goodsReceiptNo: 'GR-2026-900001',
  receiptTypeCode: 'SAMPLE_GR_TYPE_A',
  plantId: 9201,
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
  sourceDocumentTypeCode: 'SAMPLE_SOURCE_TYPE_A',
  sourceDocumentId: 9051,
  reasonCode: 'SAMPLE_REASON_A',
  remarks: '합성 비고',
  erpMessageQueued: true,
};

const lineResponse: ReceiptLineResponse = {
  goodsReceiptLineId: 9401,
  goodsReceiptId: 9001,
  lineNo: 1,
  inboundReceiptLineId: 9051,
  itemId: 9301,
  lotId: 9601,
  receiptQty: 100,
  uomId: 9501,
  qualityStatusCode: 'SAMPLE_QUALITY_A',
  /* 재고 상태만 합성값이 아니다 — **계약이 값을 넷으로 못박아** 다른 값은 타입이 막는다. */
  inventoryStatusCode: 'AVAILABLE',
  destinationLocationId: 9801,
  inventoryTransactionLineId: 9903,
};

describe('toReceiptView', () => {
  it('화면이 쓰는 여섯 값만 옮긴다', () => {
    expect(toReceiptView(receiptResponse)).toEqual({
      goodsReceiptId: 9001,
      goodsReceiptNo: 'GR-2026-900001',
      receiptTypeCode: 'SAMPLE_GR_TYPE_A',
      warehouseId: 9701,
      receiptDatetime: '2026-08-06T09:12:00+09:00',
      statusCode: 'SAMPLE_GR_STATUS_A',
    });
  });

  /*
   * 응답에는 이 화면이 그리지도 보내지도 않는 값이 함께 온다. 타입에 자리를 두지 않으면
   * 그 번호가 화면으로 샐 경로도 없다(#44).
   */
  it('공장·원천 문서·사유·비고·ERP 적재 여부를 담지 않는다', () => {
    const view: Record<string, unknown> = { ...toReceiptView(receiptResponse) };

    for (const key of [
      'plantId',
      'sourceDocumentTypeCode',
      'sourceDocumentId',
      'reasonCode',
      'remarks',
      'erpMessageQueued',
    ]) {
      expect(view).not.toHaveProperty(key);
    }
  });
});

describe('toReceiptLineView', () => {
  /**
   * **반품 라인 한 줄이 계약에 요구하는 다섯이 여기 다 있다** — 품목·자재 LOT·수량·단위·
   * 출발 위치. 그것이 이 화면이 재고 잔액이 아니라 입고 전표에서 대상을 고르는 이유다.
   */
  it('반품 라인을 만들 수 있는 다섯과 그 줄의 식별자만 옮긴다', () => {
    expect(toReceiptLineView(lineResponse)).toEqual({
      goodsReceiptLineId: 9401,
      itemId: 9301,
      lotId: 9601,
      receiptQty: 100,
      uomId: 9501,
      destinationLocationId: 9801,
    });
  });

  it('줄번호·원천 라인·품질/재고 상태·원장 라인을 담지 않는다', () => {
    const view: Record<string, unknown> = { ...toReceiptLineView(lineResponse) };

    for (const key of [
      'goodsReceiptId',
      'lineNo',
      'inboundReceiptLineId',
      'qualityStatusCode',
      'inventoryStatusCode',
      'inventoryTransactionLineId',
    ]) {
      expect(view).not.toHaveProperty(key);
    }
  });

  it('수량 0과 소수를 그대로 옮긴다', () => {
    expect(toReceiptLineView({ ...lineResponse, receiptQty: 0 }).receiptQty).toBe(0);
    expect(toReceiptLineView({ ...lineResponse, receiptQty: 12.5 }).receiptQty).toBe(12.5);
  });
});

/**
 * 재고 잔액 한 줄. **이 화면은 상한을 만드는 데만 쓴다** — 목록으로 그리지 않는다.
 *
 * 예약·피킹·보류 수량과 가용 수량이 함께 오는데 **가용 수량을 담지 않는 것이 요점이다**
 * (계획 결정 9 · 완료 조건 C34). 담아 두면 언젠가 상한으로 읽히고, 그러면 보류된 자재 LOT을
 * 되돌려 보내는 이 화면의 주 용도가 막힌다.
 */
const balanceResponse: BalanceResponse = {
  groupBy: 'LOT',
  warehouseId: 9701,
  itemId: 9301,
  lotId: 9601,
  ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
  onHandQty: 80,
  reservedQty: 60,
  pickedQty: 5,
  blockedQty: 5,
  availableQty: 10,
  uomId: 9501,
};

describe('toBalanceView', () => {
  it('보유 수량·자재 LOT·단위 셋만 옮긴다', () => {
    expect(toBalanceView(balanceResponse)).toEqual({
      lotId: 9601,
      onHandQty: 80,
      uomId: 9501,
    });
  });

  /**
   * **M32** — `onHandQty`를 `availableQty`로 바꾸면 이 단언이 무너진다. 두 값이 다른 응답을
   * 쓰는 것이 그 잣대의 전제다(80 ≠ 10).
   */
  it('보유 수량으로 옮긴다 — 가용 수량이 아니다', () => {
    expect(toBalanceView(balanceResponse).onHandQty).toBe(80);
    expect(balanceResponse.availableQty).not.toBe(balanceResponse.onHandQty);
  });

  it('예약·피킹·보류·가용 수량과 소유·상태 코드를 담지 않는다', () => {
    const view: Record<string, unknown> = { ...toBalanceView(balanceResponse) };

    for (const key of [
      'reservedQty',
      'pickedQty',
      'blockedQty',
      'availableQty',
      'ownershipTypeCode',
      'qualityStatusCode',
      'inventoryStatusCode',
      'groupBy',
      'warehouseId',
      'itemId',
      'heldLotCount',
    ]) {
      expect(view).not.toHaveProperty(key);
    }
  });

  /**
   * `groupBy`가 LOT이 아닌 줄은 `lotId`가 비어서 온다(계약). 그 줄을 어느 LOT의 것으로도
   * 읽지 않으려면 **없음을 없음으로** 옮겨야 한다 — `?? 0`으로 메우면 0번 LOT의 잔액이 된다.
   */
  it('자재 LOT이 오지 않으면 없음으로 옮긴다', () => {
    expect(toBalanceView({ ...balanceResponse, lotId: null }).lotId).toBeNull();
    expect(toBalanceView({ ...balanceResponse, lotId: undefined }).lotId).toBeNull();
  });

  /** 계약이 「음수 허용 품목에서는 음수가 올 수 있다」고 적었다 — 삼키지 않는다. */
  it('보유 수량이 0이나 음수여도 그대로 옮긴다', () => {
    expect(toBalanceView({ ...balanceResponse, onHandQty: 0 }).onHandQty).toBe(0);
    expect(toBalanceView({ ...balanceResponse, onHandQty: -3 }).onHandQty).toBe(-3);
  });
});

describe('formatDateTime', () => {
  it('날짜와 시각만 뽑아 낸다', () => {
    expect(formatDateTime('2026-08-06T09:12:00+09:00')).toBe('2026-08-06 09:12');
  });

  /* 보는 사람의 시간대로 옮기면 같은 전표가 사람마다 다른 시각으로 보인다. */
  it('실행 환경 시간대로 옮기지 않는다', () => {
    expect(formatDateTime('2026-08-06T23:50:00+00:00')).toBe('2026-08-06 23:50');
  });

  /* 「—」로 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다. */
  it('형식이 아니면 원문을 그대로 낸다', () => {
    expect(formatDateTime('2026/08/06')).toBe('2026/08/06');
    expect(formatDateTime('')).toBe('');
  });
});

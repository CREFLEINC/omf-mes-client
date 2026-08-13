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

/** 계약 응답 한 건. **화면이 읽지 않는 필드도 실어** 옮기기가 실제로 고르는지 본다. */
const response = (overrides: Partial<ReceiptResponse> = {}): ReceiptResponse => ({
  goodsReceiptId: 9001,
  goodsReceiptNo: 'GR-2026-900001',
  receiptTypeCode: 'SAMPLE_GR_TYPE_A',
  plantId: 9101,
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
  sourceDocumentTypeCode: 'SAMPLE_SRC_TYPE_A',
  sourceDocumentId: 9201,
  reasonCode: 'SAMPLE_GR_REASON_A',
  remarks: '합성 비고',
  erpMessageQueued: true,
  ...overrides,
});

describe('toReceiptView', () => {
  it('화면이 쓰는 여섯만 옮긴다', () => {
    expect(toReceiptView(response())).toEqual({
      goodsReceiptId: 9001,
      goodsReceiptNo: 'GR-2026-900001',
      receiptTypeCode: 'SAMPLE_GR_TYPE_A',
      warehouseId: 9701,
      receiptDatetime: '2026-08-06T09:12:00+09:00',
      statusCode: 'SAMPLE_GR_STATUS_A',
    });
  });

  /**
   * 짝 방향 — **자리를 두지 않은 값은 옮겨지지 않는다.** 타입에 자리가 없으면 그 번호가
   * 화면으로 샐 경로도 없다(`omf-mes#44`).
   */
  it('공장·원천 문서·사유·비고·ERP 적재는 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toReceiptView(response()) };

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

  /** 상태·유형 코드는 **그대로 옮긴다** — 값으로 분기하지도 번역하지도 않는다(공유계약 G-2). */
  it('코드를 해석하지 않고 그대로 옮긴다', () => {
    const view = toReceiptView(response({ statusCode: '알 수 없는 코드' }));

    expect(view.statusCode).toBe('알 수 없는 코드');
  });
});

/** 라인 응답 한 줄. **화면이 읽지 않는 필드도 실어** 옮기기가 실제로 고르는지 본다. */
const lineResponse = (overrides: Partial<ReceiptLineResponse> = {}): ReceiptLineResponse => ({
  goodsReceiptLineId: 9401,
  goodsReceiptId: 9001,
  lineNo: 1,
  inboundReceiptLineId: 9501,
  itemId: 9301,
  lotId: 9601,
  receiptQty: 100,
  uomId: 9801,
  qualityStatusCode: 'SAMPLE_QUALITY_A',
  inventoryStatusCode: 'SAMPLE_INVENTORY_A',
  destinationLocationId: 9901,
  inventoryTransactionLineId: 9111,
  ...overrides,
});

describe('toReceiptLineView', () => {
  /** 폐기 라인이 요구하는 다섯(품목·LOT·수량·단위·출발 위치)과 줄을 가르는 번호만 옮긴다. */
  it('화면이 쓰는 여섯만 옮긴다', () => {
    expect(toReceiptLineView(lineResponse())).toEqual({
      goodsReceiptLineId: 9401,
      itemId: 9301,
      lotId: 9601,
      receiptQty: 100,
      uomId: 9801,
      destinationLocationId: 9901,
    });
  });

  /**
   * 짝 방향 — **자리를 두지 않은 값은 옮겨지지 않는다.**
   *
   * 품질·재고 상태를 담지 않는 것은 이 화면이 **상태 코드로 줄을 가르지 않기** 때문이고
   * (공유계약 G-2), 원장 라인·줄번호·전표 번호는 낼 것이 번호밖에 없다(`omf-mes#44`).
   */
  it('상태 코드·줄번호·원장 라인·전표 번호는 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toReceiptLineView(lineResponse()) };

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
});

/** 잔액 응답 한 줄. 화면이 쓰지 않는 수량·코드도 함께 실어 옮기기가 고르는지 본다. */
const balanceResponse = (overrides: Partial<BalanceResponse> = {}): BalanceResponse =>
  ({
    groupBy: 'LOT',
    itemId: 9301,
    lotId: 9601,
    warehouseId: 9701,
    ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
    onHandQty: 100,
    reservedQty: 20,
    pickedQty: 5,
    blockedQty: 30,
    availableQty: 45,
    uomId: 9801,
    ...overrides,
  }) as BalanceResponse;

describe('toBalanceView', () => {
  it('묶은 축·LOT·보유 수량·단위만 옮긴다', () => {
    expect(toBalanceView(balanceResponse())).toEqual({
      groupBy: 'LOT',
      lotId: 9601,
      onHandQty: 100,
      uomId: 9801,
    });
  });

  /**
   * **가용 수량에 자리를 두지 않는다**(계획 결정 4). 보유에서 예약·피킹·**보류**를 뺀 값인데,
   * 폐기 대상은 바로 그 보류·차단된 재고일 가능성이 크다 — 상한으로 쓰면 **폐기해야 할 것을
   * 화면이 막는다.** 자리가 없으면 나중에 그 값을 집어 오는 경로도 없다.
   */
  it('가용·예약·피킹·보류 수량은 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toBalanceView(balanceResponse()) };

    for (const key of ['availableQty', 'reservedQty', 'pickedQty', 'blockedQty']) {
      expect(view).not.toHaveProperty(key);
    }
  });

  /**
   * **없음을 없음으로 옮긴다.** 계약은 `lotId`를 「`groupBy`가 LOT일 때 채워진다」로 두었다 —
   * `?? 0`으로 메우면 **0번 LOT의 잔액**이라는 없는 사실이 만들어지고 어느 줄의 상한으로 읽힌다.
   */
  it('LOT이 없는 줄은 없음으로 옮긴다', () => {
    expect(toBalanceView(balanceResponse({ groupBy: 'ITEM', lotId: undefined })).lotId).toBeNull();
  });
});

describe('formatDateTime', () => {
  it('날짜와 분까지 낸다', () => {
    expect(formatDateTime('2026-08-06T09:12:00+09:00')).toBe('2026-08-06 09:12');
  });

  /**
   * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 자재가 실제로 들어온 곳의
   * 시각이고, 보는 사람의 시간대로 옮기면 같은 전표가 사람마다 다른 시각으로 보인다.
   */
  it('시간대를 옮기지 않는다', () => {
    expect(formatDateTime('2026-08-06T09:12:00Z')).toBe('2026-08-06 09:12');
    expect(formatDateTime('2026-08-06T09:12:00-05:00')).toBe('2026-08-06 09:12');
  });

  /**
   * **형식이 아니면 원문을 그대로 낸다.** 「—」로 바꾸면 값이 없는 것과 못 알아본 것이
   * 구분되지 않는다 — 서버가 보낸 값을 화면이 삼키지 않는다.
   */
  it('알아보지 못한 값은 원문을 낸다', () => {
    expect(formatDateTime('2026-08-06')).toBe('2026-08-06');
    expect(formatDateTime('')).toBe('');
  });
});

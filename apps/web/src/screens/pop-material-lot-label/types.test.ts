import { describe, expect, it } from 'vitest';

import {
  formatLotNo,
  formatReceiptDate,
  toIssueStage,
  toReceiptView,
  type TargetRow,
} from './types';

describe('toReceiptView', () => {
  it('화면이 쓰는 값만 옮긴다 — 나머지는 타입에 자리가 없다', () => {
    const view = toReceiptView({
      inboundReceiptId: 8101,
      inboundReceiptNo: 'SYN-IB-0001',
      supplierId: 8201,
      plantId: 8301,
      receiptDatetime: '2026-08-27T09:12:30Z',
      vehicleNo: 'SYN-VEHICLE-01',
      statusCode: 'SYN_STATUS',
    } as Parameters<typeof toReceiptView>[0]);

    expect(view).toEqual({
      inboundReceiptId: 8101,
      inboundReceiptNo: 'SYN-IB-0001',
      supplierId: 8201,
      // LOT 등록 본문이 요구한다 — 이 값은 화면이 쓰는 값이다.
      plantId: 8301,
      receiptDatetime: '2026-08-27T09:12:30Z',
    });
  });
});

describe('formatReceiptDate', () => {
  it('날짜까지만 보인다 — 좌우 2단이라 시각을 넣을 가로 여유가 없다', () => {
    expect(formatReceiptDate('2026-08-27T09:12:30Z')).toBe('2026-08-27');
  });

  it('알아보지 못한 값은 원문을 그대로 낸다 — 없는 값과 못 알아본 값을 뭉개지 않는다', () => {
    expect(formatReceiptDate('알 수 없는 값')).toBe('알 수 없는 값');
  });
});

const targetRow = (lotId: number | null): TargetRow => ({
  inboundReceiptLineId: 8501,
  inboundReceiptId: 8101,
  inboundReceiptNo: 'SYN-IB-0001',
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime: '2026-08-27T09:12:30Z',
  itemId: 8601,
  receivedQty: 500,
  uomId: 8401,
  lotId,
});

describe('toIssueStage', () => {
  it('LOT 이 없으면 아직 등록하지 않은 것이다', () => {
    expect(toIssueStage(targetRow(null))).toBe('unregistered');
  });

  /**
   * ⛔ LOT 이 이미 있으면 등록을 다시 부르지 않는다 — 부르면 같은 자재에 LOT 이 둘 생기고
   * 되돌릴 화면이 없다(변경 통지 #534 §3).
   */
  it('LOT 이 있으면 등록이 끝난 것이다 — 인쇄만 남는다', () => {
    expect(toIssueStage(targetRow(9001))).toBe('registered');
  });
});

describe('formatLotNo — 34자리를 뜻의 경계로 끊는다', () => {
  /** 합성값이다 — 실 운영 LOT 번호를 쓰지 않는다(공개 저장소 경계). */
  const lotNo = '0009999990000005002608270000110001';

  it('제품코드9 · 수량9 · 날짜6 · 공급사6 · 일련4 로 끊는다', () => {
    expect(formatLotNo(lotNo)).toBe('000999999 000000500 260827 000011 0001');
  });

  it('끊은 결과에서 공백을 지우면 원문이다 — 보이기만 바꾸고 값은 바꾸지 않는다', () => {
    expect(formatLotNo(lotNo).replaceAll(' ', '')).toBe(lotNo);
  });

  it('자릿수가 다르면 원문을 그대로 낸다 — 화면이 삼키지 않는다', () => {
    expect(formatLotNo('00099999900000050026082700001')).toBe('00099999900000050026082700001');
  });

  it('숫자가 아닌 값이 섞이면 원문을 그대로 낸다', () => {
    const withLetter = `A00999999000000500260827000011000${'1'}`;

    expect(formatLotNo(withLetter)).toBe(withLetter);
  });
});

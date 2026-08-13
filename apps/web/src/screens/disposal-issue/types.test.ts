import { describe, expect, it } from 'vitest';

import { formatDateTime, toReceiptView, type ReceiptResponse } from './types';

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

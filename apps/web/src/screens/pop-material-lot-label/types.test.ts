import { describe, expect, it } from 'vitest';

import { formatReceiptDate, toReceiptView } from './types';

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

import { describe, expect, it } from 'vitest';

import { interfaceCodeOf, toOutboundItem } from './outbound-items';

describe('송신 항목 ↔ 송신 인터페이스', () => {
  it.each([
    ['PRODUCTION_RESULT', 'IF-WO-CLOSE-SEND'],
    ['GOODS_RECEIPT', 'IF-GR-SEND'],
    ['SHIPMENT_PGI', 'IF-SHIPMENT-PGI-SEND'],
  ])('%s 는 %s 로 보낸다', (item, interfaceCode) => {
    expect(interfaceCodeOf(item)).toBe(interfaceCode);
  });

  it.each(['RETURN', 'STOCK_ADJUSTMENT', 'UNKNOWN'])(
    '%s 는 아직 보내지 않는다(짝 없음)',
    (item) => {
      expect(interfaceCodeOf(item)).toBeNull();
    },
  );

  it('서버 설정 한 줄에 짝을 붙인다 — 이름 · 켜짐 · 잠금은 서버 값 그대로', () => {
    expect(
      toOutboundItem({
        outboundItemCode: 'GOODS_RECEIPT',
        outboundItemName: '입고 (G/R)',
        enabled: false,
        locked: false,
        pendingMessageCount: 0,
      }),
    ).toEqual({
      outboundItemCode: 'GOODS_RECEIPT',
      outboundItemName: '입고 (G/R)',
      enabled: false,
      locked: false,
      interfaceCode: 'IF-GR-SEND',
    });
  });
});

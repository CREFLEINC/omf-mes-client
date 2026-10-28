import { describe, expect, it } from 'vitest';

import { toOutboundItem } from './outbound-items';

describe('송신 항목 — 서버 설정 한 줄', () => {
  it('짝 · 대기 · 실패 건수를 서버 값 그대로 옮긴다(서버 #849)', () => {
    expect(
      toOutboundItem({
        outboundItemCode: 'GOODS_RECEIPT',
        outboundItemName: '입고 (G/R)',
        enabled: false,
        locked: false,
        interfaceCode: 'IF-GR-SEND',
        pendingMessageCount: 3,
        failedMessageCount: 1,
      }),
    ).toEqual({
      outboundItemCode: 'GOODS_RECEIPT',
      outboundItemName: '입고 (G/R)',
      enabled: false,
      locked: false,
      interfaceCode: 'IF-GR-SEND',
      pendingCount: 3,
      failedCount: 1,
    });
  });

  it('송신이 없는 항목(반품)은 짝이 없고, 실패 건수를 주지 않는 옛 서버는 0 으로 둔다', () => {
    const item = toOutboundItem({
      outboundItemCode: 'RETURN',
      outboundItemName: '반품',
      enabled: true,
      locked: false,
      pendingMessageCount: 0,
    });

    expect(item.interfaceCode).toBeNull();
    expect(item.failedCount).toBe(0);
  });
});

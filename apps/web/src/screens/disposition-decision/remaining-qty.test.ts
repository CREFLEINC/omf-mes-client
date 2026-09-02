import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toRemainingQty } from './remaining-qty';
import type { DispositionRemainingSummary } from './types';

const summary = (
  overrides: Partial<DispositionRemainingSummary> = {},
): DispositionRemainingSummary => ({
  affectedQtyTotal: 320,
  decidedQtyTotal: 200,
  remainingQty: 120,
  uomId: 7001,
  ...overrides,
});

describe('toRemainingQty', () => {
  it('서버가 낸 summary.remainingQty를 그대로 읽는다', () => {
    const remaining = toRemainingQty(summary());

    expect(remaining.value).toBe(120);
    expect(remaining.text).toBe('120');
    expect(remaining.isSettled).toBe(false);
  });

  it('판정 이력을 아직 못 받았으면 낼 수 없다고 답한다', () => {
    const remaining = toRemainingQty(undefined);

    expect(remaining.value).toBeUndefined();
    expect(remaining.text).toBe(messages.dispositionDecision.values.unknownQty);
    expect(remaining.isSettled).toBe(false);
  });

  it('판정이 없으면 대상 수량이 그대로 남는다', () => {
    expect(toRemainingQty(summary({ decidedQtyTotal: 0, remainingQty: 320 })).value).toBe(320);
  });

  it('다 판정하면 끝난 것으로 본다', () => {
    const remaining = toRemainingQty(summary({ decidedQtyTotal: 320, remainingQty: 0 }));

    expect(remaining.value).toBe(0);
    expect(remaining.isSettled).toBe(true);
  });

  it('서버 값이 어긋나 음수가 되어도 끝난 것으로 본다 — 더 판정하게 두지 않는다', () => {
    expect(toRemainingQty(summary({ decidedQtyTotal: 400, remainingQty: -80 })).isSettled).toBe(
      true,
    );
  });

  it('대상이 빈 부적합이면 0이다', () => {
    const remaining = toRemainingQty(
      summary({ affectedQtyTotal: 0, decidedQtyTotal: 0, remainingQty: 0 }),
    );

    expect(remaining.value).toBe(0);
    expect(remaining.isSettled).toBe(true);
  });

  it('소수 수량을 그대로 다룬다', () => {
    expect(toRemainingQty(summary({ remainingQty: 10 })).value).toBe(10);
  });

  it('⭐ 부동소수 찌꺼기를 0으로 맞춘다 — 보이는 값이 0인데 안 끝난 상태를 만들지 않는다', () => {
    const remaining = toRemainingQty(summary({ remainingQty: 5.55e-17 }));

    expect(remaining.value).toBe(0);
    expect(remaining.text).toBe('0');
    expect(remaining.isSettled).toBe(true);
  });

  it('⭐ 음수 쪽 찌꺼기도 0으로 맞춘다 — 「-0」이 화면에 찍히지 않게 한다', () => {
    const remaining = toRemainingQty(summary({ remainingQty: -5.55e-17 }));

    expect(remaining.text).not.toBe('-0');
    expect(remaining.value).toBe(0);
    expect(remaining.isSettled).toBe(true);
  });

  it('보이는 값과 끝났다는 판정이 언제나 함께 간다', () => {
    for (const remainingQty of [5.55e-17, -5.55e-17, 0, 120, 200]) {
      const remaining = toRemainingQty(summary({ remainingQty }));

      expect(remaining.isSettled).toBe(remaining.text === '0');
    }
  });
});

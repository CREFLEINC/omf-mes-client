import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toRemainingQty } from './remaining-qty';
import type { DispositionDecision, NonconformanceLot } from './types';

/** ⚠ 지어낸 자리표시다 — 처분·품질 상태의 실제 값 목록은 아직 확정되지 않았다. */
const lot = (affectedQty: number): NonconformanceLot => ({
  nonconformanceLotId: 9001,
  lotId: 8001,
  affectedQty,
  uomId: 7001,
  qualityStatusBeforeCode: 'CODE-D',
  qualityStatusAfterCode: 'CODE-E',
});

const decision = (decisionQty: number): DispositionDecision => ({
  dispositionDecisionId: 3001,
  nonconformanceId: 1001,
  dispositionTypeCode: 'CODE-A',
  decisionQty,
  uomId: 7001,
  reason: '사유',
  decidedBy: 4001,
  decidedAt: '2026-08-12T14:20:00+09:00',
});

describe('toRemainingQty', () => {
  it('대상 수량 합에서 판정 수량 합을 뺀다', () => {
    const remaining = toRemainingQty([lot(320)], [decision(200)]);

    expect(remaining.value).toBe(120);
    expect(remaining.text).toBe('120');
    expect(remaining.isSettled).toBe(false);
  });

  it('부분 판정이 여러 건이면 모두 뺀다', () => {
    expect(toRemainingQty([lot(200), lot(120)], [decision(100), decision(50)]).value).toBe(170);
  });

  it('판정이 없으면 대상 수량이 그대로 남는다', () => {
    expect(toRemainingQty([lot(320)], []).value).toBe(320);
  });

  it('다 판정하면 끝난 것으로 본다', () => {
    const remaining = toRemainingQty([lot(320)], [decision(320)]);

    expect(remaining.value).toBe(0);
    expect(remaining.isSettled).toBe(true);
  });

  it('서버 값이 어긋나 음수가 되어도 끝난 것으로 본다 — 더 판정하게 두지 않는다', () => {
    expect(toRemainingQty([lot(320)], [decision(400)]).isSettled).toBe(true);
  });

  it('대상 LOT이 실려 오지 않으면 낼 수 없다고 답한다 — 0을 지어내지 않는다', () => {
    const remaining = toRemainingQty(undefined, [decision(200)]);

    expect(remaining.value).toBeUndefined();
    expect(remaining.text).toBe(messages.dispositionDecision.values.unknownQty);
    expect(remaining.isSettled).toBe(false);
  });

  it('판정 이력을 아직 못 받았으면 낼 수 없다고 답한다', () => {
    expect(toRemainingQty([lot(320)], undefined).value).toBeUndefined();
  });

  it('대상 LOT이 빈 목록이면 0이다 — 「없다」와 「0이다」를 가른다', () => {
    expect(toRemainingQty([], []).value).toBe(0);
  });

  it('소수 수량을 그대로 다룬다', () => {
    expect(toRemainingQty([lot(10.5)], [decision(0.5)]).value).toBe(10);
  });
});

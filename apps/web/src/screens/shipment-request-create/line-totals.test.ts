import { describe, expect, it } from 'vitest';

import { emptyLineDraft } from './line-draft';
import { sumAllocated, sumRequested, unallocatedTotal } from './line-totals';
import type { ShipmentRequestLineDraft } from './types';

const line = (patch: Partial<ShipmentRequestLineDraft>): ShipmentRequestLineDraft => ({
  ...emptyLineDraft(),
  ...patch,
});

describe('sumRequested · sumAllocated', () => {
  it('읽을 수 있는 값만 더한다', () => {
    const lines = [
      line({ requestedQty: '30', allocatedQty: '20' }),
      line({ requestedQty: '10', allocatedQty: '5' }),
    ];

    expect(sumRequested(lines)).toBe(40);
    expect(sumAllocated(lines)).toBe(25);
  });

  it('빈 칸·형식 오류는 0으로 본다 — 표 전체를 막지 않는다', () => {
    const lines = [
      line({ requestedQty: '' }),
      line({ requestedQty: 'abc' }),
      line({ requestedQty: '10' }),
    ];

    expect(sumRequested(lines)).toBe(10);
  });
});

describe('unallocatedTotal', () => {
  it('요청 − 배정이다', () => {
    const lines = [line({ requestedQty: '30', allocatedQty: '20' })];

    expect(unallocatedTotal(lines)).toBe(10);
  });

  it('편집 도중에는 음수일 수 있다 — 검증은 이 파일이 아니라 validation.ts가 진다', () => {
    const lines = [line({ requestedQty: '5', allocatedQty: '10' })];

    expect(unallocatedTotal(lines)).toBe(-5);
  });
});

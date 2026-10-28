import { describe, expect, it } from 'vitest';

import { sampleQtyOf } from './sample-qty';

describe('sampleQtyOf — 샘플 검사수량 (omf-all-around#102)', () => {
  it('기준이 없거나 전수검사면 의뢰수량이다', () => {
    expect(sampleQtyOf(500, null)).toBe(500);
    expect(sampleQtyOf(500, { samplingMethodCode: 'FULL_INSPECTION', samplingRatio: null })).toBe(
      500,
    );
  });

  it('샘플 방식은 비율(%)로 줄여 올림한다', () => {
    expect(sampleQtyOf(500, { samplingMethodCode: 'SAMPLE_BY_LOT', samplingRatio: 10 })).toBe(50);
    expect(sampleQtyOf(100, { samplingMethodCode: 'SAMPLE_BY_UNIT', samplingRatio: 3.5 })).toBe(4);
  });

  it('부동소수 오차로 한 개를 더하지 않는다', () => {
    expect(sampleQtyOf(1000, { samplingMethodCode: 'SAMPLE_BY_LOT', samplingRatio: 0.7 })).toBe(7);
  });

  it('아무리 작아도 한 개는 검사한다', () => {
    expect(sampleQtyOf(5, { samplingMethodCode: 'SAMPLE_BY_LOT', samplingRatio: 1 })).toBe(1);
  });

  /* omf-all-around#201 — 샘플 개수로 정한 기준은 그 개수, 의뢰수량보다 크면 의뢰수량이다. */
  it('샘플 개수면 그 개수다 — 의뢰수량보다 크면 의뢰수량', () => {
    const byQty = { samplingMethodCode: 'SAMPLE_BY_LOT', samplingRatio: null, samplingQty: 5 };

    expect(sampleQtyOf(500, byQty)).toBe(5);
    expect(sampleQtyOf(3, byQty)).toBe(3);
  });

  it('비율이 비어 있으면 의뢰수량이다', () => {
    expect(sampleQtyOf(500, { samplingMethodCode: 'SAMPLE_BY_LOT', samplingRatio: null })).toBe(
      500,
    );
  });
});

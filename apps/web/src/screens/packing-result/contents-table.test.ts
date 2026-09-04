import { describe, expect, it } from 'vitest';

import { segmentLotNo } from './contents-table';

describe('segmentLotNo', () => {
  it('34자리 LOT 을 계약이 정한 자릿수(9·9·6·6·4)로 끊는다 — 실물 라벨과 눈으로 대조하는 자리다', () => {
    expect(segmentLotNo('0001234500000012002607310001230007')).toBe(
      '000123450 · 000001200 · 260731 · 000123 · 0007',
    );
  });

  it('⛔ 형식이 다른 값에는 «없는 경계»를 그리지 않는다 — 원문 그대로 낸다', () => {
    expect(segmentLotNo('SYN-LOT-000123450')).toBe('SYN-LOT-000123450');
    expect(segmentLotNo('')).toBe('');
  });

  it('저장값을 바꾸지 않는다 — 끊은 것은 표시뿐이라 글자를 잃지 않는다', () => {
    const raw = '0001234500000012002607310001230007';

    expect(segmentLotNo(raw).split(' · ').join('')).toBe(raw);
  });
});

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

  it('⛔ 34자여도 자재 형식(전부 숫자)이 아니면 끊지 않는다 — 생산 LOT 은 원문 그대로다 (#1335)', () => {
    // 서버 생산 LOT: M + 공장6 + YYYYMMDD + 순번6 + 난수13 = 34자.
    expect(segmentLotNo('M00000220260918000001UQJU2R65QZQDK')).toBe(
      'M00000220260918000001UQJU2R65QZQDK',
    );
  });

  it('구분자 5칸 자재 LOT 은 이미 칸이 나뉘어 있어 원문 그대로 낸다', () => {
    expect(segmentLotNo('F536A42301AP|100|260918|100019|0001')).toBe(
      'F536A42301AP|100|260918|100019|0001',
    );
  });

  it('저장값을 바꾸지 않는다 — 끊은 것은 표시뿐이라 글자를 잃지 않는다', () => {
    const raw = '0001234500000012002607310001230007';

    expect(segmentLotNo(raw).split(' · ').join('')).toBe(raw);
  });
});

import { describe, expect, it } from 'vitest';

import { MATERIAL_LOT_NO_LENGTH, formatMaterialLotNo, isMaterialLotNo } from './lot-number';

const SCANNED = '7770001118880002229901015554447777';

describe('자재 LOT 번호 표시', () => {
  it('분절 자릿수의 합이 34다', () => {
    expect(MATERIAL_LOT_NO_LENGTH).toBe(34);
  });

  it('다섯 토막으로 끊어 보인다', () => {
    expect(formatMaterialLotNo(SCANNED)).toBe('777000111 · 888000222 · 990101 · 555444 · 7777');
  });

  it('끊은 값을 이어 붙이면 원문이다', () => {
    expect(formatMaterialLotNo(SCANNED).split(' · ').join('')).toBe(SCANNED);
  });

  it('자릿수가 다르면 끊지 않고 그대로 둔다', () => {
    expect(formatMaterialLotNo('SYN-LOT-0001')).toBe('SYN-LOT-0001');
    expect(formatMaterialLotNo(`${SCANNED}9`)).toBe(`${SCANNED}9`);
  });

  it('34자리인지 판정한다', () => {
    expect(isMaterialLotNo(SCANNED)).toBe(true);
    expect(isMaterialLotNo(SCANNED.slice(1))).toBe(false);
  });
});

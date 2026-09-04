import { describe, expect, it } from 'vitest';

import { formatLotNo } from './lot-display';

describe('formatLotNo — 보이기만 끊는다', () => {
  it('34자리 숫자는 뜻의 경계로 끊는다', () => {
    expect(formatLotNo('0001234500000012002607310001230007')).toBe(
      '000123450 000001200 260731 000123 0007',
    );
  });

  it('자릿수가 다르면 원문을 그대로 낸다 — 이 화면의 대상은 생산 LOT 이다', () => {
    expect(formatLotNo('PLOT-2026-0007')).toBe('PLOT-2026-0007');
  });

  it('숫자가 아닌 34자는 끊지 않는다', () => {
    const value = 'A'.repeat(34);

    expect(formatLotNo(value)).toBe(value);
  });

  it('끊은 값에서 공백을 지우면 원문이다 — 보내는 값은 바뀌지 않는다', () => {
    const raw = '0001234500000012002607310001230007';

    expect(formatLotNo(raw).replaceAll(' ', '')).toBe(raw);
  });
});

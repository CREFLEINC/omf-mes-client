import { describe, expect, it } from 'vitest';

import { shipmentProgressLabel } from './progress-label';

describe('shipmentProgressLabel — 계약이 닫은 6값의 표시명은 화면이 갖는다', () => {
  it.each([
    ['NOT_ALLOCATED', '미편성'],
    ['PARTIALLY_ALLOCATED', '부분 편성'],
    ['PICKING', '피킹중'],
    ['PICKED', '피킹 완료'],
    ['PARTIALLY_SHIPPED', '부분 출하'],
    ['SHIPPED', '출하 완료'],
  ])('%s → %s', (code, label) => {
    expect(shipmentProgressLabel(code)).toBe(label);
  });

  /* 계약이 값을 늘렸는데 라벨이 아직 없으면 코드를 그대로 — 뜻을 지어내지 않는다(G-9). */
  it('모르는 값은 코드를 그대로 보인다', () => {
    expect(shipmentProgressLabel('SYN_NEW')).toBe('SYN_NEW');
  });
});

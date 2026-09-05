import { describe, expect, it } from 'vitest';

import { SHIPMENT_PROGRESS_CODES } from './status-options';

describe('SHIPMENT_PROGRESS_CODES', () => {
  it('고정 계약의 6개 진행 상태를 순서와 손실 없이 담는다', () => {
    expect(SHIPMENT_PROGRESS_CODES).toEqual([
      'NOT_ALLOCATED',
      'PARTIALLY_ALLOCATED',
      'PICKING',
      'PICKED',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
    ]);
  });
});

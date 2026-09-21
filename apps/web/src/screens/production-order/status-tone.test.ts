import { describe, expect, it } from 'vitest';

import { productionOrderStatusTone } from './status-tone';

describe('productionOrderStatusTone', () => {
  it('colours the three server statuses and stays neutral for anything else', () => {
    expect(productionOrderStatusTone('RECEIVED')).toBe('info');
    expect(productionOrderStatusTone('UPDATED')).toBe('warning');
    expect(productionOrderStatusTone('CANCELLED')).toBe('error');
    /* 화면이 값 목록을 정하지 않는다 — 모르는 코드는 색으로 뜻을 지어내지 않는다. */
    expect(productionOrderStatusTone('SYN-NEW-STATUS')).toBe('idle');
  });
});

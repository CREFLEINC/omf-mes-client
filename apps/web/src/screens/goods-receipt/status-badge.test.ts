import { describe, expect, it } from 'vitest';

import { toStatusTone } from './status-badge';

describe('toStatusTone — 입하 전표 상태 색', () => {
  it.each([
    ['REGISTERED', 'idle'],
    ['CONFIRMED', 'info'],
    ['COMPLETED', 'success'],
    ['CANCELLED', 'error'],
    ['INSPECTION_PENDING', 'warning'],
    ['SAMPLE_IR_STATUS_A', 'idle'],
  ])('%s → %s', (code, tone) => {
    expect(toStatusTone(code)).toBe(tone);
  });
});

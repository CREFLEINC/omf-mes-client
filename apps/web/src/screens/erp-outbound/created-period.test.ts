import { describe, expect, it } from 'vitest';

import { formatDate } from './created-period';

describe('created-period', () => {
  it('날짜를 YYYY-MM-DD 로 낸다 — 한 자리 달 · 날은 0 을 채운다', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDate(new Date(2026, 10, 24))).toBe('2026-11-24');
  });
});

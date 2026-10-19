import { describe, expect, it } from 'vitest';

import { formatLastUpdated } from './last-updated';

/** 공장 시각(Asia/Ho_Chi_Minh, UTC+7) 기준. */
describe('formatLastUpdated', () => {
  const now = Date.parse('2026-10-16T05:00:00Z'); // 공장 12:00

  it('오늘(공장 시각) 것이면 HH:mm', () => {
    expect(formatLastUpdated(Date.parse('2026-10-16T02:41:00Z'), now)).toBe('09:41');
  });

  it('다른 날이면 YYYY-MM-DD HH:mm — 공장 자정을 기준으로 가른다', () => {
    expect(formatLastUpdated(Date.parse('2026-10-15T16:59:00Z'), now)).toBe('2026-10-15 23:59');
    expect(formatLastUpdated(Date.parse('2026-10-15T17:01:00Z'), now)).toBe('00:01');
  });

  it('한 번도 성공하지 않았으면(0) null', () => {
    expect(formatLastUpdated(0, now)).toBeNull();
  });
});

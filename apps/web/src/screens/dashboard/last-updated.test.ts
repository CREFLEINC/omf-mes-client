import { describe, expect, it } from 'vitest';

import { formatLastUpdated } from './last-updated';

/** 공장 시각(Asia/Ho_Chi_Minh, UTC+7) 기준. */
describe('formatLastUpdated', () => {
  it('오늘 것도 yyyy-MM-dd HH:mm(사용자 지시 2026-10-19)', () => {
    expect(formatLastUpdated(Date.parse('2026-10-16T02:41:00Z'))).toBe('2026-10-16 09:41');
  });

  it('공장 자정을 기준으로 날짜를 가른다', () => {
    expect(formatLastUpdated(Date.parse('2026-10-15T16:59:00Z'))).toBe('2026-10-15 23:59');
    expect(formatLastUpdated(Date.parse('2026-10-15T17:01:00Z'))).toBe('2026-10-16 00:01');
  });

  it('한 번도 성공하지 않았으면(0) null', () => {
    expect(formatLastUpdated(0)).toBeNull();
  });
});

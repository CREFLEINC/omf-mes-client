import { describe, expect, it } from 'vitest';

import { formatTimingLine, sanitizeTimingFields } from './print-timing';

describe('인쇄 시간 기록', () => {
  it('한 작업을 탭으로 가른 한 줄로 적는다', () => {
    expect(
      formatTimingLine('2026-11-23T08:00:00.000Z', 'shell', [
        ['label', 'lots-12-x10'],
        ['sendMs', 85],
      ]),
    ).toBe('2026-11-23T08:00:00.000Z\tshell\tlabel=lots-12-x10\tsendMs=85\n');
  });

  it('화면 값은 글 · 수만 받고 줄바꿈 · 탭을 걷는다', () => {
    expect(
      sanitizeTimingFields({ label: 'a\tb\nc', issueMs: 120, nested: { x: 1 }, flag: true }),
    ).toEqual([
      ['label', 'a b c'],
      ['issueMs', '120'],
    ]);
    expect(sanitizeTimingFields(null)).toEqual([]);
  });
});

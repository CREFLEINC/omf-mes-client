import { describe, expect, it } from 'vitest';

import { terminalNow } from './terminal-clock';

describe('단말 시각', () => {
  /**
   * ⛔ **오프셋을 붙인다.** 없는 문자열을 보내면 같은 글자가 지역마다 다른 순간을 가리키고,
   * `Z`(UTC)로 보내면 단말이 선 지역의 시각을 잃는다(공유계약 C-12).
   */
  it('초와 오프셋까지 갖춘 지역 시각을 만든다', () => {
    const value = terminalNow(new Date(2026, 8, 2, 9, 5, 7));

    expect(value).toMatch(/^2026-09-02T09:05:07[+-]\d{2}:\d{2}$/);
    expect(value.endsWith('Z')).toBe(false);
  });

  it('한 자리 수를 0으로 채운다', () => {
    expect(terminalNow(new Date(2026, 0, 3, 4, 5, 6))).toContain('2026-01-03T04:05:06');
  });
});

import { describe, expect, it } from 'vitest';

import { toIssueCountByLotId } from './types';

describe('LOT 라벨 발행 회차', () => {
  it('targetTypeCode가 LOT인 기록만 센다', () => {
    const counts = toIssueCountByLotId([
      { targetTypeCode: 'SERIAL_NUMBER', targetId: 90101, issueCount: 9 },
      { targetTypeCode: 'LOT', targetId: 90101, issueCount: 2 },
    ]);

    expect(counts.get(90101)).toBe(2);
  });
});

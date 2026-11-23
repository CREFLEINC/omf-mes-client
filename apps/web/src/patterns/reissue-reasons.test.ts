import { describe, expect, it } from 'vitest';

import { SYSTEM_REISSUE_REASON_CODES, withoutSystemReissueReasons } from './reissue-reasons';

describe('재발행 사유 — 사람이 고르는 목록', () => {
  /* 피처 013 T022 · research R-7: 원래 LOT 재발행 사유 LOT_SPLIT 은 서버(분리)만 붙인다. */
  it('T022 · US1-3 「LOT 분리」(LOT_SPLIT)를 빼고 나머지는 받은 차례 그대로 둔다', () => {
    const reasons = [
      { code: 'PRINT_FAILURE', name: '인쇄 실패' },
      { code: 'LOT_SPLIT', name: 'LOT 분리' },
      { code: 'DAMAGED', name: '라벨 손상' },
    ];

    expect(withoutSystemReissueReasons(reasons).map((reason) => reason.code)).toEqual([
      'PRINT_FAILURE',
      'DAMAGED',
    ]);
    expect([...SYSTEM_REISSUE_REASON_CODES]).toEqual(['LOT_SPLIT']);
  });
});

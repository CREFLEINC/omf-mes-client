import { describe, expect, it } from 'vitest';

import { isPutawayStaging } from './live-data';

const storage = (code: string, systemRoleCode: 'PUTAWAY_STAGING' | 'WAREHOUSE_WHOLE' | null) => ({
  location: { id: 50, code, name: '위치', systemRoleCode },
});

describe('isPutawayStaging', () => {
  it('역할이 적치 대기면 적치 대기로 본다 — 코드 글자는 보지 않는다(#292)', () => {
    expect(isPutawayStaging(storage('K7PM-SYS-STAGING', 'PUTAWAY_STAGING'))).toBe(true);
    expect(isPutawayStaging(storage('K7PM-Z01', 'PUTAWAY_STAGING'))).toBe(true);
  });

  it('창고 전체 · 사람이 만든 위치 · 위치 없음은 아니다', () => {
    expect(isPutawayStaging(storage('K7PM-SYS-WHOLE', 'WAREHOUSE_WHOLE'))).toBe(false);
    expect(isPutawayStaging(storage('SYS-STAGING', null))).toBe(false);
    expect(isPutawayStaging({ location: null })).toBe(false);
  });
});

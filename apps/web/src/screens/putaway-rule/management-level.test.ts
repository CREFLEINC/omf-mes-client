import { describe, expect, it } from 'vitest';

import { LOCATION_MANAGED_LEVEL_CODES, isLocationInputOpen } from './management-level';

describe('LOCATION_MANAGED_LEVEL_CODES', () => {
  it('고정 설계의 Location 관리 수준 세 값을 사용한다', () => {
    expect(LOCATION_MANAGED_LEVEL_CODES).toEqual(['ZONE', 'RACK', 'CELL']);
  });

  it.each(LOCATION_MANAGED_LEVEL_CODES)('%s 수준에서는 Location 입력이 열린다', (level) => {
    expect(isLocationInputOpen(level)).toBe(true);
  });

  it('WAREHOUSE 수준에서는 Location 입력이 잠긴다', () => {
    expect(isLocationInputOpen('WAREHOUSE')).toBe(false);
  });

  it('관리수준을 확인하지 못했거나 알 수 없는 값이면 잠긴다', () => {
    expect(isLocationInputOpen(null)).toBe(false);
    expect(isLocationInputOpen('UNKNOWN')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { toLocationOptions } from './location-options';
import type { LocationView } from './types';

const location = (overrides: Partial<LocationView> = {}): LocationView => ({
  locationId: 9801,
  parentLocationId: null,
  locationCode: 'SAMPLE-LOC-A',
  locationName: '합성 위치 가',
  isActive: true,
  ...overrides,
});

describe('toLocationOptions — 표기(피처 007 · #267)', () => {
  it('별칭이 없으면 「코드 · 이름」이다', () => {
    expect(toLocationOptions([location()])).toEqual([
      { value: '9801', label: 'SAMPLE-LOC-A · 합성 위치 가' },
    ]);
  });

  it('US2-4 별칭이 있으면 위치를 「코드 · 별칭」으로 보인다', () => {
    expect(toLocationOptions([location({ aliasName: '합성 별칭' })])).toEqual([
      { value: '9801', label: 'SAMPLE-LOC-A · 합성 별칭' },
    ]);
  });
});

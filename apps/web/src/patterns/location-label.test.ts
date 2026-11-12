import { describe, expect, it } from 'vitest';

import { locationMarkerLabel, locationOptionLabel } from './location-label';

describe('locationMarkerLabel', () => {
  it('US2-2 별칭이 있으면 별칭만(앞뒤 공백 뺌)', () => {
    expect(
      locationMarkerLabel({
        locationCode: 'Z01-R001',
        aliasName: '  A열 1번 랙 ',
        locationName: 'X',
      }),
    ).toBe('A열 1번 랙');
  });

  it('US2-3 별칭이 없거나 공백뿐이면 코드', () => {
    expect(locationMarkerLabel({ locationCode: 'Z01-R001', aliasName: null })).toBe('Z01-R001');
    expect(locationMarkerLabel({ locationCode: 'Z01-R001', aliasName: '   ' })).toBe('Z01-R001');
    expect(locationMarkerLabel({ locationCode: 'Z01-R001' })).toBe('Z01-R001');
  });

  it('US2-2 이름은 표식에 쓰지 않는다', () => {
    expect(locationMarkerLabel({ locationCode: 'Z01', locationName: 'A동', aliasName: '' })).toBe(
      'Z01',
    );
  });
});

describe('locationOptionLabel', () => {
  it('US2-4 별칭이 있으면 「코드 · 별칭」', () => {
    expect(
      locationOptionLabel({
        locationCode: 'Z01-R001',
        locationName: 'Z01-R001',
        aliasName: 'A열 1번 랙',
      }),
    ).toBe('Z01-R001 · A열 1번 랙');
  });

  it('US2-4 별칭이 이름보다 앞선다', () => {
    expect(
      locationOptionLabel({ locationCode: 'Z01', locationName: '옛 이름', aliasName: ' A동 ' }),
    ).toBe('Z01 · A동');
  });

  it('US2-4 별칭이 공백뿐이고 이름이 코드와 다르면 「코드 · 이름」', () => {
    expect(
      locationOptionLabel({
        locationCode: 'SYS-STAGING',
        locationName: '적치 대기',
        aliasName: ' ',
      }),
    ).toBe('SYS-STAGING · 적치 대기');
  });

  it('US2-4 별칭이 없고 이름이 코드와 같거나 비면 코드만', () => {
    expect(
      locationOptionLabel({ locationCode: 'Z01-R002', locationName: 'Z01-R002', aliasName: null }),
    ).toBe('Z01-R002');
    expect(locationOptionLabel({ locationCode: 'Z01-R002', locationName: ' Z01-R002 ' })).toBe(
      'Z01-R002',
    );
    expect(locationOptionLabel({ locationCode: 'Z01-R002', locationName: null })).toBe('Z01-R002');
    expect(locationOptionLabel({ locationCode: 'Z01-R002' })).toBe('Z01-R002');
  });
});

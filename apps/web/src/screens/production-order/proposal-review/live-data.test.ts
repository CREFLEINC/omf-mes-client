import { describe, expect, it } from 'vitest';

import { isPutawayStagingCode } from './live-data';

const storage = (warehouseCode: string, locationCode: string) => ({
  warehouse: { id: 5, code: warehouseCode, name: '입고 창고' },
  location: { id: 50, code: locationCode, name: '위치' },
});

describe('isPutawayStagingCode', () => {
  it('창고코드가 붙은 적치 대기(#292)와 옛 코드 둘 다 적치 대기로 본다', () => {
    expect(isPutawayStagingCode(storage('PTW-B', 'PTW-B-SYS-STAGING'))).toBe(true);
    expect(isPutawayStagingCode(storage('PTW-B', 'SYS-STAGING'))).toBe(true);
  });

  it('창고 전체 · 다른 창고의 적치 대기 · 위치 없음은 아니다', () => {
    expect(isPutawayStagingCode(storage('PTW-B', 'PTW-B-SYS-WHOLE'))).toBe(false);
    expect(isPutawayStagingCode(storage('PTW-B', 'S230-SYS-STAGING'))).toBe(false);
    expect(isPutawayStagingCode({ warehouse: null, location: null })).toBe(false);
  });
});

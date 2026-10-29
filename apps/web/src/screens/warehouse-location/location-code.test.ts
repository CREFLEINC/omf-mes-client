import { describe, expect, it } from 'vitest';

import { compareLocationCodes, issueLocationCode, locationCodeAt } from './location-code';
import type { Location } from './types';

const location = (
  locationId: number,
  locationCode: string,
  parentLocationId: number | null,
  systemRoleCode: string | null = null,
): Location =>
  ({
    locationId,
    warehouseId: 1,
    parentLocationId,
    locationCode,
    locationName: locationCode,
    locationTypeCode: 'RACK',
    allowMixedItem: true,
    allowMixedLot: true,
    isActive: true,
    systemRoleCode,
  }) as Location;

const staging = location(90, 'SYS-STAGING', null, 'PUTAWAY_STAGING');
const whole = location(91, 'SYS-WHOLE', null, 'WAREHOUSE_WHOLE');

describe('issueLocationCode', () => {
  it('첫 구역은 Z01 이다 — 서버가 만든 위치는 세지 않는다', () => {
    expect(issueLocationCode('ZONE', null, [staging, whole])).toBe('Z01');
  });

  it('같은 상위 안에서 가장 큰 번호 + 1 — 빈 앞 번호를 채우지 않는다(서버 규칙)', () => {
    const items = [staging, location(1, 'Z01', null), location(2, 'Z03', null)];

    expect(issueLocationCode('ZONE', null, items)).toBe('Z04');
  });

  it('꺼진 위치도 센다', () => {
    const zone = location(1, 'Z01', null);
    const off = { ...location(2, 'Z01-R001', 1), isActive: false };

    expect(issueLocationCode('RACK', zone, [zone, off])).toBe('Z01-R002');
  });

  it('모양이 다른 옛 코드는 세지 않는다', () => {
    const zone = location(1, 'LACK', null);
    const items = [zone, location(2, 'CELL 1', 1), location(3, 'LACK-R002', 1)];

    expect(issueLocationCode('RACK', zone, items)).toBe('LACK-R003');
  });
});

describe('locationCodeAt', () => {
  it('층 · 셀은 L · C 두 자리, 랙은 R 세 자리', () => {
    expect(locationCodeAt('LEVEL', 'Z01-R001', 1)).toBe('Z01-R001-L01');
    expect(locationCodeAt('CELL', 'Z01-R001-L01', 12)).toBe('Z01-R001-L01-C12');
    expect(locationCodeAt('RACK', 'Z01', 1000)).toBe('Z01-R1000');
  });
});

describe('compareLocationCodes', () => {
  it('숫자를 수로 읽어 R100 이 R99 뒤에 놓인다', () => {
    // 자리 수가 섞인 옛 코드도 수의 차례로 놓인다.
    const codes = ['Z01-R100', 'Z01-R99', 'Z01-R2', 'Z01-R010'];

    expect([...codes].sort(compareLocationCodes)).toEqual([
      'Z01-R2',
      'Z01-R010',
      'Z01-R99',
      'Z01-R100',
    ]);
  });
});

describe('랙 세 자리', () => {
  it('랙이 99개면 다음은 R100 이다', () => {
    const zone = location(1, 'Z01', null);
    const racks = Array.from({ length: 99 }, (_, index) =>
      location(100 + index, `Z01-R${String(index + 1).padStart(3, '0')}`, 1),
    );

    expect(issueLocationCode('RACK', zone, [zone, ...racks])).toBe('Z01-R100');
  });
});

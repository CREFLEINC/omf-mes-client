import { describe, expect, it } from 'vitest';

import { issueLocationCode, locationCodeAt } from './location-code';
import type { Location } from './types';

const location = (
  locationId: number,
  locationCode: string,
  parentLocationId: number | null,
  systemRoleCode: Location['systemRoleCode'] = null,
): Location => ({
  locationId,
  warehouseId: 1,
  parentLocationId,
  locationCode,
  locationName: locationCode,
  isActive: true,
  aliasName: null,
  locationLevelCode: null,
  isLeaf: true,
  systemRoleCode,
  hasItemRestriction: false,
  itemRestricted: false,
});

const staging = location(90, 'WH-SYS-STAGING', null, 'PUTAWAY_STAGING');
const whole = location(91, 'WH-SYS-WHOLE', null, 'WAREHOUSE_WHOLE');

describe('issueLocationCode', () => {
  it('첫 구역은 {창고 위치 코드}-Z01 이다 — 서버가 만든 위치는 세지 않는다(#292)', () => {
    expect(issueLocationCode('ZONE', null, [staging, whole], 'WH')).toBe('WH-Z01');
  });

  it('같은 상위 안에서 가장 큰 번호 + 1 — 빈 앞 번호를 채우지 않는다(서버 규칙)', () => {
    const items = [staging, location(1, 'WH-Z01', null), location(2, 'WH-Z03', null)];

    expect(issueLocationCode('ZONE', null, items, 'WH')).toBe('WH-Z04');
  });

  it('창고 위치 코드가 안 붙은 코드(Z05)는 번호에 세지 않는다(#292)', () => {
    const items = [location(1, 'Z05', null), location(2, 'WH-Z02', null)];

    expect(issueLocationCode('ZONE', null, items, 'WH')).toBe('WH-Z03');
  });

  it('다른 창고 위치 코드가 붙은 모양은 세지 않는다', () => {
    const items = [location(1, 'K7PM-Z07', null), location(2, 'K7-Z09', null)];

    expect(issueLocationCode('ZONE', null, items, 'K7PM')).toBe('K7PM-Z08');
    expect(issueLocationCode('ZONE', null, items, 'K7')).toBe('K7-Z10');
  });

  it('랙 · 층 · 셀은 창고 위치 코드가 붙은 상위 코드 뒤에 이어 붙는다', () => {
    const zone = location(1, 'K7PM-Z01', null);

    expect(issueLocationCode('RACK', zone, [zone], 'K7PM')).toBe('K7PM-Z01-R001');
    expect(locationCodeAt('CELL', 'K7PM-Z01-R001-L01', 1)).toBe('K7PM-Z01-R001-L01-C01');
  });

  it('창고 위치 코드로 시작하는 옛 수기 코드 밑은 그 코드 그대로 이어 붙는다', () => {
    const zone = location(1, 'K7PM-A-01-02', null);

    expect(issueLocationCode('RACK', zone, [zone], 'K7PM')).toBe('K7PM-A-01-02-R001');
  });

  it('꺼진 위치도 센다', () => {
    const zone = location(1, 'WH-Z01', null);
    const off = { ...location(2, 'WH-Z01-R001', 1), isActive: false };

    expect(issueLocationCode('RACK', zone, [zone, off], 'WH')).toBe('WH-Z01-R002');
  });

  it('모양이 다른 옛 코드는 세지 않는다', () => {
    const zone = location(1, 'LACK', null);
    const items = [zone, location(2, 'CELL 1', 1), location(3, 'LACK-R002', 1)];

    expect(issueLocationCode('RACK', zone, items, 'WH')).toBe('LACK-R003');
  });
});

describe('locationCodeAt', () => {
  it('층 · 셀은 L · C 두 자리, 랙은 R 세 자리', () => {
    expect(locationCodeAt('LEVEL', 'Z01-R001', 1)).toBe('Z01-R001-L01');
    expect(locationCodeAt('CELL', 'Z01-R001-L01', 12)).toBe('Z01-R001-L01-C12');
    expect(locationCodeAt('RACK', 'Z01', 1000)).toBe('Z01-R1000');
  });

  it('구역은 상위 코드 자리에 창고 위치 코드를 받는다', () => {
    expect(locationCodeAt('ZONE', 'K7PM', 1)).toBe('K7PM-Z01');
  });
});

describe('랙 세 자리', () => {
  it('랙이 99개면 다음은 R100 이다', () => {
    const zone = location(1, 'Z01', null);
    const racks = Array.from({ length: 99 }, (_, index) =>
      location(100 + index, `Z01-R${String(index + 1).padStart(3, '0')}`, 1),
    );

    expect(issueLocationCode('RACK', zone, [zone, ...racks], 'WH')).toBe('Z01-R100');
  });
});

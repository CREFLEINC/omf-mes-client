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
});

const staging = location(90, 'WH-SYS-STAGING', null, 'PUTAWAY_STAGING');
const whole = location(91, 'WH-SYS-WHOLE', null, 'WAREHOUSE_WHOLE');

describe('issueLocationCode', () => {
  it('첫 구역은 {창고코드}-Z01 이다 — 서버가 만든 위치는 세지 않는다(#292)', () => {
    expect(issueLocationCode('ZONE', null, [staging, whole], 'WH')).toBe('WH-Z01');
  });

  it('같은 상위 안에서 가장 큰 번호 + 1 — 빈 앞 번호를 채우지 않는다(서버 규칙)', () => {
    const items = [staging, location(1, 'WH-Z01', null), location(2, 'WH-Z03', null)];

    expect(issueLocationCode('ZONE', null, items, 'WH')).toBe('WH-Z04');
  });

  it('창고코드가 안 붙은 옛 구역(Z05)은 번호에 세지 않는다(#292)', () => {
    const items = [location(1, 'Z05', null), location(2, 'WH-Z02', null)];

    expect(issueLocationCode('ZONE', null, items, 'WH')).toBe('WH-Z03');
  });

  it('창고코드에 하이픈이 있어도 그대로 앞에 붙는다 — 다른 창고 코드 모양은 세지 않는다', () => {
    const items = [location(1, 'PTW-B-Z07', null), location(2, 'PTW-Z09', null)];

    expect(issueLocationCode('ZONE', null, items, 'PTW-B')).toBe('PTW-B-Z08');
    expect(issueLocationCode('ZONE', null, items, 'PTW')).toBe('PTW-Z10');
  });

  it('랙 · 층 · 셀은 창고코드가 붙은 상위 코드 뒤에 이어 붙는다', () => {
    const zone = location(1, 'PTW-B-Z01', null);

    expect(issueLocationCode('RACK', zone, [zone], 'PTW-B')).toBe('PTW-B-Z01-R001');
    expect(locationCodeAt('CELL', 'PTW-B-Z01-R001-L01', 1)).toBe('PTW-B-Z01-R001-L01-C01');
  });

  it('창고코드로 시작하는 옛 수기 코드 밑은 그 코드 그대로 이어 붙는다', () => {
    const zone = location(1, 'S230-A-01-02', null);

    expect(issueLocationCode('RACK', zone, [zone], 'S230')).toBe('S230-A-01-02-R001');
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

  it('구역은 상위 코드 자리에 창고코드를 받는다', () => {
    expect(locationCodeAt('ZONE', 'OH100073', 1)).toBe('OH100073-Z01');
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

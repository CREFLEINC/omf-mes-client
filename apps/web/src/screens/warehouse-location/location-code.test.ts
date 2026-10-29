import { describe, expect, it } from 'vitest';

import { compareLocationCodes, issueLocationCode, nextFreeLocationCode } from './location-code';
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

  it('구역 번호는 있는 구역 수 + 1 부터 시작한다', () => {
    const items = [staging, location(1, 'Z01', null), location(2, 'Z02', null)];

    expect(issueLocationCode('ZONE', null, items)).toBe('Z03');
  });

  it('랙은 구역 코드 뒤에 R 번호를 붙인다', () => {
    const zone = location(1, 'Z01', null);
    const items = [zone, location(2, 'Z01-R001', 1)];

    expect(issueLocationCode('RACK', zone, items)).toBe('Z01-R002');
  });

  it('창고 안에서 이미 쓰는 코드는 건너뛴다', () => {
    const zone = location(1, 'Z01', null);
    // 다른 상위 밑에 있어도 코드가 겹치면 쓸 수 없다.
    const items = [zone, location(2, 'Z02', null), location(3, 'Z01-R001', 2)];

    expect(issueLocationCode('RACK', zone, items)).toBe('Z01-R002');
  });

  it('앞 번호가 비어도 하위 수 + 1 부터 찾는다', () => {
    const zone = location(1, 'Z01', null);
    const items = [zone, location(2, 'Z01-R002', 1)];

    expect(issueLocationCode('RACK', zone, items)).toBe('Z01-R003');
  });
});

describe('nextFreeLocationCode', () => {
  it('층 · 셀은 L · C 번호를 붙이고 찾은 코드를 쓴 것으로 남긴다', () => {
    const used = new Set<string>();

    expect(nextFreeLocationCode('LEVEL', 'Z01-R001', 1, used)).toBe('Z01-R001-L01');
    expect(nextFreeLocationCode('LEVEL', 'Z01-R001', 1, used)).toBe('Z01-R001-L02');
    expect(nextFreeLocationCode('CELL', 'Z01-R001-L01', 1, used)).toBe('Z01-R001-L01-C01');
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

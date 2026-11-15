import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { destinationLocationLabel, locationLabelWithRole } from './system-location';

const ROLES = messages.warehouseLocation.values.systemRoles;

/* omf-all-around#268 — 출고 요청 입고지 · 입하 적치 위치를 다른 화면과 같은 규칙으로. */
describe('locationLabelWithRole', () => {
  it('사람이 만든 위치는 「코드 · 별칭」, 별칭이 없으면 「코드 · 이름」', () => {
    expect(
      locationLabelWithRole({
        locationCode: 'Z01-R001',
        locationName: 'R001',
        aliasName: 'A열 1번 랙',
      }),
    ).toBe('Z01-R001 · A열 1번 랙');
    expect(
      locationLabelWithRole({ locationCode: 'Z01-R002', locationName: '랙 R002', aliasName: null }),
    ).toBe('Z01-R002 · 랙 R002');
  });

  it('서버가 둔 위치는 코드 대신 역할 이름', () => {
    expect(
      locationLabelWithRole({
        locationCode: 'SYS-WHOLE',
        locationName: '창고 전체',
        aliasName: '1층 창고',
        systemRoleCode: 'WAREHOUSE_WHOLE',
      }),
    ).toBe(ROLES.WAREHOUSE_WHOLE);
    expect(
      locationLabelWithRole({
        locationCode: 'SYS-STAGING',
        locationName: '적치 대기',
        systemRoleCode: 'PUTAWAY_STAGING',
      }),
    ).toBe(ROLES.PUTAWAY_STAGING);
  });
});

describe('destinationLocationLabel', () => {
  it('입고지 코드 · 별칭이 실리면 「코드 · 별칭」', () => {
    expect(
      destinationLocationLabel({
        destinationLocationId: 501,
        destinationLocationName: 'L01',
        destinationLocationCode: 'Z01-R001-L01',
        destinationLocationAliasName: '조립 1라인 투입대',
        destinationLocationSystemRoleCode: null,
      }),
    ).toBe('Z01-R001-L01 · 조립 1라인 투입대');
  });

  it('별칭을 지우면 「코드 · 이름」, 이름이 코드와 같으면 코드만', () => {
    expect(
      destinationLocationLabel({
        destinationLocationId: 501,
        destinationLocationName: 'Z01',
        destinationLocationCode: 'Z01',
        destinationLocationAliasName: null,
      }),
    ).toBe('Z01');
  });

  it('서버가 둔 입고지는 역할 이름', () => {
    expect(
      destinationLocationLabel({
        destinationLocationId: 502,
        destinationLocationName: '창고 전체',
        destinationLocationCode: 'SYS-WHOLE',
        destinationLocationAliasName: null,
        destinationLocationSystemRoleCode: 'WAREHOUSE_WHOLE',
      }),
    ).toBe(ROLES.WAREHOUSE_WHOLE);
  });

  it('코드를 싣지 않는 옛 응답은 지금처럼 이름(없으면 번호)', () => {
    expect(
      destinationLocationLabel({
        destinationLocationId: 501,
        destinationLocationName: '합성 조립 현장',
      }),
    ).toBe('합성 조립 현장');
    expect(destinationLocationLabel({ destinationLocationId: 501 })).toBe('501');
  });
});

import { describe, expect, it } from 'vitest';

import {
  LOCATION_MANAGED_LEVEL_CODES,
  isLocationInputOpen,
  locationInputPendingNote,
} from './management-level';

/**
 * 자리표시 상수의 **지금 사실**과 **채워진 뒤의 동작**을 따로 잰다.
 *
 * 하나로 합치면 「비어 있으니 늘 열린다」밖에 재지 못해, 값이 채워지는 날 개폐가 실제로
 * 살아나는지 아무도 모른다 — 그때 이 화면을 다시 고쳐야 한다면 자리표시를 둔 뜻이 없다.
 */
describe('LOCATION_MANAGED_LEVEL_CODES — 지금의 사실', () => {
  it('비어 있다', () => {
    expect(LOCATION_MANAGED_LEVEL_CODES).toHaveLength(0);
  });

  it('배열이 비어 있는 동안에는 어느 창고에서도 위치 입력이 열린다', () => {
    expect(isLocationInputOpen(LOCATION_MANAGED_LEVEL_CODES, 'SYN-LEVEL')).toBe(true);
    expect(isLocationInputOpen(LOCATION_MANAGED_LEVEL_CODES, 'SYN-OTHER')).toBe(true);
  });

  /** 창고를 아직 모르는 상태도 잠그지 않는다 — 확인하지 못한 것을 근거로 막지 않는다. */
  it('관리수준을 모르는 창고에서도 열린다', () => {
    expect(isLocationInputOpen(LOCATION_MANAGED_LEVEL_CODES, null)).toBe(true);
  });

  it('안내가 선다', () => {
    expect(locationInputPendingNote(LOCATION_MANAGED_LEVEL_CODES)).toBeDefined();
  });
});

describe('isLocationInputOpen — 값이 채워진 뒤', () => {
  const filled = ['LOCATION'] as const;

  it('목록에 있는 관리수준에서는 열린다', () => {
    expect(isLocationInputOpen(filled, 'LOCATION')).toBe(true);
  });

  it('목록에 없는 관리수준에서는 잠긴다', () => {
    expect(isLocationInputOpen(filled, 'WAREHOUSE')).toBe(false);
  });

  /**
   * 값 목록이 정해진 뒤에 창고의 관리수준을 모르면 **잠근다.** 그때 열어 두면 위치를 쓰지
   * 않는 창고에 위치가 박힌 규칙이 들어가고, 그 규칙은 현장에서 맞출 수 없는 조건이 된다.
   */
  it('관리수준을 모르면 잠긴다', () => {
    expect(isLocationInputOpen(filled, null)).toBe(false);
  });

  /** 안내는 **아직 정해지지 않았다는 사실**을 말하는 것이라 정해진 뒤에는 서지 않는다. */
  it('안내가 사라진다', () => {
    expect(locationInputPendingNote(filled)).toBeUndefined();
  });
});

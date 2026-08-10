import { describe, expect, it } from 'vitest';

import { isLocationGroup, toLocationOptions } from './location-options';
import type { LocationView } from './types';

const location = (overrides: Partial<LocationView> = {}): LocationView => ({
  locationId: 9801,
  parentLocationId: null,
  locationCode: 'SAMPLE-LOC-A',
  locationName: '합성 위치 가',
  ...overrides,
});

const AREA: LocationView = location({ locationId: 9801, locationCode: 'SAMPLE-LOC-A' });
const RACK_ONE: LocationView = location({
  locationId: 9802,
  parentLocationId: 9801,
  locationCode: 'SAMPLE-LOC-A1',
  locationName: '합성 위치 가1',
});
const RACK_TWO: LocationView = location({
  locationId: 9803,
  parentLocationId: 9801,
  locationCode: 'SAMPLE-LOC-A2',
  locationName: '합성 위치 가2',
});
/** 3단 깊이 — 상위(9802)도 자기 위에 상위(9801)를 갖는다. */
const SHELF: LocationView = location({
  locationId: 9804,
  parentLocationId: 9802,
  locationCode: 'SAMPLE-LOC-A1-1',
  locationName: '합성 위치 가1-1',
});

describe('toLocationOptions — 상위 위치로 1단 그룹을 만든다', () => {
  it('상위가 없는 위치는 그룹 없이 평면으로 둔다', () => {
    const items = toLocationOptions([AREA]);

    expect(items).toEqual([{ value: '9801', label: 'SAMPLE-LOC-A · 합성 위치 가' }]);
  });

  /*
   * **M27** — 창고로 묶으면 그룹이 늘 하나뿐이라 뜻이 없고, 평면으로 펴면 어느 자리 아래인지
   * 사라진다. 묶는 기준은 **상위 위치**다(계획 결정 7).
   */
  it('같은 상위를 가진 위치들이 그 상위 이름의 한 그룹으로 묶인다', () => {
    const items = toLocationOptions([AREA, RACK_ONE, RACK_TWO]);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ value: '9801', label: 'SAMPLE-LOC-A · 합성 위치 가' });

    const group = items[1];

    if (group === undefined || !isLocationGroup(group)) throw new Error('그룹이 아니다');

    expect(group.label).toBe('SAMPLE-LOC-A · 합성 위치 가');
    expect(group.options.map((option) => option.value)).toEqual(['9802', '9803']);
  });

  /*
   * 디자인 시스템 `Select`는 **1단 그룹만** 지원한다. 3단 깊이를 억지로 접으면 계층이
   * 잘못 그려지므로 **직속 상위**를 그룹 라벨로 쓴다(계획 결정 7).
   */
  it('3단 깊이는 직속 상위로 묶는다 — 최상위로 올려 붙이지 않는다', () => {
    const items = toLocationOptions([AREA, RACK_ONE, SHELF]);
    const groups = items.filter(isLocationGroup);

    expect(groups.map((group) => group.label)).toEqual([
      'SAMPLE-LOC-A · 합성 위치 가',
      'SAMPLE-LOC-A1 · 합성 위치 가1',
    ]);
    expect(groups[1]?.options.map((option) => option.value)).toEqual(['9804']);
  });

  /*
   * 목록이 잘렸거나 상위가 사용 중지된 경우다. **모르는 상위끼리 한 그룹으로 묶지 않는다** —
   * 서로 다른 자리가 같은 자리처럼 읽힌다. 이름을 지어내지도 않는다.
   */
  it('상위를 목록에서 찾지 못하면 그 위치를 평면으로 둔다', () => {
    const orphan = location({ locationId: 9805, parentLocationId: 9899 });
    const items = toLocationOptions([AREA, orphan]);

    expect(items.filter(isLocationGroup)).toHaveLength(0);
    expect(items.map((item) => (isLocationGroup(item) ? item.label : item.value))).toEqual([
      '9801',
      '9805',
    ]);
  });

  /*
   * 목 서버가 실제로 이렇게 내려준다(실측) — 자기 자신을 상위로 가리키는 행. 그대로 접으면
   * 자기 이름의 그룹 안에 자기가 들어가는 자리가 생긴다.
   */
  it('자기 자신을 상위로 가리키면 상위가 없는 것으로 본다', () => {
    const items = toLocationOptions([location({ locationId: 9801, parentLocationId: 9801 })]);

    expect(items).toEqual([{ value: '9801', label: 'SAMPLE-LOC-A · 합성 위치 가' }]);
  });

  it('그룹은 첫 항목이 나온 자리에 선다 — 응답 차례를 흩뜨리지 않는다', () => {
    const items = toLocationOptions([RACK_ONE, AREA, RACK_TWO]);

    expect(items).toHaveLength(2);
    expect(isLocationGroup(items[0])).toBe(true);
    expect(isLocationGroup(items[1])).toBe(false);
  });

  it('빈 목록은 빈 선택지다', () => {
    expect(toLocationOptions([])).toEqual([]);
  });
});

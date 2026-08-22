import { describe, expect, it } from 'vitest';

import { TARGET_TYPES, targetTypeLabel, unassignedPlantCount } from './application-targets';
import { makeApplication } from './fixtures';

const labels = { plant: '공장', equipmentGroup: '설비 그룹' };

describe('unassignedPlantCount', () => {
  /*
   * ⭐ **「필수」인데 없을 수 있다**(스펙 §6). 공장을 새로 만들면 잠시 기본 캘린더가 없는 것이
   * 정상이라 저장을 막지 않고 그 사실만 센다.
   */
  it('적용이 없는 공장을 센다', () => {
    expect(unassignedPlantCount(['11', '12'], [makeApplication({ targetId: 11 })])).toBe(1);
  });

  it('모두 지정돼 있으면 0 이다', () => {
    expect(
      unassignedPlantCount(
        ['11', '12'],
        [makeApplication({ targetId: 11 }), makeApplication({ targetId: 12 })],
      ),
    ).toBe(0);
  });

  /*
   * ⛔ **이 캘린더의 적용만 보고 세지 않는다** — 다른 캘린더를 따르는 공장은 미지정이 아니다.
   * 세는 근거가 전체 공장 적용이라는 것을 이 시험이 고정한다.
   */
  it('다른 캘린더를 따르는 공장도 지정된 것으로 센다', () => {
    expect(
      unassignedPlantCount(
        ['11', '12'],
        [
          makeApplication({ targetId: 11, workCalendarId: 5001 }),
          makeApplication({ targetId: 12, workCalendarId: 5002 }),
        ],
      ),
    ).toBe(0);
  });

  /* 설비 그룹 적용은 공장 지정이 아니다 — 유형을 가리지 않으면 미지정 공장이 사라진다. */
  it('설비 그룹 적용을 공장 지정으로 세지 않는다', () => {
    expect(
      unassignedPlantCount(
        ['11'],
        [makeApplication({ targetTypeCode: TARGET_TYPES.equipmentGroup, targetId: 11 })],
      ),
    ).toBe(1);
  });

  /*
   * ⛔ **공장 목록을 아직 못 받았으면 0 이 아니라 「모른다」다**(G-9).
   * 0 으로 그리면 지정이 빠진 공장이 있는데도 화면이 조용해진다.
   */
  it('공장 목록이 비어 있으면 모른다', () => {
    expect(unassignedPlantCount([], [])).toBeNull();
  });

  it('적용이 하나도 없으면 전부 미지정이다', () => {
    expect(unassignedPlantCount(['11', '12', '13'], [])).toBe(3);
  });
});

describe('targetTypeLabel', () => {
  it('두 값을 사람 이름으로 푼다', () => {
    expect(targetTypeLabel(TARGET_TYPES.plant, labels)).toBe('공장');
    expect(targetTypeLabel(TARGET_TYPES.equipmentGroup, labels)).toBe('설비 그룹');
  });

  /* ⛔ 모르는 값의 이름을 지어내지 않는다 — 코드를 그대로 보인다(G-9). */
  it('모르는 값은 코드를 그대로 보인다', () => {
    expect(targetTypeLabel('EQUIPMENT', labels)).toBe('EQUIPMENT');
  });
});

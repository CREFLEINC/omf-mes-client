import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { hasOwnAssignment, isInspected, resolutionText } from './inspection-resolution';
import type { EquipmentInspectionAssignments } from './types';

const t = messages.equipmentMaster.inspection.resolution;

const data = (
  overrides: Partial<EquipmentInspectionAssignments> = {},
): EquipmentInspectionAssignments => ({
  assigned: [],
  effective: [],
  resolvedFromLevelCode: 'NONE',
  ...overrides,
});

describe('점검 대상인가', () => {
  it('어느 층에서도 오지 않으면 대상이 아니다', () => {
    expect(isInspected(data())).toBe(false);
  });

  it('설비에서 왔으면 대상이다', () => {
    expect(isInspected(data({ resolvedFromLevelCode: 'EQUIPMENT' }))).toBe(true);
  });

  it('그룹에서 왔어도 대상이다', () => {
    expect(isInspected(data({ resolvedFromLevelCode: 'EQUIPMENT_GROUP' }))).toBe(true);
  });
});

describe('설비 자신의 부여가 이기고 있는가', () => {
  it('설비에서 왔으면 그렇다', () => {
    expect(hasOwnAssignment(data({ resolvedFromLevelCode: 'EQUIPMENT' }))).toBe(true);
  });

  /** ⭐ 그룹에서 온 것은 설비의 부여가 «없다»는 뜻이다 — 가장 가까운 것이 이긴다. */
  it('그룹에서 왔으면 아니다', () => {
    expect(hasOwnAssignment(data({ resolvedFromLevelCode: 'EQUIPMENT_GROUP' }))).toBe(false);
  });

  it('아무 데서도 안 왔으면 아니다', () => {
    expect(hasOwnAssignment(data())).toBe(false);
  });
});

describe('어디서 왔는지 한 줄로', () => {
  const labels = new Map([[101, 'GRP-A · 프레스라인']]);

  it('설비에서 왔으면 그렇게 말한다', () => {
    expect(resolutionText(data({ resolvedFromLevelCode: 'EQUIPMENT' }), labels)).toBe(t.equipment);
  });

  it('그룹에서 왔으면 어느 그룹인지 말한다', () => {
    expect(
      resolutionText(
        data({ resolvedFromLevelCode: 'EQUIPMENT_GROUP', resolvedFromGroupId: 101 }),
        labels,
      ),
    ).toBe(t.group('GRP-A · 프레스라인'));
  });

  /**
   * ⚠ **층은 아는 사실이고 이름은 모르는 사실이다**(G-9). 이름을 못 찾았다고 「대상 아님」으로
   * 뭉개면 있는 점검이 없어 보인다.
   */
  it('그룹 이름을 모르면 층까지만 말한다', () => {
    const text = resolutionText(
      data({ resolvedFromLevelCode: 'EQUIPMENT_GROUP', resolvedFromGroupId: 999 }),
      labels,
    );

    expect(text).toBe(t.groupUnknown);
    expect(text).not.toBe(t.none);
  });

  it('그룹 식별자조차 오지 않아도 층까지는 말한다', () => {
    expect(resolutionText(data({ resolvedFromLevelCode: 'EQUIPMENT_GROUP' }), labels)).toBe(
      t.groupUnknown,
    );
  });

  it('대상이 아니면 그 사실을 말한다', () => {
    expect(resolutionText(data(), labels)).toBe(t.none);
  });
});

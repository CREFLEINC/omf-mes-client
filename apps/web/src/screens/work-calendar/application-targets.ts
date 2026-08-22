import type { components } from '@omf-mes/api-client';

export type WorkCalendarApplication = components['schemas']['WorkCalendarApplication'];

/** 계약이 정한 두 값. **설비 단위는 두지 않는다** — 대상은 공장 또는 설비 그룹이다. */
export const TARGET_TYPES = {
  plant: 'PLANT',
  equipmentGroup: 'EQUIPMENT_GROUP',
} as const;

export type TargetTypeCode = (typeof TARGET_TYPES)[keyof typeof TARGET_TYPES];

/**
 * 기본 캘린더가 지정되지 않은 공장 수.
 *
 * ⭐ **「필수」인데 없을 수 있다**(스펙 §6). 공장을 새로 만들면 잠시 기본 캘린더가 없는 것이
 * 정상이라 **저장을 막지 않고** 그 사실만 세어 보인다.
 *
 * ⛔ **이 캘린더의 적용만 보고 세지 않는다** — 다른 캘린더를 따르는 공장은 미지정이 아니다.
 * 세는 근거는 **전체 공장 적용**이어야 한다.
 *
 * ⛔ **공장 목록을 아직 못 받았으면 0 이 아니라 `null`** — 모르는 것을 「없다」로 그리면
 * 지정이 빠진 공장이 있는데도 화면이 조용해진다(공유계약 G-9).
 */
export const unassignedPlantCount = (
  plantIds: readonly string[],
  plantApplications: readonly WorkCalendarApplication[],
): number | null => {
  if (plantIds.length === 0) return null;

  const assigned = new Set(
    plantApplications
      .filter((item) => item.targetTypeCode === TARGET_TYPES.plant)
      .map((item) => String(item.targetId)),
  );

  return plantIds.filter((plantId) => !assigned.has(plantId)).length;
};

/** 대상 유형의 사람 이름. 모르는 값이 오면 코드를 그대로 보인다(G-9). */
export const targetTypeLabel = (
  targetTypeCode: string,
  labels: { plant: string; equipmentGroup: string },
): string => {
  if (targetTypeCode === TARGET_TYPES.plant) return labels.plant;
  if (targetTypeCode === TARGET_TYPES.equipmentGroup) return labels.equipmentGroup;

  return targetTypeCode;
};

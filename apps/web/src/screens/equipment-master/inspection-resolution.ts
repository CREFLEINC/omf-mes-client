import { messages } from '@omf-mes/i18n';

import type { EquipmentInspectionAssignments } from './types';

const t = messages.equipmentMaster.inspection;

/**
 * 「이 설비는 어느 점검 항목을 도는가」의 **해석**.
 *
 * ⛔ **화면이 다시 해석하지 않는다**(공유계약 B-17 · 스펙 §4-C). 서버가 답(`effective`)과
 * **그 근거**(`resolvedFromLevelCode`)를 함께 주고, 화면은 그것을 «말할» 뿐이다. 두 곳에서
 * 해석하면 서버가 규칙을 바꿨을 때 화면이 조용히 옛 규칙으로 답한다.
 *
 * ⭐ **2층이다** — 설비 → 소속 그룹. 캘린더(결정 03)와 달리 공장 층이 없다: 가동일은 공장
 * 전체가 공유하지만 점검 항목은 설비 종류마다 달라 공장 기본값이 성립하지 않는다.
 */

/** 이 설비가 점검 대상인가. `NONE` 이면 돌 항목이 하나도 없다. */
export const isInspected = (data: EquipmentInspectionAssignments): boolean =>
  data.resolvedFromLevelCode !== 'NONE';

/** 설비 자신에게 부여가 있는가 — 있으면 그것이 그룹의 것을 이긴다. */
export const hasOwnAssignment = (data: EquipmentInspectionAssignments): boolean =>
  data.resolvedFromLevelCode === 'EQUIPMENT';

/**
 * 지금 도는 항목이 **어디서 왔는지** 한 줄로.
 *
 * ⛔ **어디서 왔는지 말하지 않으면 사용자가 엉뚱한 자리를 고친다** — 그룹에서 온 항목을
 * 설비 화면에서 지우려 하거나, 반대로 설비에 부여해 둔 것을 그룹에서 찾는다.
 *
 * ⚠ **그룹 이름을 모르면 지어내지 않는다**(G-9). 그룹 식별자는 왔는데 이름을 못 찾으면
 * 「소속 그룹에서 온다」까지만 말한다 — 층은 아는 사실이고 이름은 모르는 사실이다.
 */
export const resolutionText = (
  data: EquipmentInspectionAssignments,
  groupLabels: ReadonlyMap<number, string>,
): string => {
  if (data.resolvedFromLevelCode === 'NONE') return t.resolution.none;
  if (data.resolvedFromLevelCode === 'EQUIPMENT') return t.resolution.equipment;

  const groupId = data.resolvedFromGroupId ?? null;
  const label = groupId === null ? undefined : groupLabels.get(groupId);

  return label === undefined ? t.resolution.groupUnknown : t.resolution.group(label);
};

/*
 * ⛔ **「비우면 무엇이 되는가」를 화면이 셈하지 않는다.** 응답은 `effective` 가 «어디서
 * 왔는지»만 말하고 그룹에 무엇이 있는지는 말하지 않는다 — 설비의 부여를 지웠을 때 그룹의
 * 것이 뜰지 아무것도 없을지 이 응답만으로는 알 수 없다. 그래서 창은 **규칙을 문장으로**
 * 말한다("지우면 소속 그룹의 것이 적용됩니다"): 규칙은 참이고, 결과의 예언은 참이 아니다.
 */

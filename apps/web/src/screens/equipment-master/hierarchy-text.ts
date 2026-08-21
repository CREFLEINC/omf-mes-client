import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

export type EquipmentHierarchy = components['schemas']['EquipmentHierarchy'];

/** 계층 한 줄을 잇는 이음쇠. */
const SEPARATOR = ' > ';

/**
 * 설비의 위치를 계층 텍스트 한 줄로 그린다 — 「공장 > 상위 그룹 > 하위 그룹 > 설비」.
 *
 * ⭐ **재료를 화면이 모으지 않는다.** 상세 응답의 `hierarchy` 가 이미 풀린 이름으로 온다
 * (이슈 §6). 화면이 그룹을 거슬러 올라가며 이름을 조회하면 서버와 다른 답을 낼 수 있다.
 *
 * ⛔ **잇기 전에 항목별로 거른다.** 빈 문자열이나 공백만 있는 이름이 섞이면, 이어 붙인 뒤
 * 검사하는 형태에서는 이음쇠만 남은 조각(`공장 >  > 설비`)이 그대로 그려진다.
 * 같은 구멍이 저장소의 사본 열다섯 곳에 공유된 적이 있다(client#192).
 *
 * ⛔ **거르는 자리는 하나다.** 그룹 이름만 따로 거르고 여기서 또 거르면 두 자리가 같은 것을
 * 지키게 되고, 어느 쪽이 실제로 지키는지 알 수 없어진다 — 한쪽을 지워도 아무 감지기가
 * 울지 않는다. 공장·설비 이름도 같은 이유로 함께 걸러야 하므로 **바깥 한 자리**로 모은다.
 */
export const hierarchyText = (hierarchy: EquipmentHierarchy): string =>
  [hierarchy.plantName, ...hierarchy.groupNames, hierarchy.equipmentName]
    .filter((part) => part.trim() !== '')
    .join(SEPARATOR);

/**
 * 소속 그룹이 없다는 사실을 밝힐지.
 *
 * ⚠ **빈칸으로 두지 않는다**(G-9 · 이슈 §6). 알람 화면에서 위치가 「공장」으로만 나오면
 * 찾아갈 수 없으므로, **여기서 비어 있음이 보여야 채운다.**
 *
 * ⭐ **판정의 주인은 `groupAssigned` 다.** `groupNames` 가 비었는지로 세지 않는다 —
 * 소속은 있는데 이름을 풀지 못한 경우와 소속이 아예 없는 경우는 다른 사실이고,
 * 그 구분은 서버가 내린다.
 */
export const groupAssignmentNote = (hierarchy: EquipmentHierarchy): string | null =>
  hierarchy.groupAssigned ? null : messages.equipmentMaster.values.noGroupAssigned;

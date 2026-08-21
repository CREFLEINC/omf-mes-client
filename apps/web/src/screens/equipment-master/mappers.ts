import type { components } from '@omf-mes/api-client';

import { PENDING_CODE_VALUE } from './code-options';
import type { EquipmentGroup, GroupFormValues } from './types';

type EquipmentGroupCreate = components['schemas']['EquipmentGroupCreate'];
type EquipmentGroupUpdate = components['schemas']['EquipmentGroupUpdate'];

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * ⭐ **화면 용어와 계약 필드 이름이 갈리는 자리도 여기 하나다.** 설비 그룹의 저장처 이름이
 * `production_line` 이라 설비 응답이 소속 그룹을 `productionLineId` 로 부른다 — 같은 값이며,
 * 화면·타입·문구는 전부 「설비 그룹」으로 부른다.
 */

/** 널·없음을 모두 빈 문자열로 모은다 — 선택칸의 「고르지 않음」이 하나의 값이어야 한다. */
const optionalIdToText = (id: number | null | undefined): string =>
  id === null || id === undefined ? '' : String(id);

/** 빈 문자열은 「고르지 않음」이므로 널로 되돌린다. 0은 유효한 id가 아니다. */
const textToOptionalId = (value: string): number | null => (value === '' ? null : Number(value));

export const groupToFormValues = (group: EquipmentGroup): GroupFormValues => ({
  plantId: String(group.plantId),
  groupCode: group.groupCode,
  groupName: group.groupName,
  groupTypeCode: group.groupTypeCode,
  parentGroupId: optionalIdToText(group.parentGroupId),
});

/**
 * 신규 등록 폼의 초기값.
 *
 * 그룹유형만 자리표시 값을 쓴다 — 공통코드 목록이 확정되지 않아 고를 수 있는 값이 그것뿐이다.
 * 공장은 비워 둔다. **좌측에서 고른 그룹의 공장을 기본값으로 넣지 않는다** — 등록 후에는 바꿀
 * 수 없는 값이라, 사용자가 고른 적 없는 값이 조용히 굳으면 되돌릴 길이 없다.
 */
export const emptyGroupFormValues = (): GroupFormValues => ({
  plantId: '',
  groupCode: '',
  groupName: '',
  groupTypeCode: PENDING_CODE_VALUE,
  parentGroupId: '',
});

/**
 * 그룹 수정 요청 본문.
 *
 * ⛔ **`plantId` 는 실리지 않는다** — 계약의 수정 본문에 그 칸이 없다. 공장은 등록으로만 정한다.
 * ⛔ **`isActive` 도 실리지 않는다** — 사용 중지는 별도 경로가 받는다.
 *
 * ⭐ **`groupCode` 는 잠기지 않았을 때만 싣는다.** 계약이 「참조가 0일 때만 보낼 수 있다」고
 * 정했다. 잠긴 코드를 그대로 되돌려 보내면 값이 같아도 서버가 계약 위반으로 거절할 수 있고,
 * 화면은 사용자가 건드리지도 않은 칸 때문에 저장이 막힌 이유를 설명하지 못한다.
 */
export const toGroupUpdate = (
  values: GroupFormValues,
  codeEditable: boolean,
): EquipmentGroupUpdate => ({
  // 앞뒤 공백이 붙은 코드는 눈으로 구분되지 않는 다른 코드가 된다.
  ...(codeEditable ? { groupCode: values.groupCode.trim() } : {}),
  groupName: values.groupName.trim(),
  groupTypeCode: values.groupTypeCode,
  parentGroupId: textToOptionalId(values.parentGroupId),
});

/**
 * 그룹 등록 요청 본문. 계약상 수정 본문에 `plantId` 를 더한 형태이며,
 * 신규는 코드가 언제나 편집 가능하므로 `groupCode` 를 반드시 싣는다.
 */
export const toGroupCreate = (values: GroupFormValues): EquipmentGroupCreate => ({
  ...toGroupUpdate(values, true),
  groupCode: values.groupCode.trim(),
  plantId: Number(values.plantId),
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameGroupValues = (a: GroupFormValues, b: GroupFormValues): boolean =>
  a.plantId === b.plantId &&
  a.groupCode === b.groupCode &&
  a.groupName === b.groupName &&
  a.groupTypeCode === b.groupTypeCode &&
  a.parentGroupId === b.parentGroupId;

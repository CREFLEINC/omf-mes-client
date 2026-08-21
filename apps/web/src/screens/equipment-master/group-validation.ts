import { messages } from '@omf-mes/i18n';

import type { GroupFormValues } from './types';

const t = messages.equipmentMaster.validation;

/**
 * 그룹 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const GROUP_FORM_FIELDS: readonly string[] = [
  'plantId',
  'groupCode',
  'groupName',
  'groupTypeCode',
  'parentGroupId',
];

export interface GroupValidationContext {
  mode: 'create' | 'edit';
  /**
   * 상위로 고르면 순환이 생기는 식별자 — 자기 자신과 모든 후손.
   * 등록에는 후손이 없으므로 빈 집합이다.
   */
  cycleBlockedIds: ReadonlySet<number>;
}

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * 코드 중복은 검사하지 않는다 — 계약이 유일성 판정을 서버 몫으로 두었고,
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * ⭐ **순환은 예외다 — 화면이 진다.** 데이터베이스의 제약이 막는 것은 **직계 자기참조뿐**이라
 * A→B→A 는 그대로 저장된다(설계 스펙 §8-4 · A-9 등급 2). 선택지에서 빼는 것만으로 끝내지
 * 않고 여기서 다시 보는 이유는, 선택지가 만들어진 뒤 목록이 갱신돼 낡았을 수 있어서다.
 */
export const validateGroup = (
  values: GroupFormValues,
  context: GroupValidationContext,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.groupCode === '') {
    errors.groupCode = t.required;
  } else if (values.groupCode.trim() === '') {
    errors.groupCode = t.codeBlank;
  }

  if (values.groupName.trim() === '') {
    errors.groupName = t.required;
  }

  if (values.groupTypeCode === '') {
    errors.groupTypeCode = t.required;
  }

  // 공장은 등록 후 바꿀 수 없어 수정 요청에 실리지 않는다.
  if (context.mode === 'create' && values.plantId === '') {
    errors.plantId = t.required;
  }

  if (values.parentGroupId !== '' && context.cycleBlockedIds.has(Number(values.parentGroupId))) {
    errors.parentGroupId = t.parentCycle;
  }

  return errors;
};

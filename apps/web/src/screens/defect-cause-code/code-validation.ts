import { messages } from '@omf-mes/i18n';

import { hasChildren, isCategory } from './hierarchy';
import type { CodeFormValues, HierarchyCode } from './types';

const t = messages.defectCauseCode.validation;

/**
 * 계층 판정에 쓰는 목록과 편집 대상.
 *
 * 목록은 **화면의 조회 조건과 무관한 전체 목록**이어야 한다. 「미사용 포함」이 꺼져 있다고
 * 미사용 대분류 밑의 상세 코드를 고칠 수 없게 되면 안 된다.
 */
export interface CodeHierarchyContext {
  items: readonly HierarchyCode[];
  /** 수정 중이면 그 코드 번호, 등록이면 null */
  editingId: number | null;
  /**
   * 서버에 저장돼 있는 상위 값(폼 표기 그대로, 대분류이면 빈 문자열).
   * 「지금 상위를 바꾸려 하는가」의 판정 기준이며 R3가 이것을 쓴다.
   */
  savedParentId: string;
}

/** 폼이 소유한 입력칸 이름. 서버 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준의 폼 쪽 이름이다. */
export const CODE_FORM_FIELDS: readonly (keyof CodeFormValues)[] = ['code', 'name', 'parentId'];

/**
 * 2계층을 깨는 입력을 저장 전에 막는다 — 선택지에서 빼는 1차 방어만으로는 부족하다.
 * 목록이 갱신되는 사이의 시차나 주소 조작으로 뚫리기 때문이다.
 *
 * | R1 | 자기 자신을 상위로 지정할 수 없다 |
 * | R2 | 상위를 **바꿀 때** 대분류만 지정할 수 있다(3계층 금지) |
 * | R3 | 하위가 있는 코드에 **상위를 바꿔** 붙일 수 없다(그 하위가 3계층이 된다) |
 *
 * **R2·R3는 「지금 상위를 바꾸려 하는가」를 함께 본다.** 규칙이 엄해서가 아니라
 * 두 규칙이 값만 보면 **명칭만 고치려는 사람까지 막기** 때문이다.
 * 계약 문서가 인정하듯 이미 2계층을 넘어선 기존 데이터가 있고, 그런 행에서 R2와 R3는
 * **서로의 탈출구를 막는다** — 상위가 상세 코드이면서 자기도 하위를 가진 행은
 * 명칭을 고치려 하면 R2가, 상위를 대분류로 바꿔 빠져나가려 하면 R3가 막아 영구히 잠긴다.
 *
 * 그래서 둘 다 **저장된 상위와 다른 값을 넣을 때만** 발동한다. 새로 계층을 깨는 것은
 * 값이 달라지므로 여전히 막히고, 기존 값을 그대로 되돌려 보내는 것은 서버에 이미 있는
 * 상태라 새 위반을 만들지 않는다. R1은 좁히지 않는다 — 자기참조는 계약→화면 변환이
 * 대분류로 접으므로 「저장된 상위」가 될 수 없다.
 *
 * **목록에 없는 상위는 막지 않는다.** 전체 목록이 잘렸을 때 계층을 판정할 수 없는데 막아 버리면
 * 고칠 길이 사라진다. 그 경우는 서버 400에 맡기고 오류를 상위 선택칸 옆에 낸다.
 *
 * 코드 중복은 검사하지 않는다 — 계약이 유효성 판정을 서버 몫으로 두었고,
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 */
export const validateCode = (
  values: CodeFormValues,
  context: CodeHierarchyContext,
): Partial<Record<keyof CodeFormValues, string>> => {
  const errors: Partial<Record<keyof CodeFormValues, string>> = {};

  if (values.code === '') {
    errors.code = t.required;
  } else if (values.code.trim() === '') {
    errors.code = t.codeBlank;
  }

  if (values.name.trim() === '') {
    errors.name = t.required;
  }

  if (values.parentId === '') return errors;

  const parentId = Number(values.parentId);
  const { editingId, items, savedParentId } = context;

  if (editingId !== null && parentId === editingId) {
    errors.parentId = t.parentSelfReference;
    return errors;
  }

  const isChangingParent = values.parentId !== savedParentId;

  if (editingId !== null && isChangingParent && hasChildren(items, editingId)) {
    errors.parentId = t.parentBlockedByChildren;
    return errors;
  }

  const parent = items.find((item) => item.id === parentId);
  if (isChangingParent && parent !== undefined && !isCategory(parent)) {
    errors.parentId = t.parentMustBeCategory;
  }

  return errors;
};

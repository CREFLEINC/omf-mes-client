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
}

/** 폼이 소유한 입력칸 이름. 서버 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준의 폼 쪽 이름이다. */
export const CODE_FORM_FIELDS: readonly (keyof CodeFormValues)[] = ['code', 'name', 'parentId'];

/**
 * 2계층을 깨는 입력을 저장 전에 막는다 — 선택지에서 빼는 1차 방어만으로는 부족하다.
 * 목록이 갱신되는 사이의 시차나 주소 조작으로 뚫리기 때문이다.
 *
 * | R1 | 자기 자신을 상위로 지정할 수 없다 |
 * | R2 | 상위는 대분류만 지정할 수 있다(3계층 금지) |
 * | R3 | 하위가 있는 코드에는 상위를 지정할 수 없다(그 하위가 3계층이 된다) |
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
  const { editingId, items } = context;

  if (editingId !== null && parentId === editingId) {
    errors.parentId = t.parentSelfReference;
    return errors;
  }

  if (editingId !== null && hasChildren(items, editingId)) {
    errors.parentId = t.parentBlockedByChildren;
    return errors;
  }

  const parent = items.find((item) => item.id === parentId);
  if (parent !== undefined && !isCategory(parent)) {
    errors.parentId = t.parentMustBeCategory;
  }

  return errors;
};

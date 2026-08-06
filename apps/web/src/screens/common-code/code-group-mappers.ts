import type { components } from '@omf-mes/api-client';

import type { CodeGroup, CodeGroupFormValues } from './types';

type CodeGroupCreate = components['schemas']['CodeGroupCreate'];
type CodeGroupUpdate = components['schemas']['CodeGroupUpdate'];

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 DS 입력이 문자열을 다루기 때문이고,
 * 계약은 선택 필드를 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 */

export const codeGroupToFormValues = (codeGroup: CodeGroup): CodeGroupFormValues => ({
  groupCode: codeGroup.groupCode,
  groupName: codeGroup.groupName,
  // 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다.
  description: codeGroup.description ?? '',
});

export const emptyCodeGroupFormValues = (): CodeGroupFormValues => ({
  groupCode: '',
  groupName: '',
  description: '',
});

/**
 * 코드그룹 수정 요청 본문.
 *
 * **사용 여부(`isActive`)와 번호(`codeGroupId`)를 싣지 않는다** —
 * 사용 여부는 `:deactivate`로만 바뀌고 번호는 경로에 있다. 실어 보내면 계약 위반이다.
 *
 * **설명은 비어도 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을 남길 수 있어
 * 한 번 넣은 설명을 지울 방법이 사라진다.
 */
export const toCodeGroupUpdate = (values: CodeGroupFormValues): CodeGroupUpdate => ({
  // 앞뒤 공백이 붙은 코드·이름은 눈으로 구분되지 않는 다른 값이 된다.
  groupCode: values.groupCode.trim(),
  groupName: values.groupName.trim(),
  description: values.description.trim() === '' ? null : values.description.trim(),
});

/**
 * 코드그룹 등록 요청 본문. 계약이 수정 본문과 같은 항목을 받는다 —
 * 사용 여부는 등록에서도 받지 않는다(신규는 항상 사용 중).
 */
export const toCodeGroupCreate = (values: CodeGroupFormValues): CodeGroupCreate =>
  toCodeGroupUpdate(values);

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameCodeGroupValues = (a: CodeGroupFormValues, b: CodeGroupFormValues): boolean =>
  a.groupCode === b.groupCode && a.groupName === b.groupName && a.description === b.description;

import type { components } from '@omf-mes/api-client';

import type { CodeValue, CodeValueFormValues } from './code-value-types';

type CodeValueCreate = components['schemas']['CodeValueCreate'];
type CodeValueUpdate = components['schemas']['CodeValueUpdate'];

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 DS 입력이 문자열을 다루기 때문이고,
 * 계약은 정렬 순서를 숫자로, 유효기간을 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 */

/** 계약이 정한 정렬 순서의 기본값. 「지정하지 않음」이 아니라 실제로 저장되는 값이다. */
const DEFAULT_DISPLAY_ORDER = '0';

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. */
const dateToNullable = (value: string): string | null => (value === '' ? null : value);

export const codeValueToFormValues = (codeValue: CodeValue): CodeValueFormValues => ({
  code: codeValue.code,
  codeName: codeValue.codeName,
  // 0은 「지정하지 않음」이 아니라 계약의 기본값이다 — 빈 칸으로 뭉개면 안 된다.
  displayOrder: String(codeValue.displayOrder),
  effectiveFrom: codeValue.effectiveFrom ?? '',
  effectiveTo: codeValue.effectiveTo ?? '',
});

export const emptyCodeValueFormValues = (): CodeValueFormValues => ({
  code: '',
  codeName: '',
  displayOrder: DEFAULT_DISPLAY_ORDER,
  effectiveFrom: '',
  effectiveTo: '',
});

/**
 * 코드값 수정 요청 본문.
 *
 * **`codeGroupId`·`isActive`·`codeValueId`를 싣지 않는다** — 수정으로 그룹을 바꿀 수 없고
 * (계약: 신규만), 사용 여부는 `:deactivate`로만 바뀌며, 번호는 경로에 있다.
 *
 * **유효기간은 비어도 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을 남길 수 있어
 * 한 번 넣은 기간을 지울 방법이 사라진다.
 */
export const toCodeValueUpdate = (values: CodeValueFormValues): CodeValueUpdate => ({
  // 앞뒤 공백이 붙은 코드·이름은 눈으로 구분되지 않는 다른 값이 된다.
  code: values.code.trim(),
  codeName: values.codeName.trim(),
  displayOrder: Number(values.displayOrder.trim()),
  effectiveFrom: dateToNullable(values.effectiveFrom),
  effectiveTo: dateToNullable(values.effectiveTo),
});

/**
 * 코드값 등록 요청 본문.
 *
 * **좌측에서 고른 코드그룹 번호가 실린다** — 계약이 등록에서만 그 값을 받는다.
 * 빼면 서버가 어느 그룹에 넣을지 알 수 없다.
 */
export const toCodeValueCreate = (
  codeGroupId: number,
  values: CodeValueFormValues,
): CodeValueCreate => ({ codeGroupId, ...toCodeValueUpdate(values) });

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameCodeValueValues = (a: CodeValueFormValues, b: CodeValueFormValues): boolean =>
  a.code === b.code &&
  a.codeName === b.codeName &&
  a.displayOrder === b.displayOrder &&
  a.effectiveFrom === b.effectiveFrom &&
  a.effectiveTo === b.effectiveTo;

import { messages } from '@omf-mes/i18n';

import type { CodeFilters, CodeOption, HierarchyCode } from './types';

/**
 * 화면 상수와 선택지 표시 규칙을 한 파일에 격리한다.
 * 대분류 목록이 확정되면 이 파일만 고치면 된다.
 */

/** 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다. */
export const DEFAULT_CODE_FILTERS: CodeFilters = { q: '', includeInactive: false };

/**
 * 대분류 초기 선택지의 자리표시 상수.
 *
 * 값이 확정되기 전이라 **비워 둔다 — 값을 지어내지 않는다.** 지어내면 화면이 사실이 아닌
 * 선택지를 내고 그것이 그대로 굳는다. 확정되면 이 배열만 채우면 되고,
 * 그동안 화면은 서버 목록을 그리고 상위 선택칸 아래에 임시 안내를 낸다.
 */
export const PROVISIONAL_CATEGORY_CODES: readonly string[] = [];

const t = messages.defectCauseCode;

const optionLabel = (item: HierarchyCode): string =>
  item.isActive
    ? t.values.groupHeader(item.code, item.name)
    : `${t.values.groupHeader(item.code, item.name)}${t.values.inactiveSuffix}`;

/**
 * 상위 선택칸에 실제로 낼 선택지를 만든다.
 *
 * 기본은 사용 중인 대분류만 보인다. 다만 지금 선택된 값이 미사용이면 그것도 남기고 라벨에 표식을
 * 붙인다 — 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
 * 목록에 아예 없는 값(전체 목록이 잘린 경우)도 번호 그대로 남긴다.
 */
export const selectableCategoryOptions = (
  candidates: readonly HierarchyCode[],
  selected: string,
): CodeOption[] => {
  const options = candidates
    .filter((item) => item.isActive || String(item.id) === selected)
    .map((item) => ({ value: String(item.id), label: optionLabel(item) }));

  if (selected === '' || options.some((option) => option.value === selected)) {
    return options;
  }

  return [...options, { value: selected, label: selected }];
};

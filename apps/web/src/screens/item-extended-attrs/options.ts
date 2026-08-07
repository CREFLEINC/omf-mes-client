import { messages } from '@omf-mes/i18n';

import type { LookupEntry, SelectOption } from './types';

/**
 * 선택지를 다루는 순수 함수. 조회로 채우는 선택 목록(단위 등)이 모두 이것을 쓴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.itemExtendedAttrs;

/**
 * 서버가 준 현재 값이 선택지 목록에 없으면 값 그대로 덧붙인다.
 * 덧붙이지 않으면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
 */
export const ensureOption = (options: SelectOption[], value: string): SelectOption[] =>
  value === '' || options.some((option) => option.value === value)
    ? options
    : [...options, { value, label: value }];

/**
 * 조회 결과로 채우는 선택 목록에서 실제로 고를 수 있는 선택지를 만든다.
 *
 * 기본은 사용 중인 것만 보인다. 다만 **지금 고른 값이 미사용이면 그것도 남기고 표식을 붙인다** —
 * 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 알고, 고치지 않은 줄을 고치려 든다.
 */
export const selectableOptions = (entries: LookupEntry[], selected: string): SelectOption[] =>
  ensureOption(
    entries
      .filter((entry) => entry.isActive || entry.value === selected)
      .map((entry) => ({
        value: entry.value,
        label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
      })),
    selected,
  );

/**
 * 번호를 사람이 읽는 이름으로 옮긴다. 읽기 전용 표기에 쓴다.
 *
 * **목록에 없으면 번호를 화면에 내지 않는다** — 내부 식별자라 사용자가 쓸 수 없는 값이고,
 * 그것을 보이면 자료로 읽힌다. 값 자체가 없으면 미지정 표기다.
 *
 * **아직 목록을 받지 못한 상태를 「알 수 없음」과 가른다**(`isLoading`). 둘을 같은 문구로 내면
 * 잠깐 보이는 「알 수 없음」을 사용자가 잘못 담긴 자료로 읽고 원본 시스템을 확인하러 간다.
 * 값 자체가 없으면 목록을 기다릴 이유가 없으므로 그때는 미지정 표기가 먼저다.
 */
export const lookupLabel = (
  entries: LookupEntry[],
  id: number | null | undefined,
  isLoading = false,
): string => {
  if (id === null || id === undefined) return t.values.empty;
  if (isLoading) return t.values.loading;

  return entries.find((entry) => entry.value === String(id))?.label ?? t.values.unknown;
};

import { messages } from '@omf-mes/i18n';

import type { LookupEntry } from './types';

/**
 * 선택지를 다루는 순수 함수. 조회로 채우는 선택 목록(단위 등)이 모두 이것을 쓴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.itemExtendedAttrs;

/**
 * 번호를 사람이 읽는 이름으로 옮긴다. 읽기 전용 표기에 쓴다.
 *
 * **목록에 없으면 번호를 화면에 내지 않는다** — 내부 식별자라 사용자가 쓸 수 없는 값이고,
 * 그것을 보이면 자료로 읽힌다. 값 자체가 없으면 미지정 표기다.
 */
export const lookupLabel = (entries: LookupEntry[], id: number | null | undefined): string => {
  if (id === null || id === undefined) return t.values.empty;

  return entries.find((entry) => entry.value === String(id))?.label ?? t.values.unknown;
};

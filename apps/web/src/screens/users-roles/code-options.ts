import { messages } from '@omf-mes/i18n';

import {
  lookupDisplayLabel,
  type LookupSource,
  selectableLookupOptions,
} from '../../patterns/lookup-display';
import type { LookupEntry, SelectOption } from './types';

/**
 * 선택지를 다루는 순수 함수.
 *
 * 두 갈래가 있다 — **조회로 채우는 목록**(부서 등)과 **값 목록이 확정되지 않은 코드**(상태).
 * 앞쪽은 서버가 준 값을 옮기고, 뒤쪽은 **자리표시 하나 + 받은 값**만 둔다. 값을 지어내지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

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
 * 기본은 사용 중인 것만 보인다. 다만 지금 고른 값이 미사용이면 그것도 남기고 표식을 붙인다 —
 * 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
 */
export const selectableOptions = (
  source: LookupSource<LookupEntry>,
  selected: string,
): SelectOption[] => selectableLookupOptions(source, selected);

/**
 * 번호를 사람이 읽는 이름으로 옮긴다. 조건 칩·읽기 전용 표기에 쓴다.
 *
 * **목록에 없으면 번호를 화면에 내지 않는다** — 내부 식별자라 사용자가 쓸 수 없는 값이고,
 * 그것을 보이면 자료로 읽힌다. 값 자체가 없으면 미지정 표기다.
 */
export const lookupLabel = (
  source: LookupSource<LookupEntry>,
  id: number | null | undefined,
): string => lookupDisplayLabel(source, id);

/**
 * 값 목록이 확정되지 않은 코드의 선택지 — **자리표시 하나 + 서버가 준 값**뿐이다.
 *
 * 어떤 코드값도 여기에 적지 않는다(계획 결정 16). 목록이 확정되면 조회로 채우는 쪽
 * (`selectableOptions`)으로 옮기면 되고, 그때까지 화면은 값을 지어내지 않는다.
 *
 * 자리표시가 빈 값(`''`)인 것이 중요하다 — **비어 있음도 고른 값**이라
 * `SelectField`가 자리표시 문구를 그대로 보여 준다.
 */
export const pendingCodeOptions = (current: string): SelectOption[] =>
  ensureOption([{ value: '', label: messages.pendingCode.placeholder }], current);

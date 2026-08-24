import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { GaugeFilters } from './types';

export type CodeValue = components['schemas']['CodeValue'];

export interface CodeOption {
  value: string;
  label: string;
}

/**
 * 이 화면이 쓰는 코드 그룹. **이름으로 부르는 자리가 여기 하나다.**
 * ⛔ `codeGroupId` 정수를 코드에 박지 않는다 — 환경마다 다르다(설계 `omf-mes#179`).
 */
export const CODE_GROUPS = {
  cycleType: 'CYCLE_TYPE',
  equipmentStatus: 'EQUIPMENT_STATUS',
  /**
   * 계측기 세부유형. ⭐ **설계가 값을 확정해 알려 준 그룹이다**(`omf-mes#195` 회신 · 시드
   * `omf-mes#182`) — 화면이 값을 지어내지 않고 서버가 준 목록을 그대로 쓴다. 값이 늘어도
   * 화면은 손대지 않는다.
   */
  equipmentType: 'EQUIPMENT_TYPE',
} as const;

/**
 * 자산이 살아 있음을 뜻하는 코드값. **선택지가 아니라 판정에 쓰는 값**이라 이름을 갖는다.
 * ⭐ 설계가 값을 확정해 알려 준 것이다(`omf-mes#185`) — 화면이 지어낸 값이 아니다.
 * 형제 화면(W-05-12)도 같은 자리에 둔다.
 */
export const IN_SERVICE_STATUS_CODE = 'IN_SERVICE';

/**
 * 자산이 끝났음을 뜻하는 코드값. **선택지가 아니라 판정에 쓰는 값**이라 이름을 갖는다.
 *
 * ⭐ 설계가 값을 확정해 알려 준 것이다(`omf-mes#185`) — 화면이 지어낸 값이 아니다.
 * ⛔ 값을 늘리지 않는다 — 고장·보전중·비가동은 트랜잭션이 만드는 조건이지 자산 상태가
 * 아니다(공유계약 A-14). 늘리면 여러 화면이 한 컬럼을 두고 경합한다.
 */
export const DISPOSED_STATUS_CODE = 'DISPOSED';

/** 화면을 처음 열었을 때의 조회 조건. */
export const defaultGaugeFilters: GaugeFilters = {
  q: '',
  plantId: '',
  equipmentTypeCode: '',
  overdueOnly: false,
  includeInactive: false,
  includeDisposed: false,
};

/**
 * 공통코드 값 목록을 **이름 풀이표**로 옮긴다.
 *
 * ⛔ **거르지도 정렬하지도 않는다** — 이것은 «고를 목록»이 아니라 **읽는 값의 이름표**다.
 * `isActive` 로 거르면 사용 중지된 코드값을 가진 자료의 이름이 사라진다.
 * ⛔ **라벨을 지어내지 않는다** — `codeName` 이 비면 코드를 그대로 쓴다.
 */
export const toCodeLabels = (values: readonly CodeValue[]): CodeOption[] =>
  values.map((value) => ({
    value: value.code,
    label: value.codeName.trim() === '' ? value.code : value.codeName,
  }));

/**
 * 서버가 준 현재 값이 선택지에 없으면 **코드 그대로 덧붙인다.**
 *
 * ⛔ 덧붙이지 않으면 선택칸이 자리표시만 보여 **값이 없는 것처럼 보인다.** 코드값 시드가
 * 아직 없거나(설계 `omf-mes#182`) 쓰지 않기로 한 값이 자료에 남아 있을 때 실제로 그렇게 된다 —
 * 사용자는 지워진 줄 알고 다시 고르고, 원래 값은 그렇게 조용히 바뀐다.
 */
export const ensureOption = (options: CodeOption[], value: string): CodeOption[] =>
  value === '' || options.some((option) => option.value === value)
    ? options
    : [...options, { value, label: value }];

/** 코드 하나의 이름. 못 찾으면 코드를 그대로 보인다 — 「알 수 없음」을 쓰지 않는다(G-9). */
export const codeLabel = (code: string, options: readonly CodeOption[]): string =>
  options.find((option) => option.value === code)?.label ?? code;

/** 선택 목록에서 값 하나의 이름을 푼다. 좁힌 선택지가 아니라 전체에서 찾는다. */
export const lookupLabel = (
  entries: readonly { value: string; label: string }[],
  value: string,
): string => entries.find((entry) => entry.value === value)?.label ?? value;

/**
 * 선택칸에 낼 선택지. 사용 중인 것과 지금 고른 값만 남기고, 미사용에는 표식을 붙인다.
 * 목록에 아예 없는 값도 코드 그대로 남긴다 — 빼면 칸이 비어 보여 값이 사라진 줄 안다.
 */
export const selectableOptions = (
  entries: readonly { value: string; label: string; isActive: boolean }[],
  selected: string,
): CodeOption[] => {
  const kept = entries
    .filter((entry) => entry.isActive || entry.value === selected)
    .map((entry) => ({
      value: entry.value,
      label: entry.isActive
        ? entry.label
        : `${entry.label}${messages.gaugeMaster.values.inactiveSuffix}`,
    }));

  return selected === '' || kept.some((option) => option.value === selected)
    ? kept
    : [...kept, { value: selected, label: selected }];
};

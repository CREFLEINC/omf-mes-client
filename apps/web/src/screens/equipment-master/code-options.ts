import { messages } from '@omf-mes/i18n';

import type { GroupFilters, LookupEntry } from './types';

/**
 * 선택지 상수와 화면 기본값을 한 파일에 격리한다.
 * 공통코드 값 목록이 확정되면 이 파일만 고치면 된다.
 *
 * ⛔ **공용 패키지로 올리지 않는다.** 화면마다 확정된 값 목록이 섞여 있어 파일 자체는 화면 소유다
 * — 자리표시 관용구만 공용(`messages.pendingCode`)이고 목록은 각자다.
 */

export interface CodeOption {
  value: string;
  label: string;
}

/** 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다. */
export const defaultGroupFilters: GroupFilters = {
  q: '',
  plantId: '',
  includeInactive: false,
};

/**
 * 값 목록이 확정되지 않은 코드의 자리표시자.
 * 값을 지어내지 않는다 — 화면은 이 선택지와 함께 `messages.pendingCode.note` 안내를 보인다.
 */
export const PENDING_CODE_VALUE = 'PENDING';

const pendingOptions = (): CodeOption[] => [
  { value: PENDING_CODE_VALUE, label: messages.pendingCode.placeholder },
];

/**
 * 그룹유형 — 공통코드 미확정(추적 omf-mes#145).
 *
 * ⚠ 물리 모델에는 라인·작업구역 두 값이 있으나 **고객사가 자기 분류 체계를 정해야 하는 값**이라
 * 그 둘을 선택지로 내지 않는다. 값을 지어내는 것과 남의 스키마를 화면 문구로 옮기는 것 둘 다 피한다.
 */
export const GROUP_TYPE_OPTIONS: CodeOption[] = pendingOptions();

/** 설비유형 — 공통코드 미확정(추적 omf-mes#145). 계측기 화면(W-05-11)이 이 값으로 거른다. */
export const EQUIPMENT_TYPE_OPTIONS: CodeOption[] = pendingOptions();

/**
 * 서버가 준 현재 값이 선택지 목록에 없으면 코드 그대로 덧붙인다.
 * 덧붙이지 않으면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
 */
export const ensureOption = (options: CodeOption[], value: string): CodeOption[] =>
  value === '' || options.some((option) => option.value === value)
    ? options
    : [...options, { value, label: value }];

/**
 * 선택 목록에서 실제로 고를 수 있는 선택지를 만든다.
 *
 * 기본은 사용 중인 것만 보인다. 다만 지금 선택된 값이 미사용이면 그것도 남기고 라벨에 표식을 붙인다 —
 * 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. 목록에 아예 없는 값도 코드 그대로 남긴다.
 */
export const selectableOptions = (entries: LookupEntry[], selected: string): CodeOption[] =>
  ensureOption(
    entries
      .filter((entry) => entry.isActive || entry.value === selected)
      .map((entry) => ({
        value: entry.value,
        label: entry.isActive
          ? entry.label
          : `${entry.label}${messages.equipmentMaster.values.inactiveSuffix}`,
      })),
    selected,
  );

/** 선택 목록에서 값 하나의 라벨을 푼다. 못 찾으면 코드를 그대로 보인다 — 「알 수 없음」을 쓰지 않는다. */
export const lookupLabel = (entries: LookupEntry[], value: string): string =>
  entries.find((entry) => entry.value === value)?.label ?? value;

import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { ToolFilters, ToolSort } from './types';

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
  /**
   * 자산 수명주기(운용·폐기).
   *
   * ⭐ **툴 전용 그룹을 새로 짓지 않는다** — 가르는 기준은 「값이 같은 **종류**인가」다
   * (공유계약 G-32). 설비든 툴이든 자산 수명주기는 같은 종류이고 값도 같은 두 개다
   * (`omf-mes#185` 확정). 유형마다 그룹을 나누면 같은 뜻의 어휘가 여러 벌 생긴다.
   * ⚠ 값 목록 시드가 아직 없어 지금은 코드가 그대로 보일 수 있다(설계 `omf-mes#182`).
   */
  assetStatus: 'EQUIPMENT_STATUS',
} as const;

/**
 * 예방보전을 무엇으로 판정하는가. **계약이 네 값과 뜻을 함께 못박았다** — 화면이 지어낸
 * 값이 아니라 계약을 옮긴 것이다.
 *
 * ⭐ **닫힌 집합이라 통째로 든다** — 지금 목록이 쓰는 것은 「하지 않음」 하나뿐이지만,
 * 넷 중 셋만 적어 두면 나머지 하나가 어디서 왔는지 알 수 없는 문자열이 된다.
 */
export const PM_TRIGGER = {
  shot: 'SHOT',
  date: 'DATE',
  both: 'BOTH',
  none: 'NONE',
} as const;

/** 먼저 도달한 축. 도래하지 않았으면 계약이 `null` 을 준다. */
export const PM_AXIS = {
  shot: 'SHOT',
  date: 'DATE',
} as const;

/** 화면을 처음 열었을 때의 조회 조건. */
export const defaultToolFilters: ToolFilters = {
  q: '',
  plantId: '',
  toolTypeCode: '',
  guaranteedShotCountMissing: false,
  pmDueOnly: false,
  /*
   * ⭐ **마스터 화면의 기본은 코드 순이다.** 초과율 높은 순은 «적체를 훑는» 화면의 기본이고
   * (계약 주석), 여기는 「그 툴을 찾아 고치는」 자리라 찾는 차례가 먼저다. 적체로 보고 싶으면
   * 정렬을 바꾸면 된다 — 조건은 사용자가 정한다.
   */
  sort: 'CODE',
  includeInactive: false,
};

/**
 * 값 목록이 확정되지 않은 코드의 자리표시자.
 * ⚠ 도구 유형이 여기 해당한다(추적 `omf-mes#145`).
 */
export const PENDING_CODE_VALUE = 'PENDING';

/** 도구 유형 — 값 목록 미정. 고를 것이 자리표시뿐이라는 사실을 안내로 밝힌다. */
export const TOOL_TYPE_OPTIONS: CodeOption[] = [
  { value: PENDING_CODE_VALUE, label: messages.pendingCode.placeholder },
];

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
 * ⛔ 덧붙이지 않으면 선택칸이 비어 보여 사용자가 값이 사라진 줄 알고 다시 고른다 —
 * 원래 값은 그렇게 조용히 바뀐다.
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
): CodeOption[] =>
  ensureOption(
    entries
      .filter((entry) => entry.isActive || entry.value === selected)
      .map((entry) => ({
        value: entry.value,
        label: entry.isActive
          ? entry.label
          : `${entry.label}${messages.toolMaster.values.inactiveSuffix}`,
      })),
    selected,
  );

/**
 * 정렬 선택지. **계약이 정한 세 값이며 뜻도 계약이 적었다** — 화면이 늘리지 않는다.
 *
 * ⭐ 초과율 높은 순이 먼저 선다 — 「경과일보다 초과율이 위험 크기」라는 것이 계약의 말이다.
 * 차례는 위험이 큰 쪽부터이고, 찾기 위한 코드 순이 마지막이다.
 */
export const SORT_OPTIONS: readonly { value: ToolSort; label: string }[] = [
  { value: 'SHOT_USAGE_DESC', label: messages.toolMaster.filters.sort.shotUsageDesc },
  { value: 'NEXT_PM_ASC', label: messages.toolMaster.filters.sort.nextPmAsc },
  { value: 'CODE', label: messages.toolMaster.filters.sort.code },
];

/**
 * 선택칸이 돌려준 문자열을 정렬 값으로 좁힌다.
 *
 * ⛔ **모르는 값을 그대로 질의에 싣지 않는다** — 계약이 받지 않는 값이라 서버가 거절하고,
 * 그때 사용자는 목록이 왜 비었는지 알 수 없다. 아는 값이 아니면 기본 정렬로 돌아간다.
 */
export const toToolSort = (value: string): ToolSort =>
  SORT_OPTIONS.find((option) => option.value === value)?.value ?? defaultToolFilters.sort;

/**
 * 예방보전 판정 기준 선택지. **계약이 정한 네 값이며 뜻도 계약이 적었다.**
 * 차례는 「하지 않음」이 먼저다 — 기본값이고, 나머지 셋은 축이 늘어나는 차례로 선다.
 */
export const PM_TRIGGER_OPTIONS: readonly CodeOption[] = [
  { value: PM_TRIGGER.none, label: messages.toolMaster.pmTrigger.none },
  { value: PM_TRIGGER.shot, label: messages.toolMaster.pmTrigger.shot },
  { value: PM_TRIGGER.date, label: messages.toolMaster.pmTrigger.date },
  { value: PM_TRIGGER.both, label: messages.toolMaster.pmTrigger.both },
];

/**
 * 날짜 주기 단위 선택지.
 *
 * ⛔ **공통코드 기간 단위 그룹(`CYCLE_TYPE`)을 쓰지 않는다** — 형제 화면(W-05-11)이 검교정
 * 주기에 그 그룹을 쓰는 것과 갈리는 자리다. 계약이 여기서는 「일(DAY) 또는 월(MONTH)」로
 * **좁혀 못박았고**, 그룹을 그대로 내면 주·년 같은 값을 고를 수 있게 되어 저장에서 거절당한다.
 * 고를 수 있는데 저장이 안 되는 선택지는 두지 않는다.
 */
export const PM_CYCLE_UNIT_OPTIONS: readonly CodeOption[] = [
  { value: 'DAY', label: messages.toolMaster.pmCycleUnit.day },
  { value: 'MONTH', label: messages.toolMaster.pmCycleUnit.month },
];

/**
 * 날짜 축을 쓰는가. **주기 두 칸이 열리는 조건이자 짝 제약이 걸리는 조건**이라 한 자리에 둔다 —
 * 흩어 두면 「열려 있는데 재지 않는」 칸이나 그 반대가 생긴다.
 */
export const usesDateAxis = (pmTriggerTypeCode: string): boolean =>
  pmTriggerTypeCode === PM_TRIGGER.date || pmTriggerTypeCode === PM_TRIGGER.both;

/** 타발수 축을 쓰는가. 적정타수가 비면 이 축이 서지 않는다는 안내의 조건이다. */
export const usesShotAxis = (pmTriggerTypeCode: string): boolean =>
  pmTriggerTypeCode === PM_TRIGGER.shot || pmTriggerTypeCode === PM_TRIGGER.both;

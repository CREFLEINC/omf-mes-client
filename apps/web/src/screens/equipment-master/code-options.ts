import { messages } from '@omf-mes/i18n';

import type { components } from '@omf-mes/api-client';

import type { EquipmentFilters, GroupFilters, LookupEntry } from './types';

export type CodeValue = components['schemas']['CodeValue'];

/**
 * 이 화면이 쓰는 코드 그룹. **이름으로 부르는 자리가 여기 하나다** — 흩어 두면 그룹 이름이
 * 바뀔 때 어디를 고쳐야 하는지 알 수 없다.
 *
 * ⛔ `codeGroupId` 정수를 코드에 박지 않는다 — **환경마다 다르다**(설계 `omf-mes#179`).
 */
export const CODE_GROUPS = {
  equipmentStatus: 'EQUIPMENT_STATUS',
  /**
   * 기간 단위. **검교정 주기와 점검 부여 주기가 이 한 그룹을 쓴다**(설계 `omf-mes#188`).
   *
   * ⭐ 가르는 기준은 「값이 같은 **종류**인가」다 — 둘 다 기간 단위라 합친다.
   * ⛔ 검사 «유형»은 종류가 달라 그룹을 가른다(품질 IQC·PQC·OQC ↔ 설비 DAILY·MONTHLY·
   * MAINTENANCE). 「이름이 다르면 가른다」가 아니다 — 그러면 어휘가 두 벌 생긴다(공유계약 G-32).
   */
  cycleType: 'CYCLE_TYPE',
  /**
   * 설비 점검 유형 — 일상(`DAILY`)·정기(`MONTHLY`)·보전(`MAINTENANCE`)(설계 `omf-mes#186`).
   *
   * ⛔ **품질 검사의 유형과 «같은 이름 다른 값»이다**(공유계약 G-32 · B-28 의 값 집합 판).
   * 합치면 설비 점검 선택칸에 「수입검사」가 뜬다.
   */
  equipmentInspectionType: 'EQUIPMENT_INSPECTION_TYPE',
  /**
   * 점검 항목의 **판정 방식** — 육안(`VISUAL`) 또는 측정값(`MEASUREMENT`)(설계 `omf-mes#186`).
   *
   * ⛔ **이 값을 모르면 짝 제약을 걸 수 없다** — 계약이 「측정값이면 단위·상하한이 함께
   * 필요하다」를 정해 두었으므로, 어느 값이 「측정값」인지 모르면 등록이 반드시 실패한다.
   */
  inspectionJudgmentMethod: 'EQUIPMENT_INSPECTION_JUDGMENT_METHOD',
} as const;

/**
 * 자산이 끝났음을 뜻하는 코드값. **선택지가 아니라 판정에 쓰는 값**이라 이름을 갖는다.
 *
 * ⭐ 설계가 값을 확정해 알려 준 것이다(`omf-mes#185`) — 화면이 지어낸 값이 아니다.
 * ⛔ 값을 늘리지 않는다 — 고장·보전중·비가동은 트랜잭션이 만드는 조건이지 자산 상태가 아니다
 * (공유계약 A-14 · 화면 스펙 §5-2). 늘리면 네 화면이 한 컬럼을 두고 경합한다.
 */
export const DISPOSED_STATUS_CODE = 'DISPOSED';

/** 자산이 살아 있음을 뜻하는 코드값. 목록의 기본 조건이 이것이다. */
export const IN_SERVICE_STATUS_CODE = 'IN_SERVICE';

/**
 * 공통코드 값 목록을 **이름 풀이표**로 옮긴다.
 *
 * ⭐ **선택칸용 변환과 다르다 — 거르지도 정렬하지도 않는다.** 전례(`iqc-inspection`)의
 * 같은 이름 함수는 `isActive` 로 거르고 `displayOrder` 로 정렬하는데, 그것은 **고를 목록**을
 * 만들기 때문이다. 이 화면의 자산 상태는 고르는 값이 아니라 **서버가 준 값을 읽는** 자리다.
 *
 * ⛔ **거르면 미사용 코드값의 이름이 사라진다.** 코드값이 사용 중지돼도 그 값을 가진 설비는
 * 남아 있고, 그때 이름을 못 풀면 화면에 코드가 그대로 선다 — 「참조 조회는 좁히지 않는다」와
 * 같은 규율이다(좁힘은 «고를 목록» 한 자리에만 건다).
 *
 * ⛔ **라벨을 지어내지 않는다** — `codeName` 이 사람이 읽을 이름이고, 비면 코드를 그대로 쓴다.
 */
export const toCodeLabels = (values: readonly CodeValue[]): CodeOption[] =>
  values.map((value) => ({
    value: value.code,
    label: value.codeName.trim() === '' ? value.code : value.codeName,
  }));

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

/** 설비 목록을 처음 열었을 때의 조회 조건. */
export const defaultEquipmentFilters: EquipmentFilters = {
  q: '',
  equipmentTypeCode: '',
  calibrationRequired: false,
  includeInactive: false,
  includeDisposed: false,
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
 * 설비유형 코드의 라벨. 그룹유형과 같은 규율이다 — 못 찾으면 코드를 그대로 보인다.
 */
export const equipmentTypeLabel = (code: string): string =>
  EQUIPMENT_TYPE_OPTIONS.find((option) => option.value === code)?.label ?? code;

/**
 * 운용 상태 코드의 라벨.
 *
 * ⭐ **값 목록을 화면에 고정하지 않는다** — 실행 시점에 조회해 채운다(공유계약 G-2·G-6).
 * ⛔ **못 찾으면 코드를 그대로 보인다** — 「알 수 없음」으로 그리면 모르는 값과 없는 값이
 * 같은 모양이 되고(G-9), 라벨을 지어내면 그 뜻도 화면이 지어낸 것이 된다.
 * 시드가 아직 없어 목록이 빌 수 있고(설계 `omf-mes#182`), 그때는 코드가 그대로 보이는 것이 옳다.
 */
export const statusLabel = (code: string, options: readonly CodeOption[]): string =>
  options.find((option) => option.value === code)?.label ?? code;

/**
 * 주기 단위 코드의 라벨. 상태와 같은 규율이다 — 못 찾으면 코드를 그대로 보인다.
 */
export const cycleTypeLabel = (code: string, options: readonly CodeOption[]): string =>
  options.find((option) => option.value === code)?.label ?? code;

/**
 * 그룹유형 코드의 라벨. **값 목록이 확정되지 않아 지금은 늘 코드가 그대로 나온다.**
 * 「알 수 없음」으로 그리지 않는다 — 모르는 값과 없는 값이 같은 모양이 되면 안 된다(G-9).
 */
export const groupTypeLabel = (code: string): string =>
  GROUP_TYPE_OPTIONS.find((option) => option.value === code)?.label ?? code;

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

/**
 * 그룹을 끄면 무엇이 달라지는지 한 줄.
 *
 * **0대와 N대는 사용자가 할 판단이 다르므로 문장을 나눈다** — 하나로 뭉개면 상세 응답이
 * 건수를 내려 주는 뜻이 없다. 건수는 화면이 세지 않고 서버가 준 값을 그대로 쓴다.
 */
export const groupDeactivateImpact = (memberEquipmentCount: number): string =>
  memberEquipmentCount === 0
    ? messages.equipmentMaster.deactivate.membersNone
    : messages.equipmentMaster.deactivate.members(memberEquipmentCount);

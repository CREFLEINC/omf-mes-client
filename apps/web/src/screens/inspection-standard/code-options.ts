import { messages } from '@omf-mes/i18n';

import { type LookupSource, selectableLookupOptions } from '../../patterns/lookup-display';
import type { LookupEntry, PlanFilters, SelectOption } from './types';

/**
 * 선택지 상수와 화면 기본값을 한 파일에 격리한다.
 * 공통코드 값 목록이 확정되면 이 파일만 고치면 화면 전체가 따라온다.
 */

/** 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다. */
export const DEFAULT_PLAN_FILTERS: PlanFilters = {
  q: '',
  inspectionTypeCode: '',
  includeInactive: false,
};

/**
 * 검사 유형 3값.
 *
 * 계약의 `inspectionTypeCode`는 enum이 아니다(`maxLength: 50` 문자열). 그런데도 값을
 * 지어냈다고 보지 않는 이유는 근거 셋이 일치하기 때문이다 —
 * ① 화면 제목이 「검사기준 등록(IQC/PQC/OQC)」이다 ② 계약 설명이 같은 세 값을 적었다
 * ③ 계약 예시가 `IQC`다. 자리표시로 두면 이 화면의 핵심 분류를 아무도 고를 수 없다.
 *
 * **PQC의 세부 구분(공정·초중종·자주)은 만들지 않는다** — 계약에 담을 자리가 없다.
 */
export const INSPECTION_TYPE_OPTIONS: SelectOption[] = [
  { value: 'IQC', label: 'IQC (수입검사)' },
  { value: 'PQC', label: 'PQC (공정검사)' },
  { value: 'OQC', label: 'OQC (출하검사)' },
];

/**
 * 값 목록이 확정되지 않은 코드의 자리표시자.
 * 값을 지어내지 않는다 — 화면은 이 선택지와 함께 `messages.pendingCode.note` 안내를 보인다.
 */
export const PENDING_CODE_VALUE = 'PENDING';

const pendingOptions = (): SelectOption[] => [
  { value: PENDING_CODE_VALUE, label: messages.pendingCode.placeholder },
];

/** 샘플링 방법 — 공통코드 미확정. */
export const SAMPLING_METHOD_OPTIONS: SelectOption[] = pendingOptions();

/** 검사 주기 — 공통코드 미확정. */
export const INSPECTION_FREQUENCY_OPTIONS: SelectOption[] = pendingOptions();

/**
 * 주기 단위 — 공통코드 미확정.
 *
 * `/mdm/uoms`의 `uomCode`와 형태가 같으나 **계약이 그 둘을 잇지 않았다.**
 * 계약이 잇지 않은 것을 화면이 이으면 지어내는 것이므로 자리표시로 둔다.
 */
export const FREQUENCY_INTERVAL_UOM_OPTIONS: SelectOption[] = pendingOptions();

/**
 * 자료형 — 계약 설명이 「수치/텍스트/불리언 **[추정]**」이다.
 * [추정]이므로 3값을 쓰지 않는다. 이 값으로 화면 구조를 가르지도 않는다.
 */
export const DATA_TYPE_OPTIONS: SelectOption[] = pendingOptions();

/** 검사 방법 — 계약에 설명이 없다. */
export const INSPECTION_METHOD_OPTIONS: SelectOption[] = pendingOptions();

/** 검사 유형 코드를 사람이 읽는 이름으로. 목록에 없는 값은 코드를 그대로 낸다. */
export const inspectionTypeLabel = (code: string): string =>
  INSPECTION_TYPE_OPTIONS.find((option) => option.value === code)?.label ?? code;

/**
 * 서버가 준 현재 값이 선택지 목록에 없으면 코드 그대로 덧붙인다.
 * 덧붙이지 않으면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
 */
export const ensureOption = (options: SelectOption[], value: string): SelectOption[] =>
  value === '' || options.some((option) => option.value === value)
    ? options
    : [...options, { value, label: value }];

/**
 * 조회 결과로 채우는 선택 목록에서 실제로 고를 수 있는 선택지를 만든다.
 *
 * 기본은 사용 중인 것만 보인다. 다만 지금 선택된 값이 미사용이면 그것도 남기고 표식을 붙인다 —
 * 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. 목록에 없는 숫자 FK는 값만 보존하고
 * 라벨에는 미확인·로딩·실패 상태를 낸다.
 */
export const selectableOptions = (
  source: LookupSource<LookupEntry>,
  selected: string,
): SelectOption[] => selectableLookupOptions(source, selected);

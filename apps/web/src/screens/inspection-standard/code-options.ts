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
  { value: 'IQC', label: messages.inspectionStandard.values.inspectionTypes.iqc },
  { value: 'PQC', label: messages.inspectionStandard.values.inspectionTypes.pqc },
  { value: 'OQC', label: messages.inspectionStandard.values.inspectionTypes.oqc },
];

/** 전수검사 — 샘플 비율을 받지 않는다(검사 수량 = 의뢰 수량). */
export const FULL_INSPECTION = 'FULL_INSPECTION';

/**
 * 샘플링 방법 — 시드 공통코드 `INSPECTION_SAMPLING_METHOD` 3값(omf-all-around#103).
 * 서버가 `FULL_INSPECTION` 을 값으로 분기하므로(PQC 검사 수량) 화면도 같은 값을 쓴다.
 */
export const SAMPLING_METHOD_OPTIONS: SelectOption[] = [
  {
    value: FULL_INSPECTION,
    label: messages.inspectionStandard.values.samplingMethods.fullInspection,
  },
  {
    value: 'SAMPLE_BY_UNIT',
    label: messages.inspectionStandard.values.samplingMethods.sampleByUnit,
  },
  { value: 'SAMPLE_BY_LOT', label: messages.inspectionStandard.values.samplingMethods.sampleByLot },
];

/**
 * 아래 넷은 값 목록을 화면에 적지 않고 `GET /mdm/code-values?codeGroupCode=` 로 받는다
 * (공유계약 G-32 · omf-all-around#194). 서버가 같은 그룹으로 저장 값을 검사한다.
 */
/** 검사 주기 — 고객이 늘린다(G-31). */
export const INSPECTION_FREQUENCY_CODE_GROUP = 'INSPECTION_FREQUENCY';

/** 주기 단위 — 시간(HOUR) · 수량(QUANTITY). 품목 기준단위(`/mdm/uoms`)와 다른 축이다. */
export const FREQUENCY_INTERVAL_UOM_CODE_GROUP = 'INSPECTION_FREQUENCY_INTERVAL_UOM';

/** 자료형 — NUMERIC · TEXT · BOOLEAN. */
export const DATA_TYPE_CODE_GROUP = 'INSPECTION_ITEM_SPEC_DATA_TYPE';

/** 검사 방법. */
export const INSPECTION_METHOD_CODE_GROUP = 'INSPECTION_ITEM_SPEC_METHOD';

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

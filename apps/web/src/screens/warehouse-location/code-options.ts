import { messages } from '@omf-mes/i18n';

import { type LookupSource, selectableLookupOptions } from '../../patterns/lookup-display';
import type { LookupEntry, WarehouseFilters } from './types';

/**
 * 선택지 상수와 화면 기본값을 한 파일에 격리한다.
 * 공통코드 값 목록이 확정되면 이 파일만 고치면 된다.
 */

export interface CodeOption {
  value: string;
  label: string;
}

/** 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다. */
export const defaultWarehouseFilters: WarehouseFilters = {
  q: '',
  warehouseTypeCode: '',
  includeInactive: false,
};

/** 확정값 — 창고유형 5종. */
export const WAREHOUSE_TYPE_OPTIONS: CodeOption[] = [
  { value: 'MATERIAL', label: '자재창고' },
  { value: 'PRODUCT', label: '제품창고' },
  { value: 'SEMI_FINISHED', label: '반제품창고' },
  { value: 'MERCHANDISE', label: '상품창고' },
  { value: 'PRODUCTION', label: '생산창고' },
];

/**
 * 값 목록이 확정되지 않은 코드의 자리표시자.
 * 값을 지어내지 않는다 — 화면은 이 선택지와 함께 `messages.pendingCode.note` 안내를 보인다.
 */
export const PENDING_CODE_VALUE = 'PENDING';

const pendingOptions = (): CodeOption[] => [
  { value: PENDING_CODE_VALUE, label: messages.pendingCode.placeholder },
];

/** 관리수준 — 공통코드 미확정. */
export const MANAGEMENT_LEVEL_OPTIONS: CodeOption[] = pendingOptions();

/** 위치유형 — 공통코드 미확정. */
export const LOCATION_TYPE_OPTIONS: CodeOption[] = pendingOptions();

/** 품질구역 — 공통코드 미확정. */
export const QUALITY_ZONE_OPTIONS: CodeOption[] = pendingOptions();

/** 보관조건 — 공통코드 미확정. */
export const STORAGE_CONDITION_OPTIONS: CodeOption[] = pendingOptions();

export const warehouseTypeLabel = (code: string): string =>
  WAREHOUSE_TYPE_OPTIONS.find((option) => option.value === code)?.label ?? code;

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
 * 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. 목록에 없는 숫자 FK는 값만 보존하고
 * 라벨에는 미확인·로딩·실패 상태를 낸다.
 */
export const selectableOptions = (
  source: LookupSource<LookupEntry>,
  selected: string,
): CodeOption[] => selectableLookupOptions(source, selected);

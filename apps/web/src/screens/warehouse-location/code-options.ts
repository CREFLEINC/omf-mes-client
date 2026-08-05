import { messages } from '@omf-mes/i18n';

/**
 * 선택지 상수를 한 파일에 격리한다.
 * 공통코드 값 목록이 확정되면 이 파일만 고치면 된다.
 */

export interface CodeOption {
  value: string;
  label: string;
}

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

import { type LookupSource, selectableLookupOptions } from '../../patterns/lookup-display';
import type { LookupEntry, WarehouseFilters } from './types';

/**
 * 공통코드 그룹 이름과 화면 기본값을 한 파일에 격리한다.
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

/** 고정 계약 G-32의 그룹 이름. 채번 id는 환경마다 달라 절대 저장하지 않는다. */
export const CODE_GROUPS = {
  warehouseType: 'WAREHOUSE_TYPE',
  managementLevel: 'MANAGEMENT_LEVEL',
  locationType: 'LOCATION_TYPE',
  qualityZone: 'QUALITY_ZONE',
  storageCondition: 'STORAGE_CONDITION',
  reissueReason: 'REISSUE_REASON',
} as const;

export const codeLabel = (code: string, options: readonly CodeOption[]): string =>
  options.find((option) => option.value === code)?.label ?? code;

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

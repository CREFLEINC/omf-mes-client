import { messages } from '@omf-mes/i18n';

import { inspectionTypeLabel } from './code-options';
import type { PlanFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.inspectionStandard;

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  q: 'q',
  inspectionTypeCode: 'type',
  includeInactive: 'inactive',
  page: 'page',
} as const;

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
const ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

export const readFilters = (params: URLSearchParams): PlanFilters => ({
  q: params.get(URL_KEYS.q) ?? '',
  inspectionTypeCode: params.get(URL_KEYS.inspectionTypeCode) ?? '',
  includeInactive: params.get(URL_KEYS.includeInactive) === ON,
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * **선택(`plan`·`ver`)을 담지 않는다.** 조건·쪽이 바뀌면 보이는 행이 달라지므로
 * 이 함수의 결과로 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다.
 */
export const toSearchParams = (filters: PlanFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();

  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.inspectionTypeCode !== '') {
    next.set(URL_KEYS.inspectionTypeCode, filters.inspectionTypeCode);
  }
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 값이 없는 조건은 키 자체를 넣지 않는다. */
export interface PlanListQuery {
  q?: string;
  inspectionTypeCode?: string;
  includeInactive?: boolean;
  page?: number;
}

/**
 * 서버로 보낼 조회 쿼리.
 *
 * **`includeInactive=false`를 명시적으로 보내지 않는다.** 계약의 기본값이 false이고,
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 * 첫 쪽도 같은 이유로 싣지 않는다.
 */
export const toListQuery = (filters: PlanFilters, page: number): PlanListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.inspectionTypeCode === ''
    ? {}
    : { inspectionTypeCode: filters.inspectionTypeCode }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

export interface FilterChip {
  key: keyof PlanFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 셋이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: PlanFilters): FilterChip[] => {
  const chips: FilterChip[] = [];

  if (filters.q !== '') {
    chips.push({
      key: 'q',
      label: t.filters.chipKeyword(filters.q),
      removeLabel: t.filters.chipRemoveKeyword,
    });
  }

  if (filters.inspectionTypeCode !== '') {
    chips.push({
      key: 'inspectionTypeCode',
      label: t.filters.chipInspectionType(inspectionTypeLabel(filters.inspectionTypeCode)),
      removeLabel: t.filters.chipRemoveInspectionType,
    });
  }

  if (filters.includeInactive) {
    chips.push({
      key: 'includeInactive',
      label: messages.common.includeInactive,
      removeLabel: t.filters.chipRemoveIncludeInactive,
    });
  }

  return chips;
};

export const hasAnyFilter = (filters: PlanFilters): boolean =>
  filters.q !== '' || filters.inspectionTypeCode !== '' || filters.includeInactive;

/**
 * 조건 하나만 푼다. 칩의 제거 버튼이 쓴다.
 * 키마다 「비었다」의 표현이 달라(문자열 vs 불리언) 호출부가 그것을 알지 않도록 여기서 다룬다.
 */
export const clearFilter = (filters: PlanFilters, key: keyof PlanFilters): PlanFilters =>
  key === 'includeInactive' ? { ...filters, includeInactive: false } : { ...filters, [key]: '' };

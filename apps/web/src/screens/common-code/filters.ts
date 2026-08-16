import { messages } from '@omf-mes/i18n';

import type { CodeGroupFilters, PartnerFilters, ScopedFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.commonCode;

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  tab: 'tab',
  q: 'q',
  includeInactive: 'inactive',
  page: 'page',
} as const;

/**
 * 탭마다 다른 선택 축의 주소 키. 조직 탭은 사업부, 작업자 탭은 부서다.
 *
 * **탭이 자기 키만 읽는다** — 다른 탭의 키까지 읽으면 탭 사이로 조건이 샌다.
 */
export const SCOPE_KEYS = {
  businessUnit: 'bu',
  department: 'dept',
} as const;

export type ScopeKey = (typeof SCOPE_KEYS)[keyof typeof SCOPE_KEYS];

/**
 * 고른 거래처의 주소 키. 다른 선택 자리(`grp`·`val`·`dep`·`wkr`)와 **같은 규칙**으로 읽는다
 * (`readSelectedId`).
 */
export const PARTNER_SELECT_KEY = 'ptn';

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
const ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

export const readCodeGroupFilters = (params: URLSearchParams): CodeGroupFilters => ({
  q: params.get(URL_KEYS.q) ?? '',
  includeInactive: params.get(URL_KEYS.includeInactive) === ON,
});

/**
 * 거래처 탭의 조회 조건.
 *
 * **`readCodeGroupFilters`를 돌려쓰지 않는다.** 모양이 같아도 이름이 거짓말을 하게 되고,
 * 한쪽 탭의 조건이 바뀔 때 다른 탭이 함께 끌려간다.
 */
export const readPartnerFilters = (params: URLSearchParams): PartnerFilters => ({
  q: params.get(URL_KEYS.q) ?? '',
  includeInactive: params.get(URL_KEYS.includeInactive) === ON,
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams, key: string = URL_KEYS.page): number => {
  const raw = params.get(key) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 주소가 가리키는 선택 번호. 네 자리(`grp`·`val`·`dep`·`wkr`)가 **같은 규칙**을 쓴다.
 *
 * 식별자는 1부터 매겨지므로 `0`·음수·소수·문자는 어떤 자원도 가리키지 않는다 —
 * 「고르지 않은 것」으로 본다. 자리마다 따로 해석하면 한 자리만 규칙이 어긋나도 드러나지 않는다.
 */
export const readSelectedId = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

/**
 * 조직·작업자 탭의 조회 조건. 선택 축의 주소 키만 탭마다 다르다.
 *
 * **선택 축도 선택 번호와 같은 규칙으로 거른다**(`readSelectedId`와 같은 판정).
 * 이 값은 그대로 `Number()`를 거쳐 계약 쿼리(`businessUnitId`·`departmentId`)로 나가므로,
 * 걸러 내지 않으면 `?bu=abc` 같은 주소가 **`businessUnitId=NaN`을 서버로 보낸다.**
 * 고를 수 없는 값은 「전체」(`''`)로 본다 — 주소는 손으로 고쳐지는 자리다.
 */
export const readScopedFilters = (params: URLSearchParams, scopeKey: ScopeKey): ScopedFilters => {
  const scope = params.get(scopeKey) ?? '';

  return {
    q: params.get(URL_KEYS.q) ?? '',
    scopeId: POSITIVE_INTEGER.test(scope) && Number(scope) >= 1 ? scope : '',
    includeInactive: params.get(URL_KEYS.includeInactive) === ON,
  };
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * **선택(`grp`·`val`·`vpage`·`vinactive`·`new`)을 담지 않는다.** 조건·쪽이 바뀌면 보이는 행이
 * 달라지므로 이 함수의 결과로 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다 —
 * 목록에 없는 자원의 폼이 우 칸에 남으면 그것이 어디서 왔는지 알 수 없다.
 */
export const toSearchParams = (
  tabId: string,
  filters: CodeGroupFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams({ [URL_KEYS.tab]: tabId });

  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 조직·작업자 탭의 조건 전체를 주소로 옮긴다. 규칙은 `toSearchParams`와 같다 —
 * 빈 조건은 키 자체를 두지 않고, 선택(`dep`·`wkr`·`new`)을 담지 않는다.
 */
export const toScopedSearchParams = (
  tabId: string,
  scopeKey: ScopeKey,
  filters: ScopedFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams({ [URL_KEYS.tab]: tabId });

  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.scopeId !== '') next.set(scopeKey, filters.scopeId);
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 값이 없는 조건은 키 자체를 넣지 않는다. */
export interface CodeGroupListQuery {
  q?: string;
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
export const toCodeGroupListQuery = (
  filters: CodeGroupFilters,
  page: number,
): CodeGroupListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

export interface DepartmentListQuery {
  q?: string;
  businessUnitId?: number;
  includeInactive?: boolean;
  page?: number;
}

/** 부서 목록 조회 쿼리. 규칙은 코드그룹과 같다 — 빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다. */
export const toDepartmentListQuery = (
  filters: ScopedFilters,
  page: number,
): DepartmentListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.scopeId === '' ? {} : { businessUnitId: Number(filters.scopeId) }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

export interface WorkerListQuery {
  q?: string;
  departmentId?: number;
  includeInactive?: boolean;
  page?: number;
}

/**
 * 작업자 목록 조회 쿼리.
 *
 * **공장·사업부를 싣지 않는다** — 계약에 `plantId`·`businessUnitId`가 있으나 좌 페인에
 * 필터 컨트롤 넷을 놓으면 표가 짓눌린다. 화면에 없는 조건을 요청에 실으면 되돌릴 수단이 없다.
 */
export const toWorkerListQuery = (filters: ScopedFilters, page: number): WorkerListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.scopeId === '' ? {} : { departmentId: Number(filters.scopeId) }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

/**
 * 거래처 탭의 조건 전체를 주소로 옮긴다. 규칙은 `toSearchParams`와 같다 —
 * 빈 조건은 키 자체를 두지 않고, **선택(`ptn`)을 담지 않는다.**
 */
export const toPartnerSearchParams = (
  tabId: string,
  filters: PartnerFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams({ [URL_KEYS.tab]: tabId });

  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

export interface PartnerListQuery {
  q?: string;
  includeInactive?: boolean;
  page?: number;
}

/**
 * 거래처 목록 조회 쿼리. 빈 값·꺼진 확인칸·첫 쪽을 싣지 않는 규칙은 다른 목록과 같다.
 *
 * **`roleTypeCode`를 싣지 않는다.** 계약에 그 질의가 있으나 이 탭은 역할을 *붙이는* 곳이라
 * 역할이 아직 없는 거래처가 반드시 보여야 한다 — 좁히면 「역할이 없는 거래처에는 역할을
 * 붙일 수 없는」 화면이 된다. 좁힘은 선택지를 고르는 화면(W-01-06)의 몫이다.
 */
export const toPartnerListQuery = (filters: PartnerFilters, page: number): PartnerListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

/** 거래처 탭에 조건이 걸려 있는가. 빈 상태의 안내가 이 판정으로 갈린다. */
export const hasAnyPartnerFilter = (filters: PartnerFilters): boolean =>
  filters.q !== '' || filters.includeInactive;

export interface FilterChip {
  key: keyof CodeGroupFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: CodeGroupFilters): FilterChip[] => {
  const chips: FilterChip[] = [];

  if (filters.q !== '') {
    chips.push({
      key: 'q',
      label: t.filters.chipKeyword(filters.q),
      removeLabel: t.filters.chipRemoveKeyword,
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

export const hasAnyFilter = (filters: CodeGroupFilters): boolean =>
  filters.q !== '' || filters.includeInactive;

/**
 * 조건 하나만 푼다. 칩의 제거 버튼이 쓴다.
 * 키마다 「비었다」의 표현이 달라(문자열 vs 불리언) 호출부가 그것을 알지 않도록 여기서 다룬다.
 */
export const clearFilter = (
  filters: CodeGroupFilters,
  key: keyof CodeGroupFilters,
): CodeGroupFilters =>
  key === 'includeInactive' ? { ...filters, includeInactive: false } : { ...filters, [key]: '' };

export interface ScopedFilterChip {
  key: keyof ScopedFilters;
  label: string;
  removeLabel: string;
}

/**
 * 조건 칩의 문구. 탭마다 선택 축의 이름이 달라(사업부·부서) 바깥에서 받는다 —
 * 문구를 이 파일에 박으면 탭이 늘 때마다 여기를 고치게 된다.
 */
export interface ScopedFilterLabels {
  keyword: (value: string) => string;
  keywordRemove: string;
  scope: (label: string) => string;
  scopeRemove: string;
  includeInactiveRemove: string;
}

/**
 * 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다.
 *
 * 선택 축은 **번호가 아니라 이름**으로 낸다 — 번호를 그대로 보이면 사용자가 무엇을 걸었는지 모른다.
 */
export const toScopedFilterChips = (
  filters: ScopedFilters,
  scopeLabel: (scopeId: string) => string,
  labels: ScopedFilterLabels,
): ScopedFilterChip[] => {
  const chips: ScopedFilterChip[] = [];

  if (filters.q !== '') {
    chips.push({ key: 'q', label: labels.keyword(filters.q), removeLabel: labels.keywordRemove });
  }

  if (filters.scopeId !== '') {
    chips.push({
      key: 'scopeId',
      label: labels.scope(scopeLabel(filters.scopeId)),
      removeLabel: labels.scopeRemove,
    });
  }

  if (filters.includeInactive) {
    chips.push({
      key: 'includeInactive',
      label: messages.common.includeInactive,
      removeLabel: labels.includeInactiveRemove,
    });
  }

  return chips;
};

export const hasAnyScopedFilter = (filters: ScopedFilters): boolean =>
  filters.q !== '' || filters.scopeId !== '' || filters.includeInactive;

/** 조건 하나만 푼다. 키마다 「비었다」의 표현이 달라(문자열 vs 불리언) 여기서 다룬다. */
export const clearScopedFilter = (
  filters: ScopedFilters,
  key: keyof ScopedFilters,
): ScopedFilters =>
  key === 'includeInactive' ? { ...filters, includeInactive: false } : { ...filters, [key]: '' };

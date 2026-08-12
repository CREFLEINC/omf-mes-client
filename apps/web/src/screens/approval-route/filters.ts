import { messages } from '@omf-mes/i18n';

import type { RouteFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **이 파일이 소유하는 규칙 셋**
 *
 * | 규칙 | 어디에 |
 * | --- | --- |
 * | 「미사용 포함」 ↔ `activeOnly` **방향 뒤집기**와 **늘 명시해 싣기** | `toRouteListQuery` |
 * | 조건·쪽이 바뀌면 선택(`ar`·`new`)이 사라진다 | `toSearchParams`가 그 자리를 **만들지 않는다** |
 * | 고른 결재선과 등록 중은 **함께 서지 않는다** | `readSelectedRouteId` |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.approvalRoute;

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  approvalTypeCode: 'ty',
  businessUnitId: 'bu',
  includeInactive: 'inactive',
  q: 'q',
  page: 'page',
  selected: 'ar',
  create: 'new',
} as const;

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
const ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

/** 식별자로 쓸 수 있는 값인가. 1부터 매겨지므로 0·음수·소수·문자는 어떤 자원도 가리키지 않는다. */
const isIdentifier = (raw: string): boolean => POSITIVE_INTEGER.test(raw) && Number(raw) >= 1;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const DEFAULT_FILTERS: RouteFilters = {
  approvalTypeCode: '',
  businessUnitId: '',
  includeInactive: false,
  q: '',
};

/**
 * 주소가 담은 조회 조건.
 *
 * **사업부 번호를 식별자 규칙으로 거른다.** 이 값은 그대로 `Number()`를 거쳐 계약 쿼리로 나가므로,
 * 걸러 내지 않으면 `?bu=abc` 같은 주소가 **`businessUnitId=NaN`을 서버로 보낸다.**
 */
export const readFilters = (params: URLSearchParams): RouteFilters => {
  const businessUnitId = params.get(URL_KEYS.businessUnitId) ?? '';

  return {
    approvalTypeCode: params.get(URL_KEYS.approvalTypeCode) ?? '',
    businessUnitId: isIdentifier(businessUnitId) ? businessUnitId : '',
    includeInactive: params.get(URL_KEYS.includeInactive) === ON,
    q: params.get(URL_KEYS.q) ?? '',
  };
};

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return isIdentifier(raw) ? Number(raw) : 1;
};

/**
 * 등록 폼이 열려 있는가. **값이 켜짐 표시일 때만 참이다** —
 * 값을 느슨하게 받으면 「어떤 표기가 정본인가」가 흐려진다.
 */
export const isCreating = (params: URLSearchParams): boolean =>
  params.get(URL_KEYS.create) === ON;

/**
 * 주소가 가리키는 결재선.
 *
 * **등록 중이면 아무것도 고르지 않은 것이다.** 두 자리가 함께 설 수 없다는 규칙이 여기 하나에만
 * 있어야, 「결재선을 고르는 쪽」과 「등록 폼을 여는 쪽」이 서로 다른 규칙을 갖지 않는다.
 */
export const readSelectedRouteId = (params: URLSearchParams): number | null => {
  if (isCreating(params)) return null;

  const raw = params.get(URL_KEYS.selected) ?? '';

  return isIdentifier(raw) ? Number(raw) : null;
};

/** 검색어로 쓸 수 있는가. 공백만인 값은 조건이 아니다 — 주소에도 요청에도 칩에도 서지 않는다. */
const keywordOf = (q: string): string => q.trim();

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있고,
 * 같은 화면의 주소가 두 가지가 되면 공유·뒤로가기가 갈린다.
 *
 * **선택(`ar`·`new`)을 담지 않는다.** 조건·쪽이 바뀌면 보이는 행이 달라지므로
 * 이 함수의 결과로 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다 —
 * 목록에 없는 결재선의 상세가 오른쪽에 남으면 그것이 어디서 왔는지 알 수 없다.
 */
export const toSearchParams = (filters: RouteFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();
  const keyword = keywordOf(filters.q);

  if (filters.approvalTypeCode !== '') next.set(URL_KEYS.approvalTypeCode, filters.approvalTypeCode);
  if (filters.businessUnitId !== '') next.set(URL_KEYS.businessUnitId, filters.businessUnitId);
  if (keyword !== '') next.set(URL_KEYS.q, keyword);
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름.
 *
 * **`activeOnly`는 선택이 아니다.** 계약에 기본값이 없어 생략하면 서버가 무엇을 내리는지
 * 정해져 있지 않다 — 「보내지 않음」이라는 상태를 만들지 않는다.
 *
 * **`size`가 없다.** 서버 기본값을 쓴다. 화면이 정한 크기를 심으면 그것이 계약처럼 굳는다.
 */
export interface RouteListQuery {
  approvalTypeCode?: string;
  businessUnitId?: number;
  activeOnly: boolean;
  q?: string;
  page?: number;
}

/**
 * 서버로 보낼 조회 쿼리.
 *
 * **「미사용 포함」과 `activeOnly`는 방향이 반대다.** 뒤집는 자리는 여기 한 곳이다 —
 * 화면 어휘를 다른 화면과 맞추면서(꺼짐 = 유효한 것만) 계약의 사정을 한 줄에 가둔다.
 */
export const toRouteListQuery = (filters: RouteFilters, page: number): RouteListQuery => {
  const keyword = keywordOf(filters.q);

  return {
    ...(filters.approvalTypeCode === '' ? {} : { approvalTypeCode: filters.approvalTypeCode }),
    ...(filters.businessUnitId === '' ? {} : { businessUnitId: Number(filters.businessUnitId) }),
    activeOnly: !filters.includeInactive,
    ...(keyword === '' ? {} : { q: keyword }),
    ...(page > 1 ? { page } : {}),
  };
};

export type FilterKey = keyof RouteFilters;

export interface RouteFilterChip {
  key: FilterKey;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다.
 *
 * 사업부는 **번호가 아니라 이름**으로 낸다 — 번호를 그대로 보이면 사용자가 무엇을 걸었는지 모른다.
 * 이름을 만드는 쪽이 아직 목록을 받지 못했으면 그쪽이 네 갈래 중 하나를 준다.
 */
export const toFilterChips = (
  filters: RouteFilters,
  businessUnitLabel: (businessUnitId: string) => string,
): RouteFilterChip[] => {
  const chips: RouteFilterChip[] = [];
  const keyword = keywordOf(filters.q);

  if (filters.approvalTypeCode !== '') {
    chips.push({
      key: 'approvalTypeCode',
      label: t.filters.chipApprovalType(filters.approvalTypeCode),
      removeLabel: t.filters.chipRemoveApprovalType,
    });
  }

  if (filters.businessUnitId !== '') {
    chips.push({
      key: 'businessUnitId',
      label: t.filters.chipBusinessUnit(businessUnitLabel(filters.businessUnitId)),
      removeLabel: t.filters.chipRemoveBusinessUnit,
    });
  }

  if (keyword !== '') {
    chips.push({
      key: 'q',
      label: t.filters.chipKeyword(keyword),
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

export const hasAnyFilter = (filters: RouteFilters): boolean =>
  filters.approvalTypeCode !== '' ||
  filters.businessUnitId !== '' ||
  keywordOf(filters.q) !== '' ||
  filters.includeInactive;

/**
 * 조건 하나만 푼다. 칩의 제거 버튼이 쓴다.
 * 키마다 「비었다」의 표현이 달라(문자열 vs 불리언) 호출부가 그것을 알지 않도록 여기서 다룬다.
 */
export const clearFilter = (filters: RouteFilters, key: FilterKey): RouteFilters =>
  key === 'includeInactive' ? { ...filters, includeInactive: false } : { ...filters, [key]: '' };

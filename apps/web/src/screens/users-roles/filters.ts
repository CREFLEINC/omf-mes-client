import { messages } from '@omf-mes/i18n';

import type { UserFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **「비운다/비우지 않는다」의 규칙 표는 이 파일과 `tabs.ts` 두 곳에만 둔다.**
 * 표에 없는 자리에서 조건을 비우면 탭을 바꾸는 쪽과 조건을 바꾸는 쪽이 서로 다른 규칙을 갖게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.usersRoles;

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  tab: 'tab',
  q: 'q',
  departmentId: 'dept',
  includeInactive: 'inactive',
  page: 'page',
} as const;

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
const ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

/** 식별자로 쓸 수 있는 값인가. 1부터 매겨지므로 0·음수·소수·문자는 어떤 자원도 가리키지 않는다. */
const isIdentifier = (raw: string): boolean => POSITIVE_INTEGER.test(raw) && Number(raw) >= 1;

/**
 * 사용자 목록의 조회 조건.
 *
 * **부서 번호를 식별자 규칙으로 거른다.** 이 값은 그대로 `Number()`를 거쳐 계약 쿼리로 나가므로,
 * 걸러 내지 않으면 `?dept=abc` 같은 주소가 **`departmentId=NaN`을 서버로 보낸다.**
 * 고를 수 없는 값은 「전체」(`''`)로 본다 — 주소는 손으로 고쳐지는 자리다.
 *
 * **상태 코드를 읽지 않는다.** 값 목록이 확정되지 않아 고를 수 있는 값이 없다(계획 결정 16).
 */
export const readUserFilters = (params: URLSearchParams): UserFilters => {
  const department = params.get(URL_KEYS.departmentId) ?? '';

  return {
    q: params.get(URL_KEYS.q) ?? '',
    departmentId: isIdentifier(department) ? department : '',
    includeInactive: params.get(URL_KEYS.includeInactive) === ON,
  };
};

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams, key: string = URL_KEYS.page): number => {
  const raw = params.get(key) ?? '';

  return isIdentifier(raw) ? Number(raw) : 1;
};

/**
 * 주소가 가리키는 선택 번호. 선택 자리(`usr`·앞으로 늘 `rol`)가 **같은 규칙**을 쓴다.
 *
 * 자리마다 따로 해석하면 한 자리만 규칙이 어긋나도 드러나지 않는다.
 */
export const readSelectedId = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key) ?? '';

  return isIdentifier(raw) ? Number(raw) : null;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있고,
 * 같은 화면의 주소가 두 가지가 되면 공유·뒤로가기가 갈린다.
 *
 * **선택(`usr`·`new`)을 담지 않는다.** 조건·쪽이 바뀌면 보이는 행이 달라지므로
 * 이 함수의 결과로 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다 —
 * 목록에 없는 자원의 폼이 우 칸에 남으면 그것이 어디서 왔는지 알 수 없다.
 */
export const toUserSearchParams = (
  tabId: string,
  filters: UserFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams({ [URL_KEYS.tab]: tabId });

  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.departmentId !== '') next.set(URL_KEYS.departmentId, filters.departmentId);
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름. 값이 없는 조건은 키 자체를 넣지 않는다.
 *
 * **`statusCode`가 없다.** 계약에는 그 쿼리가 있으나 값 목록이 확정되지 않아
 * 화면이 고를 수 있는 값이 하나도 없다(계획 결정 16).
 */
export interface UserListQuery {
  q?: string;
  departmentId?: number;
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
export const toUserListQuery = (filters: UserFilters, page: number): UserListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.departmentId === '' ? {} : { departmentId: Number(filters.departmentId) }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

export interface UserFilterChip {
  key: keyof UserFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다.
 *
 * 부서는 **번호가 아니라 이름**으로 낸다 — 번호를 그대로 보이면 사용자가 무엇을 걸었는지 모른다.
 * 선택 목록을 아직 받지 못했으면 이름을 만드는 쪽이 「알 수 없음」을 준다.
 */
export const toUserFilterChips = (
  filters: UserFilters,
  departmentLabel: (departmentId: string) => string,
): UserFilterChip[] => {
  const chips: UserFilterChip[] = [];

  if (filters.q !== '') {
    chips.push({
      key: 'q',
      label: t.filters.chipKeyword(filters.q),
      removeLabel: t.filters.chipRemoveKeyword,
    });
  }

  if (filters.departmentId !== '') {
    chips.push({
      key: 'departmentId',
      label: t.filters.chipDepartment(departmentLabel(filters.departmentId)),
      removeLabel: t.filters.chipRemoveDepartment,
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

export const hasAnyUserFilter = (filters: UserFilters): boolean =>
  filters.q !== '' || filters.departmentId !== '' || filters.includeInactive;

/**
 * 조건 하나만 푼다. 칩의 제거 버튼이 쓴다.
 * 키마다 「비었다」의 표현이 달라(문자열 vs 불리언) 호출부가 그것을 알지 않도록 여기서 다룬다.
 */
export const clearUserFilter = (filters: UserFilters, key: keyof UserFilters): UserFilters =>
  key === 'includeInactive' ? { ...filters, includeInactive: false } : { ...filters, [key]: '' };

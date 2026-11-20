import type { RoleFilters, RoleStatus, UserFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **「비운다/비우지 않는다」의 규칙 표는 이 파일과 `tabs.ts` 두 곳에만 둔다.**
 * 표에 없는 자리에서 조건을 비우면 탭을 바꾸는 쪽과 조건을 바꾸는 쪽이 서로 다른 규칙을 갖게 된다.
 *
 * 그 표는 셋이다.
 *
 * | 무엇을 바꿀 때 | 무엇을 비우는가 | 어디에 있는가 |
 * | --- | --- | --- |
 * | 탭 | 조건·쪽·선택 **전부** | `tabs.ts`의 `tabSearchParams` |
 * | 조건·쪽 | 선택(`usr`·`rol`·`new`) — 보이는 행이 달라진다 | `toUserSearchParams`·`toRoleSearchParams` |
 * | 선택 | **다른 선택 자리만.** 조건과 쪽은 그대로 둔다 | `applySelection` |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  tab: 'tab',
  q: 'q',
  departmentId: 'dept',
  statusCode: 'status',
  includeInactive: 'inactive',
  page: 'page',
  size: 'size',
  appUserId: 'usr',
  roleId: 'rol',
  create: 'new',
} as const;

/**
 * 등록 폼을 연 자리(`new`)에 담기는 값. **탭마다 다르다** —
 * 한 값으로 두면 사용자 탭에서 연 등록 폼이 역할 탭에서도 열린 것으로 읽힌다.
 */
const CREATE_VALUES = {
  user: 'user',
  role: 'role',
} as const;

export type CreateTarget = keyof typeof CREATE_VALUES;

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
 */
export const readUserFilters = (params: URLSearchParams): UserFilters => {
  const department = params.get(URL_KEYS.departmentId) ?? '';

  return {
    q: params.get(URL_KEYS.q) ?? '',
    departmentId: isIdentifier(department) ? department : '',
    statusCode: params.get(URL_KEYS.statusCode) ?? '',
    includeInactive: params.get(URL_KEYS.includeInactive) === ON,
  };
};

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams, key: string = URL_KEYS.page): number => {
  const raw = params.get(key) ?? '';

  return isIdentifier(raw) ? Number(raw) : 1;
};

/** 계약의 목록 기본 쪽 크기(`size` 기본 50). 주소·조회에 적지 않는다. */
export const DEFAULT_PAGE_SIZE = 50;

/** 목록 건수 선택 — 수입검사 목록과 같은 10 · 20 · 50건(사용자 지시 2026-11-20 · #333). */
export const LIST_PAGE_SIZES = [10, 20, DEFAULT_PAGE_SIZE] as const;
export type ListPageSize = (typeof LIST_PAGE_SIZES)[number];

/** 주소의 쪽 크기. 고를 수 있는 값이 아니면 기본(50)이다. */
export const readPageSize = (params: URLSearchParams): ListPageSize =>
  LIST_PAGE_SIZES.find((size) => String(size) === params.get(URL_KEYS.size)) ?? DEFAULT_PAGE_SIZE;

/**
 * 주소가 가리키는 선택 번호. 선택 자리(`usr`·`rol`)가 **같은 규칙**을 쓴다.
 *
 * 자리마다 따로 해석하면 한 자리만 규칙이 어긋나도 드러나지 않는다.
 */
export const readSelectedId = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key) ?? '';

  return isIdentifier(raw) ? Number(raw) : null;
};

/** 고른 사용자 번호. 주소 키를 화면이 되풀이하지 않도록 여기서 낸다. */
export const readSelectedAppUserId = (params: URLSearchParams): number | null =>
  readSelectedId(params, URL_KEYS.appUserId);

export const readSelectedRoleId = (params: URLSearchParams): number | null =>
  readSelectedId(params, URL_KEYS.roleId);

/**
 * 등록 폼이 열려 있는가. **값이 그 자원일 때만 참이다** —
 * 값을 느슨하게 받으면 「어떤 표기가 정본인가」가 흐려진다(`resolveTab`과 같은 판단).
 */
export const isCreating = (params: URLSearchParams, target: CreateTarget): boolean =>
  params.get(URL_KEYS.create) === CREATE_VALUES[target];

/**
 * 지금 무엇을 편집하고 있는가. **세 값은 함께 성립하지 않는 하나의 자리다** —
 * 고른 사용자(`usr`) · 사용자 등록(`new=user`) · 고른 역할(`rol`).
 * 역할 등록은 주소가 아니라 팝업이 값을 쥔다 — 열어도 고른 역할이 남아야 한다(#333).
 */
export type Selection =
  | { kind: 'user'; appUserId: number }
  | { kind: 'role'; roleId: number }
  | { kind: 'createUser' }
  | { kind: 'none' };

/**
 * 선택 자리를 **하나만** 남긴다. 배타 규칙이 이 함수 하나에만 있어야
 * 「사용자를 고르는 쪽」과 「등록 폼을 여는 쪽」이 서로 다른 규칙을 갖지 않는다.
 *
 * **조회 조건과 쪽은 건드리지 않는다.** 선택을 바꾸는 것은 보이는 행을 바꾸지 않는다 —
 * 조건을 비우는 규칙은 `toUserSearchParams`·`toRoleSearchParams`가 갖는다(양쪽이 짝이다).
 */
export const applySelection = (params: URLSearchParams, selection: Selection): void => {
  params.delete(URL_KEYS.appUserId);
  params.delete(URL_KEYS.roleId);
  params.delete(URL_KEYS.create);

  switch (selection.kind) {
    case 'user':
      params.set(URL_KEYS.appUserId, String(selection.appUserId));
      break;
    case 'role':
      params.set(URL_KEYS.roleId, String(selection.roleId));
      break;
    case 'createUser':
      params.set(URL_KEYS.create, CREATE_VALUES.user);
      break;
    case 'none':
      break;
  }
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
  size: number = DEFAULT_PAGE_SIZE,
): URLSearchParams => {
  const next = new URLSearchParams({ [URL_KEYS.tab]: tabId });

  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.departmentId !== '') next.set(URL_KEYS.departmentId, filters.departmentId);
  if (filters.statusCode !== '') next.set(URL_KEYS.statusCode, filters.statusCode);
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));
  if (size !== DEFAULT_PAGE_SIZE) next.set(URL_KEYS.size, String(size));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름. 값이 없는 조건은 키 자체를 넣지 않는다.
 *
 */
export interface UserListQuery {
  q?: string;
  departmentId?: number;
  statusCode?: string;
  includeInactive?: boolean;
  page?: number;
  size?: number;
}

/**
 * 서버로 보낼 조회 쿼리.
 *
 * **`includeInactive=false`를 명시적으로 보내지 않는다.** 계약의 기본값이 false이고,
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 * 첫 쪽도 같은 이유로 싣지 않는다.
 */
export const toUserListQuery = (
  filters: UserFilters,
  page: number,
  size: number = DEFAULT_PAGE_SIZE,
): UserListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.departmentId === '' ? {} : { departmentId: Number(filters.departmentId) }),
  ...(filters.statusCode === '' ? {} : { statusCode: filters.statusCode }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
  ...(size === DEFAULT_PAGE_SIZE ? {} : { size }),
});

export const hasAnyUserFilter = (filters: UserFilters): boolean =>
  filters.q !== '' ||
  filters.departmentId !== '' ||
  filters.statusCode !== '' ||
  filters.includeInactive;

/* ── 역할 목록의 조회 조건 ───────────────────────────────────────────────────
 *
 * 사용자와 **조건이 다르다.** 계약의 역할 목록 쿼리에는 부서도 상태도 없다 —
 * 형태가 닮았다고 같은 함수를 쓰면 계약에 없는 쿼리가 실린다.
 */

/**
 * 역할 목록의 조회 조건.
 *
 * **부서를 읽지 않는다.** 주소에 `dept`가 남아 있어도(탭을 손으로 오간 주소) 역할 조건이 아니다 —
 * 읽어 두면 언젠가 계약에 없는 쿼리로 실린다.
 */
const readRoleStatus = (value: string | null): RoleStatus =>
  value === 'active' || value === 'inactive' ? value : '';

export const readRoleFilters = (params: URLSearchParams): RoleFilters => ({
  q: params.get(URL_KEYS.q) ?? '',
  includeInactive: params.get(URL_KEYS.includeInactive) === ON,
  status: readRoleStatus(params.get(URL_KEYS.statusCode)),
});

/** 조건 전체를 주소로 옮긴다. 규칙은 사용자 쪽과 같다 — 빈 조건은 키 자체를 두지 않는다. */
export const toRoleSearchParams = (
  tabId: string,
  filters: RoleFilters,
  page: number,
  size: number = DEFAULT_PAGE_SIZE,
): URLSearchParams => {
  const next = new URLSearchParams({ [URL_KEYS.tab]: tabId });

  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (filters.status !== '') next.set(URL_KEYS.statusCode, filters.status);
  if (page > 1) next.set(URL_KEYS.page, String(page));
  if (size !== DEFAULT_PAGE_SIZE) next.set(URL_KEYS.size, String(size));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름. **`departmentId`가 없다** — 계약의 역할 목록 쿼리에 그 조건이 없다.
 * `statusCode`도 없다(사용자와 달리 계약에 그 쿼리 자체가 없다).
 */
export interface RoleListQuery {
  q?: string;
  includeInactive?: boolean;
  /** 사용 여부 라벨(#333) — 주면 그 값만. `includeInactive` 보다 앞선다(서버 #1111). */
  isActive?: boolean;
  page?: number;
  size?: number;
}

export const toRoleListQuery = (
  filters: RoleFilters,
  page: number,
  size: number = DEFAULT_PAGE_SIZE,
): RoleListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(filters.status === '' ? {} : { isActive: filters.status === 'active' }),
  ...(page > 1 ? { page } : {}),
  ...(size === DEFAULT_PAGE_SIZE ? {} : { size }),
});

export const hasAnyRoleFilter = (filters: RoleFilters): boolean =>
  filters.q !== '' || filters.includeInactive || filters.status !== '';

/**
 * 역할 추가 팝업이 처음 채울 역할 코드 — `ROLE_` 일련번호 중 쓰이지 않은 다음 번호(사용자 결정 2026-11-20 · #333).
 * 사용자가 고칠 수 있고, 겹치면 서버가 막는다.
 */
export const nextRoleCode = (codes: readonly string[]): string => {
  const numbers = codes
    .map((code) => /^ROLE_(\d+)$/.exec(code)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;

  return `ROLE_${String(next).padStart(3, '0')}`;
};

/**
 * 단말 목록의 조회 조건. **주소가 정본이다** — 새로고침·공유가 같은 목록을 연다.
 *
 * 고른 단말(`terminal`)도 같은 주소에 둔다. ⭐ **조건이 바뀌어도 고른 단말은 놓지 않는다** —
 * 아직 저장하지 않은 기능 구성이 남아 있을 수 있고, 검색어를 고쳤다는 이유로 그것을 조용히
 * 버릴 수는 없다. 목록에 없는 단말이 오른쪽에 남는 것은 감수한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface TerminalFilters {
  q: string;
  includeInactive: boolean;
  page: number;
}

export const EMPTY_FILTERS: TerminalFilters = {
  q: '',
  includeInactive: false,
  page: 1,
};

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

export const readFilters = (params: URLSearchParams): TerminalFilters => {
  const page = params.get('page') ?? '';

  return {
    q: params.get('q') ?? '',
    /* 있으면 참이다 — 값을 견주지 않는다. 체크 상자 하나에 값 규약을 더하지 않는다. */
    includeInactive: params.get('includeInactive') === '1',
    page: isPositiveInteger(page) ? Number(page) : 1,
  };
};

/** 고른 단말은 조건이 아니라 선택이라 따로 읽는다. */
export const readSelected = (params: URLSearchParams): number | null => {
  const value = params.get('terminal') ?? '';

  return isPositiveInteger(value) ? Number(value) : null;
};

/** ⛔ 기본값은 주소에 쓰지 않는다 — 주소가 길어지면 무엇이 조건인지 흐려진다. */
export const toSearchParams = (
  filters: TerminalFilters,
  selected: number | null,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.q !== '') params.set('q', filters.q);
  if (filters.includeInactive) params.set('includeInactive', '1');
  if (filters.page > 1) params.set('page', String(filters.page));
  if (selected !== null) params.set('terminal', String(selected));

  return params;
};

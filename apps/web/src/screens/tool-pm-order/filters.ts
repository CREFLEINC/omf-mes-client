import type { MoldListQuery } from './queries';

/**
 * 조회 조건의 정본은 **주소**다 — 새로고침·뒤로가기·주소 공유가 같은 화면을 낸다.
 *
 * ⭐ **기본이 「도래했고 열린 오더가 없는 것」이다.** 이 화면은 밀린 것을 보는 자리라 기본값이
 * 꺼짐인 형제 화면들의 boolean 조건과 **반대**다. 그래서 읽기를 갈래 함수로 두고 기본값을
 * 상수 한 곳에 모은다 — 다른 화면의 한 줄을 그대로 베끼면 기본값이 조용히 뒤집힌다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const ON = '1';
const OFF = '0';

export const SORT_VALUES = ['SHOT_USAGE_DESC', 'NEXT_PM_ASC', 'CODE'] as const;
export type ToolSort = (typeof SORT_VALUES)[number];

/** ⭐ 적체 화면의 기본 — 경과일보다 **초과율이 위험의 크기**다(계약이 그렇게 밝혔다). */
export const DEFAULT_SORT: ToolSort = 'SHOT_USAGE_DESC';
export const DEFAULT_DUE_ONLY = true;
export const DEFAULT_WITHOUT_OPEN_ORDER = true;

export interface ToolFilters {
  plant: string;
  dueOnly: boolean;
  /** 참이면 **열린 오더가 없는 툴만** 본다 — 이미 오더가 나간 툴에 또 내지 않기 위해서다. */
  withoutOpenOrder: boolean;
  guaranteedMissing: boolean;
  sort: ToolSort;
}

export const DEFAULT_FILTERS: ToolFilters = {
  plant: '',
  dueOnly: DEFAULT_DUE_ONLY,
  withoutOpenOrder: DEFAULT_WITHOUT_OPEN_ORDER,
  guaranteedMissing: false,
  sort: DEFAULT_SORT,
};

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

const readFlag = (raw: string | null, fallback: boolean): boolean => {
  if (raw === ON) return true;
  if (raw === OFF) return false;

  return fallback;
};

export const readSort = (raw: string | null): ToolSort =>
  SORT_VALUES.find((value) => value === raw) ?? DEFAULT_SORT;

export const readFilters = (params: URLSearchParams): ToolFilters => {
  const plant = params.get('plant') ?? '';

  return {
    plant: isPositiveInteger(plant) ? plant : '',
    dueOnly: readFlag(params.get('due'), DEFAULT_DUE_ONLY),
    withoutOpenOrder: readFlag(params.get('noorder'), DEFAULT_WITHOUT_OPEN_ORDER),
    guaranteedMissing: readFlag(params.get('nogtd'), false),
    sort: readSort(params.get('sort')),
  };
};

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get('page') ?? '';

  return isPositiveInteger(raw) ? Number(raw) : 1;
};

export const toSearchParams = (filters: ToolFilters, page: number): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.plant !== '') params.set('plant', filters.plant);
  /* 기본값과 다를 때만 싣는다 — 같으면 주소가 길어지기만 하고 뜻이 같다. */
  if (filters.dueOnly !== DEFAULT_DUE_ONLY) params.set('due', filters.dueOnly ? ON : OFF);
  if (filters.withoutOpenOrder !== DEFAULT_WITHOUT_OPEN_ORDER) {
    params.set('noorder', filters.withoutOpenOrder ? ON : OFF);
  }
  if (filters.guaranteedMissing) params.set('nogtd', ON);
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (page > 1) params.set('page', String(page));

  return params;
};

/**
 * 조건을 요청 질의로 옮긴다.
 *
 * ⭐ **「열린 오더 없는 것만」은 `false`를 실어야 뜻이 선다.** 계약이 그 파라미터를 **세 갈래**로
 * 두었다 — 생략하면 거르지 않고, `false`면 없는 것만, `true`면 있는 것만이다. 켠 상태에서
 * 키를 빼면 거르지 않는 조회가 나가 **이미 오더가 나간 툴이 목록에 섞인다.**
 *
 * ⭐ **정렬을 늘 싣는다.** 서버 기본값이 코드 순이라 싣지 않으면 적체 화면이 아니게 된다.
 */
export const toListQuery = (filters: ToolFilters, page: number): MoldListQuery => ({
  ...(filters.plant === '' ? {} : { plantId: Number(filters.plant) }),
  ...(filters.dueOnly ? { pmDueOnly: true } : {}),
  ...(filters.withoutOpenOrder ? { withOpenMaintenanceOrder: false } : {}),
  ...(filters.guaranteedMissing ? { guaranteedShotCountMissing: true } : {}),
  sort: filters.sort,
  ...(page > 1 ? { page } : {}),
});

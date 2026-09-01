/**
 * 조회 조건의 정본은 **주소**다. 새로고침·뒤로가기·주소 공유가 같은 화면을 낸다.
 *
 * ⛔ **축을 늘리지 않는다.** 대시보드는 좁히는 화면이 아니라 넓게 보는 화면이고, 좁히려면
 * 카드를 눌러 소유 화면으로 간다. 축이 둘(기준 날짜 · 공장)뿐인 것은 이 화면의 성격이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface DashboardFilters {
  /**
   * 기준 날짜. **빈 문자열이면 서버가 오늘로 정한다** — 화면이 「오늘」을 계산하지 않는다.
   * 계산하면 브라우저 시계와 서버 시계가 어긋난 자정 전후에 서로 다른 날을 본다.
   */
  baseDate: string;
  /** 공장. 빈 문자열이면 전체다. */
  plant: string;
}

export const EMPTY_FILTERS: DashboardFilters = { baseDate: '', plant: '' };

/** 날짜 칸에 들어올 수 있는 모양. 주소는 사람이 손으로 고칠 수 있어 형식을 확인한다. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 공장 번호는 양의 정수다. 아니면 조건이 없는 것으로 읽는다 — 서버에 쓰레기를 넘기지 않는다. */
const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

export const readFilters = (params: URLSearchParams): DashboardFilters => {
  const baseDate = params.get('baseDate') ?? '';
  const plant = params.get('plant') ?? '';

  return {
    baseDate: DATE_PATTERN.test(baseDate) ? baseDate : '',
    plant: isPositiveInteger(plant) ? plant : '',
  };
};

/** 채운 조건만 주소에 싣는다 — 빈 키를 남기면 주소가 길어지기만 하고 뜻이 같다. */
export const toSearchParams = (filters: DashboardFilters): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.baseDate !== '') params.set('baseDate', filters.baseDate);
  if (filters.plant !== '') params.set('plant', filters.plant);

  return params;
};

export interface DashboardFilterQuery {
  baseDate?: string;
  plantId?: number;
}

/** 조건을 요청 질의로 옮긴다. 빈 값은 키 자체를 싣지 않는다. */
export const toFilterQuery = (filters: DashboardFilters): DashboardFilterQuery => ({
  ...(filters.baseDate === '' ? {} : { baseDate: filters.baseDate }),
  ...(filters.plant === '' ? {} : { plantId: Number(filters.plant) }),
});

/**
 * 카드를 눌러 소유 화면으로 갈 때 **함께 넘기는 기준 축**.
 *
 * ⭐ 넘기지 않으면 사용자가 8월 11일의 이상한 숫자를 보고 눌렀는데 오늘 자료가 열린다 —
 * 그 순간 「대시보드가 틀렸다」로 읽힌다. 기준 날짜가 비어 있으면(서버가 오늘로 정한 상태)
 * **응답이 알려 준 날짜**를 넘긴다 — 그래야 화면이 「오늘」을 스스로 계산하지 않고도 축이 이어진다.
 */
export const toDrilldownParams = (
  filters: DashboardFilters,
  resolvedBaseDate: string | null,
): URLSearchParams => {
  const params = new URLSearchParams();
  const baseDate = filters.baseDate === '' ? (resolvedBaseDate ?? '') : filters.baseDate;

  if (baseDate !== '') params.set('baseDate', baseDate);
  if (filters.plant !== '') params.set('plantId', filters.plant);

  return params;
};

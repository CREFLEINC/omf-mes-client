/**
 * 조회 조건의 정본은 **주소**다 — 새로고침·뒤로가기·주소 공유가 같은 화면을 낸다.
 *
 * 기간은 **풀 수 없는 조건**이라 수명이 달라 `period.ts`가 따로 소유한다.
 * 여기에는 좁히는 조건 셋(공장·설비 그룹·설비)과 **탭·칸 크기**가 있다.
 *
 * ⭐ **탭도 주소가 소유한다.** 탭은 화면 안의 장식이 아니라 **서버에 보내는 묶음 축**이라
 * (`groupBy`), 주소에 없으면 새로고침할 때마다 사유별로 돌아가고 공유한 주소가 다른 표를 낸다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 세 탭이 곧 서버의 묶음 축이다. 화면이 이름을 새로 짓지 않고 계약의 값을 그대로 쓴다. */
export const GROUP_BY_VALUES = ['REASON', 'EQUIPMENT', 'PERIOD'] as const;
export type GroupBy = (typeof GROUP_BY_VALUES)[number];

/** 추이 탭의 칸 크기. 그 밖의 탭에서는 서버가 무시한다. */
export const BUCKET_VALUES = ['DAY', 'WEEK', 'MONTH'] as const;
export type Bucket = (typeof BUCKET_VALUES)[number];

export const DEFAULT_GROUP_BY: GroupBy = 'REASON';
export const DEFAULT_BUCKET: Bucket = 'DAY';

export interface DowntimeFilters {
  /** 빈 문자열이 「전체」다. */
  plant: string;
  equipmentGroup: string;
  equipment: string;
}

export const EMPTY_FILTERS: DowntimeFilters = { plant: '', equipmentGroup: '', equipment: '' };

/** 내부 번호는 양의 정수다. 아니면 조건이 없는 것으로 읽는다 — 서버에 쓰레기를 넘기지 않는다. */
const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

const readReference = (raw: string | null): string => {
  const value = raw ?? '';

  return isPositiveInteger(value) ? value : '';
};

/**
 * 주소의 값을 탭으로 읽는다. **모르는 값은 기본 탭이다** — 주소는 손으로 고쳐지는 자리라
 * 아무 문자열이 올 수 있는데, 그것을 그대로 서버에 넘기면 400이 나고 사용자는 자기가 무엇을
 * 잘못했는지 알 수 없다.
 */
export const readGroupBy = (raw: string | null): GroupBy =>
  GROUP_BY_VALUES.find((value) => value === raw) ?? DEFAULT_GROUP_BY;

export const readBucket = (raw: string | null): Bucket =>
  BUCKET_VALUES.find((value) => value === raw) ?? DEFAULT_BUCKET;

export const readFilters = (params: URLSearchParams): DowntimeFilters => ({
  plant: readReference(params.get('plant')),
  equipmentGroup: readReference(params.get('group')),
  equipment: readReference(params.get('equipment')),
});

/** 채운 조건만 주소에 싣는다. 기본값인 탭·칸 크기도 싣지 않는다 — 주소가 길어지기만 한다. */
export const toSearchParams = (
  period: { from: string; to: string },
  filters: DowntimeFilters,
  groupBy: GroupBy,
  bucket: Bucket,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (period.from !== '') params.set('from', period.from);
  if (period.to !== '') params.set('to', period.to);
  if (filters.plant !== '') params.set('plant', filters.plant);
  if (filters.equipmentGroup !== '') params.set('group', filters.equipmentGroup);
  if (filters.equipment !== '') params.set('equipment', filters.equipment);
  if (groupBy !== DEFAULT_GROUP_BY) params.set('tab', groupBy);
  /* 칸 크기는 추이 탭에서만 뜻이 있다 — 다른 탭에서 주소에 남기면 조건이 걸린 것처럼 보인다. */
  if (groupBy === 'PERIOD' && bucket !== DEFAULT_BUCKET) params.set('bucket', bucket);

  return params;
};

export const readPeriodParams = (params: URLSearchParams): { from: string; to: string } => ({
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
});

export interface DowntimeFilterQuery {
  plantId?: number;
  equipmentGroupId?: number;
  equipmentId?: number;
}

export const toFilterQuery = (filters: DowntimeFilters): DowntimeFilterQuery => ({
  ...(filters.plant === '' ? {} : { plantId: Number(filters.plant) }),
  ...(filters.equipmentGroup === '' ? {} : { equipmentGroupId: Number(filters.equipmentGroup) }),
  ...(filters.equipment === '' ? {} : { equipmentId: Number(filters.equipment) }),
});

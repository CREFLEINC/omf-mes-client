import { messages } from '@omf-mes/i18n';

import { DONE_STATUS, HANDLING_STATUS, RECEIVED_STATUS } from './types';

/**
 * 조회 조건의 정본은 **주소**다 — 새로고침·뒤로가기·주소 공유가 같은 화면을 낸다.
 *
 * ⭐ **기본이 「미처리 전건」이다.** 이 화면은 밀린 것을 보는 자리라, 기본값이 꺼짐인 형제
 * 화면들의 boolean 조건과 **반대**다. 그래서 읽기를 갈래 함수로 두고 기본값을 상수 한 곳에
 * 모은다 — 다른 화면의 `params.get(key) === ON` 한 줄을 그대로 베끼면 기본값이 조용히 뒤집힌다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.equipmentFailure;

const ON = '1';
const OFF = '0';

/** ⭐ 켜진 채로 시작한다 — 적체를 보는 화면이다. */
export const DEFAULT_OPEN_ONLY = true;

/** 정렬. 계약이 「경과일 긴 순이 기본」이라고 밝혔고 화면은 그 값을 그대로 쓴다. */
export const ELAPSED_DESC_SORT = 'elapsedDesc';

/** 상태 선택지 — 계약이 이름을 준 셋이다. */
export const STATUS_CODES: readonly string[] = [RECEIVED_STATUS, HANDLING_STATUS, DONE_STATUS];

export interface FailureFilters {
  equipment: string;
  status: string;
  openOnly: boolean;
  withoutOrder: boolean;
  from: string;
  to: string;
}

export const DEFAULT_FILTERS: FailureFilters = {
  equipment: '',
  status: '',
  openOnly: DEFAULT_OPEN_ONLY,
  withoutOrder: false,
  from: '',
  to: '',
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isCalendarDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

/**
 * 주소의 값을 켜짐/꺼짐으로 읽는다.
 *
 * **키가 없거나 모르는 값이면 기본값이다.** 주소는 손으로 고쳐지는 자리라 아무 값이 올 수
 * 있는데, 그것을 꺼짐으로 읽으면 사용자가 만들지 않은 조건이 걸린다.
 */
const readFlag = (raw: string | null, fallback: boolean): boolean => {
  if (raw === ON) return true;
  if (raw === OFF) return false;

  return fallback;
};

export const readFilters = (params: URLSearchParams): FailureFilters => {
  const equipment = params.get('equipment') ?? '';
  const status = (params.get('status') ?? '').trim();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  return {
    equipment: isPositiveInteger(equipment) ? equipment : '',
    /* 모르는 상태 코드는 조건이 아니다 — 그대로 넘기면 결과가 늘 비고 이유를 알 수 없다. */
    status: STATUS_CODES.includes(status) ? status : '',
    openOnly: readFlag(params.get('open'), DEFAULT_OPEN_ONLY),
    withoutOrder: readFlag(params.get('noorder'), false),
    from: isCalendarDate(from) ? from : '',
    to: isCalendarDate(to) ? to : '',
  };
};

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get('page') ?? '';

  return isPositiveInteger(raw) ? Number(raw) : 1;
};

/** 고른 고장. 주소가 소유해 새로고침·공유가 같은 건을 연다. */
export const readSelected = (params: URLSearchParams): number | null => {
  const raw = params.get('breakdown') ?? '';

  return isPositiveInteger(raw) ? Number(raw) : null;
};

export const toSearchParams = (
  filters: FailureFilters,
  page: number,
  selected: number | null,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.equipment !== '') params.set('equipment', filters.equipment);
  if (filters.status !== '') params.set('status', filters.status);
  /* 기본값과 다를 때만 싣는다 — 같으면 주소가 길어지기만 하고 뜻이 같다. */
  if (filters.openOnly !== DEFAULT_OPEN_ONLY) params.set('open', filters.openOnly ? ON : OFF);
  if (filters.withoutOrder) params.set('noorder', ON);
  if (filters.from !== '') params.set('from', filters.from);
  if (filters.to !== '') params.set('to', filters.to);
  if (page > 1) params.set('page', String(page));
  if (selected !== null) params.set('breakdown', String(selected));

  return params;
};

export const periodLockReason = (filters: FailureFilters): string | null => {
  const hasInvalid =
    (filters.from !== '' && !isCalendarDate(filters.from)) ||
    (filters.to !== '' && !isCalendarDate(filters.to));

  if (hasInvalid) return t.filters.periodInvalid;

  if (filters.from !== '' && filters.to !== '' && filters.to < filters.from) {
    return t.filters.periodReversed;
  }

  return null;
};

export interface FailureListQuery {
  equipmentId?: number;
  statusCode?: string;
  openOnly?: boolean;
  withoutMaintenanceOrder?: boolean;
  reportedFrom?: string;
  reportedTo?: string;
  sort?: string;
  page?: number;
}

/**
 * 조건을 요청 질의로 옮긴다.
 *
 * ⭐ **정렬을 늘 싣는다.** 계약이 「경과일 긴 순이 기본」이라 했지만, 싣지 않으면 서버 기본값이
 * 바뀌는 날 화면이 조용히 다른 차례를 보이고 **적체를 보는 화면이 아니게 된다.**
 */
export const toListQuery = (filters: FailureFilters, page: number): FailureListQuery => ({
  ...(filters.equipment === '' ? {} : { equipmentId: Number(filters.equipment) }),
  ...(filters.status === '' ? {} : { statusCode: filters.status }),
  ...(filters.openOnly ? { openOnly: true } : {}),
  ...(filters.withoutOrder ? { withoutMaintenanceOrder: true } : {}),
  ...(filters.from === '' ? {} : { reportedFrom: filters.from }),
  ...(filters.to === '' ? {} : { reportedTo: filters.to }),
  sort: ELAPSED_DESC_SORT,
  ...(page > 1 ? { page } : {}),
});

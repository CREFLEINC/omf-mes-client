import { messages } from '@omf-mes/i18n';

/**
 * 조회 조건의 정본은 **주소**다 — 새로고침·뒤로가기·주소 공유가 같은 화면을 낸다.
 *
 * ⭐ **기간이 선택이다.** 계약이 이 목록의 두 날짜를 선택으로 두었다 — 비가동 목록(W-05-08)과
 * 반대다. 그쪽은 원장이 계속 쌓여 무제한 조회를 막아야 하지만, 계측기 이력은 계측기 하나당
 * 몇 건이라 기간을 강제하면 「이 계측기의 전부」를 볼 길이 사라진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.gaugeCalibration;

export interface CalibrationFilters {
  /** 계측기. 빈 문자열이면 전체다. */
  equipment: string;
  historyType: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: CalibrationFilters = {
  equipment: '',
  historyType: '',
  from: '',
  to: '',
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 달력에 실재하는 날만 통과시킨다 — `2026-02-31`은 형태만 맞고 날이 아니다. */
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

export const readFilters = (params: URLSearchParams): CalibrationFilters => {
  const equipment = params.get('equipment') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  return {
    equipment: isPositiveInteger(equipment) ? equipment : '',
    /* 유형 코드는 값 목록이 확정되지 않아 형태를 검사할 수 없다 — 다듬기만 한다. */
    historyType: (params.get('type') ?? '').trim(),
    from: isCalendarDate(from) ? from : '',
    to: isCalendarDate(to) ? to : '',
  };
};

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get('page') ?? '';

  return isPositiveInteger(raw) ? Number(raw) : 1;
};

export const toSearchParams = (filters: CalibrationFilters, page: number): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.equipment !== '') params.set('equipment', filters.equipment);
  if (filters.historyType !== '') params.set('type', filters.historyType);
  if (filters.from !== '') params.set('from', filters.from);
  if (filters.to !== '') params.set('to', filters.to);
  /* 첫 쪽은 싣지 않는다 — 서버 기본값이 1이다. */
  if (page > 1) params.set('page', String(page));

  return params;
};

/**
 * 기간을 막는 사유. **기간이 선택이라 「비었다」는 막지 않는다** — 셋 중 둘만 본다.
 * 한쪽만 채운 것도 막지 않는다: 계약이 두 칸을 각각 선택으로 두어 「이 날 이후 전부」가 성립한다.
 */
export const periodLockReason = (filters: CalibrationFilters): string | null => {
  const hasInvalid =
    (filters.from !== '' && !isCalendarDate(filters.from)) ||
    (filters.to !== '' && !isCalendarDate(filters.to));

  if (hasInvalid) return t.filters.periodInvalid;

  /* 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다. */
  if (filters.from !== '' && filters.to !== '' && filters.to < filters.from) {
    return t.filters.periodReversed;
  }

  return null;
};

export interface CalibrationListQuery {
  equipmentId?: number;
  historyTypeCode?: string;
  performedFrom?: string;
  performedTo?: string;
  page?: number;
}

export const toListQuery = (filters: CalibrationFilters, page: number): CalibrationListQuery => ({
  ...(filters.equipment === '' ? {} : { equipmentId: Number(filters.equipment) }),
  ...(filters.historyType === '' ? {} : { historyTypeCode: filters.historyType }),
  ...(filters.from === '' ? {} : { performedFrom: filters.from }),
  ...(filters.to === '' ? {} : { performedTo: filters.to }),
  ...(page > 1 ? { page } : {}),
});

import { PAGE_SIZES } from '../../patterns/page-nav';
import { DEFAULT_AUTO_PLAN_FILTER, type AutoPlanFilter } from './worklist-model';
import type { WorklistFilters } from './worklist-queries';

/** 작업함 조회 조건과 주소 쿼리. 기본 조건(조치 필요, 1쪽, 20건)은 주소에 쓰지 않는다. */
export const DEFAULT_WORKLIST_FILTERS: WorklistFilters = {
  autoPlan: DEFAULT_AUTO_PLAN_FILTER,
  q: '',
  dueFrom: '',
  dueTo: '',
  item: '',
  page: 1,
  size: 20,
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const positive = (value: string | null): number | null => {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const autoPlanOf = (value: string | null): AutoPlanFilter =>
  value === 'DONE' || value === 'NEEDS_REVIEW' || value === 'ALL'
    ? value
    : DEFAULT_AUTO_PLAN_FILTER;

export const readWorklistFilters = (params: URLSearchParams): WorklistFilters => {
  const size = positive(params.get('size'));
  return {
    autoPlan: autoPlanOf(params.get('autoPlan')),
    q: (params.get('q') ?? '').trim(),
    dueFrom: datePattern.test(params.get('dueFrom') ?? '') ? (params.get('dueFrom') ?? '') : '',
    dueTo: datePattern.test(params.get('dueTo') ?? '') ? (params.get('dueTo') ?? '') : '',
    item: String(positive(params.get('item')) ?? ''),
    page: positive(params.get('page')) ?? 1,
    size: size !== null && (PAGE_SIZES as readonly number[]).includes(size) ? size : 20,
  };
};

export const toWorklistSearchParams = (filters: WorklistFilters): URLSearchParams => {
  const next = new URLSearchParams();
  if (filters.autoPlan !== DEFAULT_AUTO_PLAN_FILTER) next.set('autoPlan', filters.autoPlan);
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.dueFrom !== '') next.set('dueFrom', filters.dueFrom);
  if (filters.dueTo !== '') next.set('dueTo', filters.dueTo);
  if (filters.item !== '') next.set('item', filters.item);
  if (filters.page > 1) next.set('page', String(filters.page));
  if (filters.size !== 20) next.set('size', String(filters.size));
  return next;
};

/** 처리 화면 주소. 내부 번호가 아니라 업무 번호를 쓴다(T-W-C 주소와 이동). 단계는 주소에 넣지 않는다. */
export const processPath = (orderNo: string): string =>
  `/production/production-orders/${encodeURIComponent(orderNo)}`;

const REMEMBER_KEY = 'omf.erp-wo-worklist.search';

/**
 * 사용자가 마지막으로 본 작업함 조건. 처리 화면의 [← 작업지시 목록]과 완료 화면의 [다음 ERP W/O]가 쓴다
 * (T-W-C 완료 화면 「마지막으로 본 작업함 조건과 정렬에서 다음 행」). 저장소를 못 쓰면 기본 조건이다.
 */
export const rememberWorklistSearch = (params: URLSearchParams): void => {
  try {
    sessionStorage.setItem(REMEMBER_KEY, params.toString());
  } catch {
    /* 저장소를 못 쓰는 창이면 기본 조건으로 돌아간다. */
  }
};

export const rememberedWorklistSearch = (): URLSearchParams => {
  try {
    return new URLSearchParams(sessionStorage.getItem(REMEMBER_KEY) ?? '');
  } catch {
    return new URLSearchParams();
  }
};

export const worklistPath = (params: URLSearchParams = rememberedWorklistSearch()): string => {
  const query = params.toString();
  return `/production/production-orders${query === '' ? '' : `?${query}`}`;
};

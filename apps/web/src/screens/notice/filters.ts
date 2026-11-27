import { messages } from '@omf-mes/i18n';

import { PAGE_SIZES, type PageSize } from '../../patterns/page-nav';

/**
 * 공지 목록의 조회 조건. **주소가 정본이다** — 새로고침·공유가 같은 목록을 연다.
 *
 * ⛔ **기간을 필수로 받지 않는다.** 기간 필수 규약은 원장·파티션 표의 조항이고 공지는 둘 다
 * 아니다 — 계약이 그렇게 두었다. 화면 기본은 「게시 중」이며 기간은 비울 수 있다.
 *
 * ⭐ **기간은 시작일이 아니라 «겹침»으로 거른다.** 8월 한 달을 물었을 때 7월에 시작해 9월에
 * 끝나는 공지가 빠지면, 지금 붙어 있는 공지를 못 보게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.notice;

export interface NoticeFilters {
  q: string;
  statusCode: string;
  scopeCode: string;
  activeOnly: boolean;
  unacknowledgedByMe: boolean;
  overlapFrom: string;
  overlapTo: string;
  page: number;
}

/** 기본은 「게시 중만」이다 — 관리자가 처음 보는 것은 지금 붙어 있는 공지다. */
export const EMPTY_FILTERS: NoticeFilters = {
  q: '',
  statusCode: '',
  scopeCode: '',
  activeOnly: true,
  unacknowledgedByMe: false,
  overlapFrom: '',
  overlapTo: '',
  page: 1,
};

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const readDate = (value: string | null): string =>
  value !== null && DATE_PATTERN.test(value) ? value : '';

export const readFilters = (params: URLSearchParams): NoticeFilters => {
  const page = params.get('page') ?? '';
  const activeOnly = params.get('activeOnly');

  return {
    q: params.get('q') ?? '',
    statusCode: params.get('statusCode') ?? '',
    scopeCode: params.get('scopeCode') ?? '',
    /* 기본이 참이라 「0」이 명시적으로 끄는 값이다. */
    activeOnly: activeOnly === null ? true : activeOnly !== '0',
    unacknowledgedByMe: params.get('unacknowledgedByMe') === '1',
    overlapFrom: readDate(params.get('overlapFrom')),
    overlapTo: readDate(params.get('overlapTo')),
    page: isPositiveInteger(page) ? Number(page) : 1,
  };
};

/**
 * 주소가 가리키는 쪽 크기. **고른 적이 없으면 `null`** — 그때는 화면 기본 크기(`PAGE_SIZE`)로 조회한다.
 * 조회 조건이 아니라 보는 방식이라 `NoticeFilters`에 두지 않는다 — 조건 초기화·변경 판정에 끼지 않는다(#361).
 */
export const readSize = (params: URLSearchParams): PageSize | null => {
  const size = Number(params.get('size') ?? '');

  return PAGE_SIZES.find((option) => option === size) ?? null;
};

export const readSelected = (params: URLSearchParams): number | null => {
  const value = params.get('notice') ?? '';

  return isPositiveInteger(value) ? Number(value) : null;
};

/** ⛔ 기본값은 주소에 쓰지 않는다 — 주소가 길어지면 무엇이 조건인지 흐려진다. */
export const toSearchParams = (
  filters: NoticeFilters,
  selected: number | null,
  size: PageSize | null = null,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.q !== '') params.set('q', filters.q);
  if (filters.statusCode !== '') params.set('statusCode', filters.statusCode);
  if (filters.scopeCode !== '') params.set('scopeCode', filters.scopeCode);
  if (!filters.activeOnly) params.set('activeOnly', '0');
  if (filters.unacknowledgedByMe) params.set('unacknowledgedByMe', '1');
  if (filters.overlapFrom !== '') params.set('overlapFrom', filters.overlapFrom);
  if (filters.overlapTo !== '') params.set('overlapTo', filters.overlapTo);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (size !== null) params.set('size', String(size));
  if (selected !== null) params.set('notice', String(selected));

  return params;
};

/**
 * 상태 라벨 필터(#361) — 「게시 중만」 체크 · 상태 선택칸을 하나로 합친 자리(「전체」는 라벨을 고르지 않은 상태).
 * 조건 값은 그대로 두고 보이는 모양만 바꾼다: 「게시 중」 탭은 종전 기본(`activeOnly`)과 같은 조회다
 * (서버가 둘을 같은 조건으로 거른다). 다른 상태는 `statusCode`, 「전체」는 둘 다 비운다.
 */
export type StatusTab = 'ALL' | 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CLOSED';

export const STATUS_TABS: readonly StatusTab[] = [
  'ALL',
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'CLOSED',
];

export const statusTabOf = (filters: NoticeFilters): StatusTab => {
  if (filters.statusCode !== '') {
    return (STATUS_TABS as readonly string[]).includes(filters.statusCode)
      ? (filters.statusCode as StatusTab)
      : 'ALL';
  }

  return filters.activeOnly ? 'PUBLISHED' : 'ALL';
};

export const withStatusTab = (tab: StatusTab): Pick<NoticeFilters, 'activeOnly' | 'statusCode'> => {
  if (tab === 'PUBLISHED') return { activeOnly: true, statusCode: '' };
  if (tab === 'ALL') return { activeOnly: false, statusCode: '' };

  return { activeOnly: false, statusCode: tab };
};

/** 기간이 뒤집혔는가. 뒤집힌 채로 보내면 0건이 나오고 사람은 「없다」로 읽는다. */
export const periodError = (filters: NoticeFilters): string | undefined => {
  if (filters.overlapFrom === '' || filters.overlapTo === '') return undefined;

  return filters.overlapTo < filters.overlapFrom ? t.filters.invalidPeriod : undefined;
};

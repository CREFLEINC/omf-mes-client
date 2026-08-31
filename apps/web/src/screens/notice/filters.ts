import { messages } from '@omf-mes/i18n';

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

export const readSelected = (params: URLSearchParams): number | null => {
  const value = params.get('notice') ?? '';

  return isPositiveInteger(value) ? Number(value) : null;
};

/** ⛔ 기본값은 주소에 쓰지 않는다 — 주소가 길어지면 무엇이 조건인지 흐려진다. */
export const toSearchParams = (
  filters: NoticeFilters,
  selected: number | null,
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
  if (selected !== null) params.set('notice', String(selected));

  return params;
};

/** 기간이 뒤집혔는가. 뒤집힌 채로 보내면 0건이 나오고 사람은 「없다」로 읽는다. */
export const periodError = (filters: NoticeFilters): string | undefined => {
  if (filters.overlapFrom === '' || filters.overlapTo === '') return undefined;

  return filters.overlapTo < filters.overlapFrom ? t.filters.invalidPeriod : undefined;
};

import { findSelectableDocumentType, type DocumentTypeEntry } from './document-types';

/**
 * 진행현황 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * ⭐ **이 화면의 조건은 축이 하나 다르다** — 문서 유형은 「좁히는 조건」이 아니라 **조회가
 * 성립하기 위한 전제**다. 계약이 `documentTypeCode`를 필수 질의값으로 두었고, 유형을 고르지
 * 않으면 서버가 한 형태로 맞출 대상 자체가 정해지지 않는다. 그래서 이 모듈의 질의 조립은
 * **유형이 없으면 질의를 만들지 않는다**(`null`을 돌려준다).
 *
 * **고른 문서(상세)의 주소 키는 이 모듈이 만들지 않는다** — 상세 구획이 생기는 회차(단위 ②)에서
 * 자기 파일을 갖는다. 조건이 바뀌면 고른 문서가 새 결과에 없을 수 있어 함께 비워져야 하고,
 * 고르는 쪽만 이 결과에 덧붙인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ProgressFilters {
  /** 문서 유형 코드. **조건이 아니라 전제다** — 없으면 조회가 성립하지 않는다. */
  documentType: string;
  /** 상태 코드. 선택지가 자리표시라 지금은 주소를 손으로 고칠 때만 들어온다. */
  status: string;
  /** 문서 일자 범위. `DatePicker mode="range"` 한 컨트롤이 `YYYY-MM-DD` 두 값을 준다. */
  from: string;
  to: string;
  /** 품목 번호. 정수만 뜻이 있다 — 계약이 `itemId`를 정수로 요구한다. */
  item: string;
  /** 자재 LOT 번호. 같은 위. */
  lot: string;
  /** 창고 번호. 같은 위. */
  warehouse: string;
  /**
   * 지금 취소 가능한 것만 볼 것인가.
   *
   * **끈 상태도 조건이다** — 계약의 기본값을 화면이 알 수 없으므로 요청에 **늘 명시해** 싣는다
   * (`toListQuery`). 주소에는 켰을 때만 적는다: 기본값을 주소에 적으면 같은 화면의 주소가
   * 두 가지가 된다.
   */
  cancellableOnly: boolean;
  /** 문서번호 검색어 */
  q: string;
}

/**
 * 화면이 아무 조건도 걸지 않은 상태.
 *
 * **기본 기간을 심지 않는다.** 심으면 첫 요청에 날짜가 실리고, 사용자는 왜 그 기간만 보이는지
 * 화면 어디에서도 읽을 수 없다.
 *
 * **유형도 심지 않는다.** 고를 값 자체가 아직 없고(자리표시 표), 하나를 골라 심으면 그것이 곧
 * 지어낸 값이 된다.
 */
export const DEFAULT_PROGRESS_FILTERS: ProgressFilters = {
  documentType: '',
  status: '',
  from: '',
  to: '',
  item: '',
  lot: '',
  warehouse: '',
  cancellableOnly: false,
  q: '',
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  documentType: 'ty',
  status: 'st',
  from: 'from',
  to: 'to',
  item: 'item',
  lot: 'lot',
  warehouse: 'wh',
  cancellableOnly: 'conly',
  q: 'q',
  page: 'page',
} as const;

/**
 * 조건으로 받아들이는 번호의 모양.
 *
 * **자릿수에 상한을 둔다.** `^\d+$`만 두면 22자리 이상이 통과하는데, 그 값을 `Number()`에
 * 넘기면 `1e+21`이 되고 요청 URL에 그대로 실린다 — 「이상한 값이 URL에 실려 조회 전체가
 * 실패한다」가 상한 쪽에서 되살아난다.
 *
 * **15자리로 끊는 이유**: 안전 정수 범위 안이라 `Number()`가 값을 조용히 바꾸지 않고, 지수
 * 표기가 나타나는 21자리에도 한참 못 미친다. 계약의 식별자는 64비트 정수이므로 더 짧게 끊으면
 * 서버가 낼 수 있는 정당한 번호를 화면이 조용히 버릴 수 있다.
 */
const POSITIVE_INTEGER = /^\d{1,15}$/;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * **조회 전체가 400으로 실패**하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 * 주소를 손으로 고친 경우가 이 자리다.
 */
export const readNumberFilter = (raw: string): string =>
  POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? raw : '';

/**
 * **자릿수뿐 아니라 실제로 있는 날짜인지도 본다.** `2026-02-31`은 자릿수가 맞지만 없는 날이라
 * 그대로 보내면 조회가 늘 실패하는데 화면에는 조건이 걸린 것처럼 보인다.
 * `Date`로 되짚어 같은 날짜가 나오는지 확인한다.
 */
export const readDateFilter = (raw: string): string => {
  const matched = DATE_PATTERN.exec(raw);

  if (matched === null) return '';

  const [, year, month, day] = matched;
  const at = new Date(`${String(year)}-${String(month)}-${String(day)}T00:00:00Z`);

  if (Number.isNaN(at.getTime())) return '';

  return at.toISOString().slice(0, 10) === raw ? raw : '';
};

/**
 * 공백만 친 값은 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다.
 * 검색어와 코드 조건 둘이 같은 규칙을 쓴다.
 */
export const normalizeText = (raw: string): string => raw.trim();

/**
 * 켬/끔을 주소에서 읽는다. **`'1'`만 켬으로 본다** — 「참으로 읽히는 아무 값」을 켬으로 받으면
 * `?conly=false`가 켜진 상태가 되어 주소가 화면과 반대를 말한다.
 */
export const readFlagFilter = (raw: string): boolean => raw === '1';

export const readFilters = (params: URLSearchParams): ProgressFilters => ({
  documentType: normalizeText(params.get(URL_KEYS.documentType) ?? ''),
  status: normalizeText(params.get(URL_KEYS.status) ?? ''),
  from: readDateFilter(params.get(URL_KEYS.from) ?? ''),
  to: readDateFilter(params.get(URL_KEYS.to) ?? ''),
  item: readNumberFilter(params.get(URL_KEYS.item) ?? ''),
  lot: readNumberFilter(params.get(URL_KEYS.lot) ?? ''),
  warehouse: readNumberFilter(params.get(URL_KEYS.warehouse) ?? ''),
  cancellableOnly: readFlagFilter(params.get(URL_KEYS.cancellableOnly) ?? ''),
  /*
   * **검색어만 원문 그대로 읽는다** — 다듬지 않는 것이 빠뜨린 것이 아니다. 이 값은 검색칸에
   * 그대로 서야 하므로(친 공백이 말없이 사라지면 사용자가 자기가 무엇을 쳤는지 되짚을 수 없다)
   * 다듬기는 **쓰는 자리**가 한다 — 요청 조립과 주소 둘 다 `normalizeText`를 거치므로 공백만인
   * 검색어는 어디에도 실리지 않는다.
   */
  q: params.get(URL_KEYS.q) ?? '',
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return readNumberFilter(raw) === '' ? 1 : Number(raw);
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * 첫 쪽이면 `page`를 적지 않는다. 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다.
 * 「취소 가능한 것만」도 같은 이유로 **켰을 때만** 적는다 — 요청에 늘 싣는 것과 갈리는 자리이며,
 * 요청은 서버 기본값을 모르기 때문에 명시하고 주소는 사람이 읽는 자리라 기본값을 적지 않는다.
 */
export const toSearchParams = (filters: ProgressFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    [URL_KEYS.documentType, normalizeText(filters.documentType)],
    [URL_KEYS.status, normalizeText(filters.status)],
    [URL_KEYS.from, readDateFilter(filters.from)],
    [URL_KEYS.to, readDateFilter(filters.to)],
    [URL_KEYS.item, readNumberFilter(filters.item)],
    [URL_KEYS.lot, readNumberFilter(filters.lot)],
    [URL_KEYS.warehouse, readNumberFilter(filters.warehouse)],
    [URL_KEYS.q, normalizeText(filters.q)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (filters.cancellableOnly) next.set(URL_KEYS.cancellableOnly, '1');
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름.
 *
 * `size`는 싣지 않는다 — 쪽 크기는 서버 기본값을 쓴다.
 *
 * ⭐ **`cancellableOnly`만 선택이 아니다.** 계약의 기본값을 화면이 알 수 없는데 이 조건은
 * 결과 집합을 통째로 가르므로, 끈 상태에서 키를 빼면 **화면은 껐다고 말하는데 서버는 켠 채로
 * 답할 수 있다.** 그래서 늘 실린다.
 */
export interface DocumentProgressListQuery {
  documentTypeCode: string;
  statusCode?: string;
  documentDateFrom?: string;
  documentDateTo?: string;
  itemId?: number;
  lotId?: number;
  warehouseId?: number;
  cancellableOnly: boolean;
  q?: string;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
}

/**
 * 조건을 요청 질의로 옮긴다. **조회가 성립하지 않으면 `null`이다.**
 *
 * ⭐ **유형 표를 인자로 받는다.** 성립 판정이 「고른 유형이 표에 있고 고를 수 있는가」이므로,
 * 표가 비어 있는 동안에는 어떤 주소로도 `null`이 나온다 — 그것이 **목록 조회를 한 번도 부르지
 * 않는다**의 구현이다. 표를 함수 안에서 직접 읽으면 「채우면 살아난다」를 감지기가 잴 수 없다.
 *
 * **판정을 여기 한 곳에 둔다.** 화면이 따로 한 번 더 판정하면 두 자리가 갈리고, 갈리는 순간
 * 유형 없는 요청이나 비활성 유형의 요청이 나간다.
 */
export const toListQuery = (
  filters: ProgressFilters,
  entries: readonly DocumentTypeEntry[],
  page: number,
): DocumentProgressListQuery | null => {
  const selected = findSelectableDocumentType(normalizeText(filters.documentType), entries);

  if (selected === null) return null;

  const status = normalizeText(filters.status);
  const from = readDateFilter(filters.from);
  const to = readDateFilter(filters.to);
  const item = readNumberFilter(filters.item);
  const lot = readNumberFilter(filters.lot);
  const warehouse = readNumberFilter(filters.warehouse);
  const query = normalizeText(filters.q);

  return {
    documentTypeCode: selected.code,
    ...(status === '' ? {} : { statusCode: status }),
    ...(from === '' ? {} : { documentDateFrom: from }),
    ...(to === '' ? {} : { documentDateTo: to }),
    ...(item === '' ? {} : { itemId: Number(item) }),
    ...(lot === '' ? {} : { lotId: Number(lot) }),
    ...(warehouse === '' ? {} : { warehouseId: Number(warehouse) }),
    cancellableOnly: filters.cancellableOnly,
    ...(query === '' ? {} : { q: query }),
    ...(page > 1 ? { page } : {}),
  };
};

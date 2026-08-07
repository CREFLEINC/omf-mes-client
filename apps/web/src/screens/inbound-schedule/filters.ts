import { messages } from '@omf-mes/i18n';

import type { PeriodInput } from './period';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 값은 전부 문자열로 다룬다. 입력 도중의 상태를 숫자로 강제하면 지우는 중간에 값이 튄다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.inboundSchedule;

export interface AsnFilters {
  /** 공급사 번호. 정수만 뜻이 있다 — 계약이 `supplierId`를 정수로 요구한다. */
  supplier: string;
  status: string;
  /** 품목 번호. 공급사와 같은 이유로 정수만 받는다. */
  item: string;
  /** 입하예정번호·거래명세서번호 검색어 */
  q: string;
}

export const EMPTY_FILTERS: AsnFilters = { supplier: '', status: '', item: '', q: '' };

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS: Record<keyof AsnFilters, string> = {
  supplier: 'supplier',
  status: 'status',
  item: 'item',
  q: 'q',
};

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * **조회 전체가 400으로 실패**하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 * 주소를 손으로 고친 경우가 이 자리다.
 */
const readNumberFilter = (raw: string): string => (POSITIVE_INTEGER.test(raw) ? raw : '');

/** 공백만 친 검색어는 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다. */
const normalizeQuery = (raw: string): string => raw.trim();

export const readFilters = (params: URLSearchParams): AsnFilters => ({
  supplier: readNumberFilter(params.get(URL_KEYS.supplier) ?? ''),
  status: params.get(URL_KEYS.status) ?? '',
  item: readNumberFilter(params.get(URL_KEYS.item) ?? ''),
  q: params.get(URL_KEYS.q) ?? '',
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get('page') ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 고른 입하 예정의 번호. **요청 쿼리에 실리지 않는다** — 라인 조회의 경로 조각으로만 쓴다.
 *
 * 주소에 두는 이유는 새로고침·뒤로가기·공유가 같은 건을 열어야 하기 때문이다.
 */
export const readSelectedId = (params: URLSearchParams): number | null => {
  const raw = params.get('sel') ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * **기간도 빈 쪽은 적지 않는다.** 기본 기간을 심으면 「기간이 필수」로 읽히고,
 * 필수가 아니라는 사실이 화면에서 사라진다(이슈 #20 §6).
 *
 * 첫 쪽이면 `page`를 적지 않는다. 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다.
 *
 * **`sel`(고른 건)을 만들지 않는다.** 조건·쪽이 바뀌면 그 건이 새 결과에 없을 수 있어
 * 함께 비워져야 하고, 고르는 쪽만 이 결과에 `sel`을 덧붙인다.
 */
export const toSearchParams = (
  period: PeriodInput,
  filters: AsnFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    ['from', period.from],
    ['to', period.to],
    [URL_KEYS.supplier, readNumberFilter(filters.supplier)],
    [URL_KEYS.status, filters.status],
    [URL_KEYS.item, readNumberFilter(filters.item)],
    [URL_KEYS.q, normalizeQuery(filters.q)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (page > 1) next.set('page', String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 두 번호만 숫자로 보낸다 — 계약이 정수를 요구한다. */
export interface AsnFilterQuery {
  supplierId?: number;
  statusCode?: string;
  itemId?: number;
  q?: string;
}

export const toFilterQuery = (filters: AsnFilters): AsnFilterQuery => {
  const supplier = readNumberFilter(filters.supplier);
  const item = readNumberFilter(filters.item);
  const query = normalizeQuery(filters.q);

  return {
    ...(supplier === '' ? {} : { supplierId: Number(supplier) }),
    ...(filters.status === '' ? {} : { statusCode: filters.status }),
    ...(item === '' ? {} : { itemId: Number(item) }),
    ...(query === '' ? {} : { q: query }),
  };
};

export interface FilterChip {
  key: keyof AsnFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 넷이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 참조 조건의 표시 이름. **화면이 이름으로 풀어 넘긴다.**
 *
 * 이 모듈이 번호를 문구로 바꾸지 않는 것이 #44를 구조로 막는 형태다 —
 * 내부 번호를 문자열로 만드는 자리가 아예 없으면 그 값이 화면에 샐 경로도 없다.
 */
export interface FilterChipNames {
  supplier: string;
  item: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: AsnFilters, names: FilterChipNames): FilterChip[] => {
  const candidates: FilterChip[] = [
    {
      key: 'supplier',
      label: t.filters.chipSupplier(names.supplier),
      removeLabel: t.filters.chipRemoveSupplier,
    },
    {
      key: 'status',
      label: t.filters.chipStatus(filters.status),
      removeLabel: t.filters.chipRemoveStatus,
    },
    { key: 'item', label: t.filters.chipItem(names.item), removeLabel: t.filters.chipRemoveItem },
    { key: 'q', label: t.filters.chipQ(filters.q), removeLabel: t.filters.chipRemoveQ },
  ];

  return candidates.filter((chip) => filters[chip.key] !== '');
};

export const hasAnyFilter = (filters: AsnFilters): boolean =>
  Object.values(filters).some((value) => value !== '');

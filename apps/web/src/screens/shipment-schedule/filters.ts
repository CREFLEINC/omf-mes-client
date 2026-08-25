import { messages } from '@omf-mes/i18n';

import type { PeriodInput } from './period';
import type { SortKey } from './sort';

/**
 * 조회 조건(기간 제외) — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 값은 전부 문자열로 다룬다. 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.shipmentSchedule;

export interface ShipmentFilters {
  /** 고객 번호. 정수만 뜻이 있다 — 계약이 `customerId`를 정수로 요구한다. */
  customer: string;
  /** 납품처 번호. 고객과 같은 이유로 정수만 받는다. */
  shipToPartner: string;
  status: string;
  /** 검사 상태. `''`(전체) · `'true'`(대상) · `'false'`(대상 아님) 세 값만 갖는다. */
  inspection: string;
}

export const EMPTY_FILTERS: ShipmentFilters = {
  customer: '',
  shipToPartner: '',
  status: '',
  inspection: '',
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS: Record<keyof ShipmentFilters, string> = {
  customer: 'customer',
  shipToPartner: 'shipToPartner',
  status: 'status',
  inspection: 'inspection',
};

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * 조회 전체가 400으로 실패하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 */
const readNumberFilter = (raw: string): string => (POSITIVE_INTEGER.test(raw) ? raw : '');

const readInspectionFilter = (raw: string): string =>
  raw === 'true' || raw === 'false' ? raw : '';

export const readFilters = (params: URLSearchParams): ShipmentFilters => ({
  customer: readNumberFilter(params.get(URL_KEYS.customer) ?? ''),
  shipToPartner: readNumberFilter(params.get(URL_KEYS.shipToPartner) ?? ''),
  status: params.get(URL_KEYS.status) ?? '',
  inspection: readInspectionFilter(params.get(URL_KEYS.inspection) ?? ''),
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get('page') ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 조건 전체(기간·정렬 포함)를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * 첫 쪽이면 `page`를 적지 않는다. 정렬이 없으면 `sort`를 적지 않는다 — 「해제」한 상태를
 * 주소로 나타낼 방법이 그것뿐이다(W-01-07과 같은 규칙, `sort.ts` 참고).
 */
export const toSearchParams = (
  period: PeriodInput,
  filters: ShipmentFilters,
  sortKey: SortKey | null,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    ['shipDateFrom', period.from],
    ['shipDateTo', period.to],
    [URL_KEYS.customer, readNumberFilter(filters.customer)],
    [URL_KEYS.shipToPartner, readNumberFilter(filters.shipToPartner)],
    [URL_KEYS.status, filters.status],
    [URL_KEYS.inspection, readInspectionFilter(filters.inspection)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (page > 1) next.set('page', String(page));
  if (sortKey !== null) next.set('sort', sortKey);

  return next;
};

/** 계약이 쓰는 쿼리 이름. */
export interface ShipmentFilterQuery {
  customerId?: number;
  shipToPartnerId?: number;
  statusCode?: string;
  shippingInspectionRequired?: boolean;
}

export const toFilterQuery = (filters: ShipmentFilters): ShipmentFilterQuery => {
  const customer = readNumberFilter(filters.customer);
  const shipToPartner = readNumberFilter(filters.shipToPartner);

  return {
    ...(customer === '' ? {} : { customerId: Number(customer) }),
    ...(shipToPartner === '' ? {} : { shipToPartnerId: Number(shipToPartner) }),
    ...(filters.status === '' ? {} : { statusCode: filters.status }),
    ...(filters.inspection === ''
      ? {}
      : { shippingInspectionRequired: filters.inspection === 'true' }),
  };
};

export interface FilterChip {
  key: keyof ShipmentFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 넷이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 참조 조건의 표시 이름. **화면이 이름으로 풀어 넘긴다.**
 * 이 모듈이 번호를 문구로 바꾸지 않는 것이 내부 번호가 화면으로 새는 경로를 구조로 막는다.
 */
export interface FilterChipNames {
  customer: string;
  shipToPartner: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: ShipmentFilters, names: FilterChipNames): FilterChip[] => {
  const candidates: FilterChip[] = [
    {
      key: 'customer',
      label: t.filters.chipCustomer(names.customer),
      removeLabel: t.filters.chipRemoveCustomer,
    },
    {
      key: 'shipToPartner',
      label: t.filters.chipShipToPartner(names.shipToPartner),
      removeLabel: t.filters.chipRemoveShipToPartner,
    },
    {
      key: 'status',
      label: t.filters.chipStatus(filters.status),
      removeLabel: t.filters.chipRemoveStatus,
    },
    {
      key: 'inspection',
      label: t.filters.chipInspection(
        filters.inspection === 'true'
          ? t.filters.inspectionRequired
          : t.filters.inspectionNotRequired,
      ),
      removeLabel: t.filters.chipRemoveInspection,
    },
  ];

  return candidates.filter((chip) => filters[chip.key] !== '');
};

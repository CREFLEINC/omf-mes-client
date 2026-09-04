import type { paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { PeriodInput } from './period';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 값은 전부 문자열로 다룬다. 입력 도중의 상태를 숫자로 강제하면 지우는 중간에 값이 튄다.
 */

const t = messages.integrationSync;

export interface MessageFilters {
  status: string;
  iface: string;
  direction: string;
  targetType: string;
  /** 「N회 이상」. 정수만 뜻이 있다 — 문자열을 보내면 서버가 400으로 거부한다. */
  retryMin: string;
}

export const EMPTY_FILTERS: MessageFilters = {
  status: '',
  iface: '',
  direction: '',
  targetType: '',
  retryMin: '',
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS: Record<keyof MessageFilters, string> = {
  status: 'status',
  iface: 'iface',
  direction: 'dir',
  targetType: 'target',
  retryMin: 'retryMin',
};

const NON_NEGATIVE_INTEGER = /^\d+$/;

/** 정수가 아닌 시도 하한은 조건으로 받지 않는다. 그대로 보내면 조회 전체가 400으로 실패한다. */
const readRetryMin = (raw: string): string => (NON_NEGATIVE_INTEGER.test(raw) ? raw : '');

export const readFilters = (params: URLSearchParams): MessageFilters => ({
  status: params.get(URL_KEYS.status) ?? '',
  iface: params.get(URL_KEYS.iface) ?? '',
  direction: params.get(URL_KEYS.direction) ?? '',
  targetType: params.get(URL_KEYS.targetType) ?? '',
  retryMin: readRetryMin(params.get(URL_KEYS.retryMin) ?? ''),
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get('page') ?? '';

  return NON_NEGATIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * 첫 쪽이면 `page`를 적지 않는다. 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다.
 */
export const toSearchParams = (
  period: PeriodInput,
  filters: MessageFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams({ from: period.from, to: period.to });

  const entries: [string, string][] = [
    [URL_KEYS.status, filters.status],
    [URL_KEYS.iface, filters.iface],
    [URL_KEYS.direction, filters.direction],
    [URL_KEYS.targetType, filters.targetType],
    [URL_KEYS.retryMin, readRetryMin(filters.retryMin)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (page > 1) next.set('page', String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 시도 하한만 숫자로 보낸다 — 계약이 정수를 요구한다. */
type MessageQueryParams = NonNullable<paths['/integration/messages']['get']['parameters']['query']>;

export interface MessageFilterQuery {
  statusCode?: string;
  interfaceCode?: string;
  /** 계약이 방향을 두 값으로 닫았다(코드 사전 2026-09-03). 선택지는 서버 코드값이다 */
  directionCode?: MessageQueryParams['directionCode'];
  targetTypeCode?: string;
  retryCountMin?: number;
}

export const toFilterQuery = (filters: MessageFilters): MessageFilterQuery => {
  const retryMin = readRetryMin(filters.retryMin);

  return {
    ...(filters.status === '' ? {} : { statusCode: filters.status }),
    ...(filters.iface === '' ? {} : { interfaceCode: filters.iface }),
    ...(filters.direction === ''
      ? {}
      : { directionCode: filters.direction as MessageQueryParams['directionCode'] }),
    ...(filters.targetType === '' ? {} : { targetTypeCode: filters.targetType }),
    ...(retryMin === '' ? {} : { retryCountMin: Number(retryMin) }),
  };
};

export interface FilterChip {
  key: keyof MessageFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 다섯이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: MessageFilters): FilterChip[] => {
  const candidates: FilterChip[] = [
    {
      key: 'status',
      label: t.filters.chipStatus(filters.status),
      removeLabel: t.filters.chipRemoveStatus,
    },
    {
      key: 'iface',
      label: t.filters.chipInterface(filters.iface),
      removeLabel: t.filters.chipRemoveInterface,
    },
    {
      key: 'direction',
      label: t.filters.chipDirection(filters.direction),
      removeLabel: t.filters.chipRemoveDirection,
    },
    {
      key: 'targetType',
      label: t.filters.chipTargetType(filters.targetType),
      removeLabel: t.filters.chipRemoveTargetType,
    },
    {
      key: 'retryMin',
      label: t.filters.chipRetryMin(filters.retryMin),
      removeLabel: t.filters.chipRemoveRetryMin,
    },
  ];

  return candidates.filter((chip) => filters[chip.key] !== '');
};

export const hasAnyFilter = (filters: MessageFilters): boolean =>
  Object.values(filters).some((value) => value !== '');

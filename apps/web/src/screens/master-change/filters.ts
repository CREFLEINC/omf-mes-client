import type { paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { PeriodInput } from './period';

type EventQueryParams = NonNullable<paths['/audit/events']['get']['parameters']['query']>;

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 값은 전부 문자열로 다룬다. 입력 도중의 상태를 숫자로 강제하면 지우는 중간에 값이 튄다.
 */

const t = messages.masterChange;

export interface EventFilters {
  targetType: string;
  /** 대상 번호. 정수만 뜻이 있다 — 문자열을 보내면 서버가 400으로 거부한다. */
  targetId: string;
  eventType: string;
  /** 수행자 번호. 대상 번호와 같은 이유로 정수만 받는다. */
  performedBy: string;
  correlationId: string;
}

export const EMPTY_FILTERS: EventFilters = {
  targetType: '',
  targetId: '',
  eventType: '',
  performedBy: '',
  correlationId: '',
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS: Record<keyof EventFilters, string> = {
  targetType: 'type',
  targetId: 'target',
  eventType: 'event',
  performedBy: 'by',
  correlationId: 'corr',
};

const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 보내면 **조회 전체가 400으로 실패**해
 * 사용자에게는 「조회가 늘 안 된다」로만 보인다. 주소를 손으로 고친 경우가 이 자리다.
 */
const readNumberFilter = (raw: string): string => (NON_NEGATIVE_INTEGER.test(raw) ? raw : '');

export const readFilters = (params: URLSearchParams): EventFilters => ({
  targetType: params.get(URL_KEYS.targetType) ?? '',
  targetId: readNumberFilter(params.get(URL_KEYS.targetId) ?? ''),
  eventType: params.get(URL_KEYS.eventType) ?? '',
  performedBy: readNumberFilter(params.get(URL_KEYS.performedBy) ?? ''),
  correlationId: params.get(URL_KEYS.correlationId) ?? '',
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
 *
 * **`sel`(열린 창)을 만들지 않는다.** 조건·쪽이 바뀌면 그 건이 새 결과에 없을 수 있어
 * 창이 함께 닫혀야 하고, 여는 쪽만 이 결과에 `sel`을 덧붙인다.
 */
export const toSearchParams = (
  period: PeriodInput,
  filters: EventFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams({ from: period.from, to: period.to });

  const entries: [string, string][] = [
    [URL_KEYS.targetType, filters.targetType],
    [URL_KEYS.targetId, readNumberFilter(filters.targetId)],
    [URL_KEYS.eventType, filters.eventType],
    [URL_KEYS.performedBy, readNumberFilter(filters.performedBy)],
    [URL_KEYS.correlationId, filters.correlationId],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (page > 1) next.set('page', String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 두 번호만 숫자로 보낸다 — 계약이 정수를 요구한다. */
export interface EventFilterQuery {
  /** 대상 유형은 계약이 마스터 7종으로 닫았다(코드 사전 2026-09-03). 선택지는 서버 코드값이다 */
  targetTypeCode?: EventQueryParams['targetTypeCode'];
  targetId?: number;
  eventTypeCode?: string;
  performedBy?: number;
  correlationId?: string;
}

export const toFilterQuery = (filters: EventFilters): EventFilterQuery => {
  const targetId = readNumberFilter(filters.targetId);
  const performedBy = readNumberFilter(filters.performedBy);

  return {
    ...(filters.targetType === ''
      ? {}
      : { targetTypeCode: filters.targetType as EventQueryParams['targetTypeCode'] }),
    ...(targetId === '' ? {} : { targetId: Number(targetId) }),
    ...(filters.eventType === '' ? {} : { eventTypeCode: filters.eventType }),
    ...(performedBy === '' ? {} : { performedBy: Number(performedBy) }),
    ...(filters.correlationId === '' ? {} : { correlationId: filters.correlationId }),
  };
};

export interface FilterChip {
  key: keyof EventFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 다섯이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: EventFilters): FilterChip[] => {
  const candidates: FilterChip[] = [
    {
      key: 'targetType',
      label: t.filters.chipTargetType(filters.targetType),
      removeLabel: t.filters.chipRemoveTargetType,
    },
    {
      key: 'targetId',
      label: t.filters.chipTargetId(filters.targetId),
      removeLabel: t.filters.chipRemoveTargetId,
    },
    {
      key: 'eventType',
      label: t.filters.chipEventType(filters.eventType),
      removeLabel: t.filters.chipRemoveEventType,
    },
    {
      key: 'performedBy',
      label: t.filters.chipPerformedBy(filters.performedBy),
      removeLabel: t.filters.chipRemovePerformedBy,
    },
    {
      key: 'correlationId',
      label: t.filters.chipCorrelationId(filters.correlationId),
      removeLabel: t.filters.chipRemoveCorrelationId,
    },
  ];

  return candidates.filter((chip) => filters[chip.key] !== '');
};

export const hasAnyFilter = (filters: EventFilters): boolean =>
  Object.values(filters).some((value) => value !== '');

import type { components, paths } from '@omf-mes/api-client';

import {
  toTransitionPeriodBounds,
  validateTransitionPeriod,
} from '../lot-status-transition/period';

type LotQualityStatus = components['schemas']['LotQualityStatus'];
type LotStatusQuery = NonNullable<
  NonNullable<paths['/quality/lot-statuses']['get']>['parameters']['query']
>;

export interface SuspiciousMaterialFilters {
  q: string;
  itemId: string;
  warehouseId: string;
  lotStatusCode: string;
  /** 최종 변경일 기간(YYYY-MM-DD) — 둘 다 비우면 기간 없이 조회한다(사용자 2026-11-02). */
  from: string;
  to: string;
  /** 이미 전량 보류된 LOT 을 목록에서 뺀다(서버 excludeFullyHeld · 사용자 2026-11-02). */
  excludeFullyHeld: boolean;
}

export const EMPTY_SUSPICIOUS_MATERIAL_FILTERS: SuspiciousMaterialFilters = {
  q: '',
  itemId: '',
  warehouseId: '',
  lotStatusCode: '',
  from: '',
  to: '',
  /* 처음부터(초기화해도) 전량 보류 LOT 은 빼고 본다 — 고를 수 없는 줄이라(사용자 2026-11-02). */
  excludeFullyHeld: true,
};

/** 기간 검사 — 둘 다 비우면 기간 없이 조회해도 된다. 한쪽만 채웠거나 날짜가 틀렸으면 조회를 막는다. */
export const validateSuspiciousMaterialPeriod = (
  filters: Pick<SuspiciousMaterialFilters, 'from' | 'to'>,
): ReturnType<typeof validateTransitionPeriod> =>
  filters.from === '' && filters.to === '' ? null : validateTransitionPeriod(filters);

export interface SelectedLotSnapshot {
  lotId: number;
  lotNo: string;
  itemId: number;
  versionNo: number;
  warehouseId?: number;
  locationId?: number;
  onHandQty?: number;
  /** 보류 가능 수량(보유 − 이미 보류) — 일부 보류 상한(리뷰 2026-11-02). */
  availableQty?: number;
  uomId?: number;
  lotStatusCode: string;
  latestTransitionAt?: string;
  locationLabel?: string | null;
  uomLabel?: string | null;
}

export type SuspiciousMaterialCandidateResponse =
  | { kind: 'SUCCESS'; items: LotQualityStatus[] }
  | { kind: 'UNAVAILABLE'; reason: 'PENDING' | 'ERROR' | 'ABSENT' };

const positiveInteger = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const toSuspiciousMaterialQuery = (
  filters: SuspiciousMaterialFilters,
  page: number,
  /** 한 쪽 LOT 수 — 주지 않으면 서버 기본 크기다. */
  size?: number,
  /** 기간 경계의 시간대 — 브라우저 시간대(분). */
  offsetMinutes: number = -new Date().getTimezoneOffset(),
): LotStatusQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(positiveInteger(filters.itemId) === undefined
    ? {}
    : { itemId: positiveInteger(filters.itemId) }),
  ...(positiveInteger(filters.warehouseId) === undefined
    ? {}
    : { warehouseId: positiveInteger(filters.warehouseId) }),
  ...(filters.lotStatusCode === '' ? {} : { lotStatusCode: filters.lotStatusCode }),
  ...(filters.excludeFullyHeld ? { excludeFullyHeld: true } : {}),
  /* 최종 변경일 기간 — LOT 상태 변경 탭과 같은 경계(종료일은 다음 날 0시 · 반열림). */
  ...(filters.from !== '' && validateTransitionPeriod(filters) === null
    ? toTransitionPeriodBounds(filters, offsetMinutes)
    : {}),
  ...(Number.isSafeInteger(page) && page > 1 ? { page } : {}),
  ...(size === undefined ? {} : { size }),
});

export const toSelectedLotSnapshot = (row: LotQualityStatus): SelectedLotSnapshot | null => {
  const versionNo = row.versionNo;
  if (
    row.fullyHeld ||
    !Number.isSafeInteger(row.lotId) ||
    row.lotId <= 0 ||
    typeof versionNo !== 'number' ||
    !Number.isSafeInteger(versionNo) ||
    versionNo <= 0
  )
    return null;
  return {
    lotId: row.lotId,
    lotNo: row.lotNo,
    itemId: row.itemId,
    versionNo,
    warehouseId: row.warehouseId,
    locationId: row.locationId,
    onHandQty: row.onHandQty,
    availableQty: row.availableQty,
    uomId: row.uomId,
    lotStatusCode: row.lotStatusCode,
    latestTransitionAt: row.latestTransitionAt,
  };
};

export const reconcileSuspiciousMaterialSelection = (
  current: SelectedLotSnapshot[],
  response: SuspiciousMaterialCandidateResponse,
): SelectedLotSnapshot[] => {
  if (response.kind !== 'SUCCESS') return [];
  const latest = new Map(
    response.items.map((row) => [row.lotId, toSelectedLotSnapshot(row)] as const),
  );
  return current.flatMap((selected) => {
    const replacement = latest.get(selected.lotId);
    return replacement === null || replacement === undefined ? [] : [replacement];
  });
};

import { PAGE_SIZES, type PageSize } from '../../patterns/page-nav';
import type { Period } from './period';
import type { ReceiptLineQuery, ShipmentLineQuery } from './types';

/**
 * 기간별 이력의 구분 조건 칩. 자재 입고와 제품입고는 입고 줄 목록(`/logistics/goods-receipt-lines`), 제품 출하는 출하 줄
 * 목록이다. 칩 순서는 공정 흐름(자재 입고 → 투입 → 제품입고 → 포장 → 제품 출하)을 따른다.
 *
 * ⚠ 투입(`CONSUMED`)과 포장(`PACKED`)은 아직 없다. 기간으로 줄을 부르는 서버 목록이 없어서다 — 투입 목록
 * (`GET /production/material-consumptions`)은 기간 조건은 있으나 LOT 번호, 품목, W/O 번호 없이 번호만 주고, 포장
 * (`GET /inventory/handling-units`)은 기간도 LOT도 없다. 서버 목록이 들어오면 여기 순서 자리에 넣고, `rows.ts`에
 * 줄 바꾸개(`from...Line`)를, `queries.ts`의 `fetchMovementPage`와 건수에 갈래를 더한다. 상세(LotDetail)는 그대로 쓴다.
 */
export const KINDS = ['MATERIAL', 'PRODUCT', 'SHIPMENT'] as const;
export type MovementKind = (typeof KINDS)[number];

/** 조회 조건 — **주소가 정본이다.** 빈 조건은 키를 두지 않는다. */
export interface LotTraceFilters extends Period {
  kind: MovementKind;
  item: string;
  warehouse: string;
  /** 자재 입고의 공급사, 제품 출하의 고객. 제품입고에는 없다. */
  partner: string;
  status: string;
  page: number;
  size: PageSize;
}

export const DEFAULT_SIZE: PageSize = 50;

const POSITIVE = /^[1-9][0-9]*$/;
const STATUS = /^[A-Z_]{1,40}$/;

const positive = (raw: string | null): string => (raw !== null && POSITIVE.test(raw) ? raw : '');

export const hasPartnerFilter = (kind: MovementKind): boolean => kind !== 'PRODUCT';

export const readFilters = (params: URLSearchParams): LotTraceFilters => {
  const rawKind = params.get('kind');
  const kind = KINDS.find((value) => value === rawKind) ?? 'MATERIAL';
  const rawSize = Number(params.get('size'));
  const status = params.get('status') ?? '';
  return {
    kind,
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    item: positive(params.get('item')),
    warehouse: positive(params.get('wh')),
    partner: hasPartnerFilter(kind) ? positive(params.get('partner')) : '',
    status: STATUS.test(status) ? status : '',
    page: Number(positive(params.get('page')) || 1),
    size: PAGE_SIZES.find((size) => size === rawSize) ?? DEFAULT_SIZE,
  };
};

export const toSearchParams = (filters: LotTraceFilters): URLSearchParams => {
  const next = new URLSearchParams({ tab: 'movements' });
  if (filters.kind !== 'MATERIAL') next.set('kind', filters.kind);
  next.set('from', filters.from);
  if (filters.to !== '') next.set('to', filters.to);
  if (filters.item !== '') next.set('item', filters.item);
  if (filters.warehouse !== '') next.set('wh', filters.warehouse);
  if (filters.partner !== '' && hasPartnerFilter(filters.kind))
    next.set('partner', filters.partner);
  if (filters.status !== '') next.set('status', filters.status);
  if (filters.page > 1) next.set('page', String(filters.page));
  if (filters.size !== DEFAULT_SIZE) next.set('size', String(filters.size));
  return next;
};

/**
 * 구분을 바꾼다. 공급사와 고객, 상태는 구분마다 뜻(코드 사전)이 달라 비운다.
 * 그래서 다른 칩의 건수(공통 조건으로 센 값)가 바꾼 뒤 목록 건수와 같다(C-17).
 */
export const withKind = (filters: LotTraceFilters, kind: MovementKind): LotTraceFilters =>
  kind === filters.kind ? filters : { ...filters, kind, partner: '', status: '', page: 1 };

const optionalId = (value: string): number | undefined =>
  value === '' ? undefined : Number(value);

/** 기간, 품목, 창고 — 세 구분에 같은 뜻인 조건. 칩 건수가 이것만 건다. */
const commonQuery = (filters: LotTraceFilters) => ({
  ...(filters.item === '' ? {} : { itemId: optionalId(filters.item) }),
  ...(filters.warehouse === '' ? {} : { warehouseId: optionalId(filters.warehouse) }),
});

export const receiptQuery = (
  filters: LotTraceFilters,
  page: number,
  size: number,
): ReceiptLineQuery => ({
  receiptTypeCode: filters.kind,
  receiptDateFrom: filters.from,
  ...(filters.to === '' ? {} : { receiptDateTo: filters.to }),
  ...commonQuery(filters),
  ...(filters.partner === '' ? {} : { supplierId: optionalId(filters.partner) }),
  ...(filters.status === '' ? {} : { statusCode: filters.status }),
  page,
  size,
});

export const shipmentQuery = (
  filters: LotTraceFilters,
  page: number,
  size: number,
): ShipmentLineQuery => ({
  shipDateFrom: filters.from,
  ...(filters.to === '' ? {} : { shipDateTo: filters.to }),
  ...commonQuery(filters),
  ...(filters.partner === '' ? {} : { customerId: optionalId(filters.partner) }),
  ...(filters.status === '' ? {} : { statusCode: filters.status }),
  page,
  size,
});

/** 칩 건수용 — 공통 조건만, 한 줄만 받는다(합계는 필터 전체 기준이다). */
export const receiptCountQuery = (filters: LotTraceFilters): ReceiptLineQuery => ({
  receiptDateFrom: filters.from,
  ...(filters.to === '' ? {} : { receiptDateTo: filters.to }),
  ...commonQuery(filters),
  page: 1,
  size: 1,
});

export const shipmentCountQuery = (filters: LotTraceFilters): ShipmentLineQuery => ({
  shipDateFrom: filters.from,
  ...(filters.to === '' ? {} : { shipDateTo: filters.to }),
  ...commonQuery(filters),
  page: 1,
  size: 1,
});

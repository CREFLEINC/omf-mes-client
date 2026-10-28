import { PAGE_SIZES, type PageSize } from '../../patterns/page-nav';
import { validatePeriod, type Period } from './period';
import type {
  InputLineQuery,
  PackingLineQuery,
  ReceiptLineQuery,
  ShipmentLineQuery,
} from './types';

/**
 * 이력 줄의 구분. 칩 순서는 공정 흐름(자재 입고 → 투입 → 제품입고 → 포장 → 제품 출하)을 따른다.
 * 자재 입고와 제품입고는 입고 줄 목록(`/logistics/goods-receipt-lines`), 투입은 투입 줄 목록(`/trace/material-input-lines`),
 * 포장은 포장 줄 목록(`/trace/packing-lines`), 제품 출하는 출하 줄 목록(`/logistics/shipment-lines`)에서 온다.
 */
export const EVENT_KINDS = ['MATERIAL', 'CONSUMED', 'PRODUCT', 'PACKED', 'SHIPMENT'] as const;
export type MovementKind = (typeof EVENT_KINDS)[number];

/** 서버 목록이 있는 구분. 구분 하나를 잠시 뺄 때 `false`로 둔다(칩과 질의가 함께 빠진다). */
export const AVAILABLE: Readonly<Record<MovementKind, boolean>> = {
  MATERIAL: true,
  CONSUMED: true,
  PRODUCT: true,
  PACKED: true,
  SHIPMENT: true,
};

/** 구분 조건 칩. `ALL`은 전체(서버 목록이 있는 구분을 모두 모은다). */
export type KindFilter = 'ALL' | MovementKind;
export const KIND_FILTERS: readonly KindFilter[] = [
  'ALL',
  ...EVENT_KINDS.filter((kind) => AVAILABLE[kind]),
];

/** 조회 조건 — **주소가 정본이다.** 빈 조건은 키를 두지 않는다. */
export interface LotTraceFilters extends Period {
  kind: KindFilter;
  item: string;
  /** 자재 LOT 번호 전체 */
  materialLot: string;
  /** 제품(생산) LOT 번호 전체 */
  productLot: string;
  /** 입하번호 전체 */
  inbound: string;
  /** W/O 번호 전체 */
  workOrder: string;
  /** 출하번호 전체 */
  shipment: string;
  supplier: string;
  customer: string;
  page: number;
  size: PageSize;
}

export const DEFAULT_SIZE: PageSize = 50;

export const EMPTY_FILTERS: LotTraceFilters = {
  kind: 'ALL',
  from: '',
  to: '',
  item: '',
  materialLot: '',
  productLot: '',
  inbound: '',
  workOrder: '',
  shipment: '',
  supplier: '',
  customer: '',
  page: 1,
  size: DEFAULT_SIZE,
};

const POSITIVE = /^[1-9][0-9]*$/;
const positive = (raw: string | null): string => (raw !== null && POSITIVE.test(raw) ? raw : '');
const text = (raw: string | null): string => (raw ?? '').trim();

/** 주소 키. 화면 안 탭이 있던 때의 주소는 `migrateLegacyParams`가 이 키로 옮긴다. */
const KEYS = {
  kind: 'kind',
  item: 'item',
  materialLot: 'mlot',
  productLot: 'plot',
  inbound: 'ir',
  workOrder: 'wo',
  shipment: 'sh',
  supplier: 'sup',
  customer: 'cus',
} as const;

export const readFilters = (params: URLSearchParams): LotTraceFilters => {
  const rawKind = params.get(KEYS.kind);
  const rawSize = Number(params.get('size'));
  return {
    kind: KIND_FILTERS.find((kind) => kind === rawKind) ?? 'ALL',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    item: positive(params.get(KEYS.item)),
    materialLot: text(params.get(KEYS.materialLot)),
    productLot: text(params.get(KEYS.productLot)),
    inbound: text(params.get(KEYS.inbound)),
    workOrder: text(params.get(KEYS.workOrder)),
    shipment: text(params.get(KEYS.shipment)),
    supplier: positive(params.get(KEYS.supplier)),
    customer: positive(params.get(KEYS.customer)),
    page: Number(positive(params.get('page')) || 1),
    size: PAGE_SIZES.find((size) => size === rawSize) ?? DEFAULT_SIZE,
  };
};

export const toSearchParams = (filters: LotTraceFilters): URLSearchParams => {
  const next = new URLSearchParams();
  if (filters.kind !== 'ALL') next.set(KEYS.kind, filters.kind);
  if (filters.from !== '') next.set('from', filters.from);
  if (filters.to !== '') next.set('to', filters.to);
  for (const key of [
    'item',
    'materialLot',
    'productLot',
    'inbound',
    'workOrder',
    'shipment',
    'supplier',
    'customer',
  ] as const) {
    if (filters[key] !== '') next.set(KEYS[key], filters[key]);
  }
  if (filters.page > 1) next.set('page', String(filters.page));
  if (filters.size !== DEFAULT_SIZE) next.set('size', String(filters.size));
  return next;
};

/** 화면 안 탭이 있던 때의 주소 값. */
const LEGACY_TABS = ['forward', 'backward', 'movements'];

/**
 * 탭이 있던 때의 주소(`tab=forward|backward|movements`)를 지금 조건으로 옮긴다. 다른 화면이나 저장된 링크가 그 주소로
 * 와도 같은 LOT이 열린다. 옮길 것이 없으면 `null`. 고른 LOT(`selected`), 지나온 경로(`via`), 쪽은 그대로 둔다.
 * 창고와 상태 조건은 더 이상 없어 버린다.
 */
export const migrateLegacyParams = (params: URLSearchParams): URLSearchParams | null => {
  const tab = params.get('tab');
  if (tab === null || !LEGACY_TABS.includes(tab)) return null;
  const next = new URLSearchParams();
  const copy = (from: string, to: string) => {
    const value = params.get(from);
    if (value !== null && value !== '') next.set(to, value);
  };
  copy('from', 'from');
  copy('to', 'to');
  copy('item', KEYS.item);
  if (tab === 'forward') {
    copy('lot', KEYS.materialLot);
    copy('q', KEYS.materialLot);
    copy('ir', KEYS.inbound);
    copy('partner', KEYS.supplier);
  } else if (tab === 'backward') {
    copy('lot', KEYS.productLot);
    copy('q', KEYS.productLot);
    copy('sh', KEYS.shipment);
    copy('wo', KEYS.workOrder);
    copy('partner', KEYS.customer);
  } else {
    const kind = params.get('kind');
    if (kind === 'PRODUCT' || kind === 'SHIPMENT') next.set(KEYS.kind, kind);
    else next.set(KEYS.kind, 'MATERIAL');
    copy('partner', kind === 'SHIPMENT' ? KEYS.customer : KEYS.supplier);
  }
  copy('selected', 'selected');
  for (const step of params.getAll('via')) next.append('via', step);
  copy('page', 'page');
  copy('size', 'size');
  return next;
};

/** 번호로 하나를 집는 조건(LOT 번호, 입하번호, W/O 번호, 출하번호)이 있는가. */
export const hasNumberCondition = (filters: LotTraceFilters): boolean =>
  [
    filters.materialLot,
    filters.productLot,
    filters.inbound,
    filters.workOrder,
    filters.shipment,
  ].some((value) => value !== '');

/** 구분 칩을 바꾼다. 쪽은 1로. */
export const withKind = (filters: LotTraceFilters, kind: KindFilter): LotTraceFilters =>
  kind === filters.kind ? filters : { ...filters, kind, page: 1 };

/** 줄 목록에 보내는 고정 번호와 상대 조건. 번호가 하나라도 있으면 기간은 선택이다(서버 규칙). */
export interface SourcePart {
  lotNo?: string;
  inboundReceiptNo?: string;
  workOrderNo?: string;
  shipmentNo?: string;
  supplierId?: number;
  customerId?: number;
}

/**
 * 한 구분의 줄 목록이 이 조건을 다 걸 수 있는가, 걸 수 있으면 그 질의 일부. 걸 수 없는 조건이 있으면 그 구분은 뺀다
 * (빼지 않으면 조건과 관계없는 줄이 섞인다). 자재 LOT 번호는 자재 입고와 투입, 제품 LOT 번호는 제품입고, 포장, 출하에
 * 건다. W/O 번호는 투입, 제품입고, 포장, 출하에 건다(자재 입고는 W/O와 이어지지 않는다).
 */
export const sourceQuery = (kind: MovementKind, filters: LotTraceFilters): SourcePart | null => {
  if (!AVAILABLE[kind]) return null;
  const { materialLot, productLot, inbound, workOrder, shipment, supplier, customer } = filters;
  const material = kind === 'MATERIAL' || kind === 'CONSUMED';
  const id = (value: string) => Number(value);
  if (material) {
    if (productLot !== '' || shipment !== '' || customer !== '') return null;
    if (kind === 'MATERIAL' && workOrder !== '') return null;
    return {
      ...(materialLot === '' ? {} : { lotNo: materialLot }),
      ...(inbound === '' ? {} : { inboundReceiptNo: inbound }),
      ...(kind === 'CONSUMED' && workOrder !== '' ? { workOrderNo: workOrder } : {}),
      ...(supplier === '' ? {} : { supplierId: id(supplier) }),
    };
  }
  if (materialLot !== '' || inbound !== '' || supplier !== '') return null;
  if (kind === 'PRODUCT' && (shipment !== '' || customer !== '')) return null;
  return {
    ...(productLot === '' ? {} : { lotNo: productLot }),
    ...(workOrder === '' ? {} : { workOrderNo: workOrder }),
    ...(kind !== 'PRODUCT' && shipment !== '' ? { shipmentNo: shipment } : {}),
    ...(kind !== 'PRODUCT' && customer !== '' ? { customerId: id(customer) } : {}),
  };
};

/** 조회할 수 있으면 `null`, 아니면 기간 칸 사유. 번호 조건이 있으면 기간은 선택이다. */
export const periodReasonOf = (filters: LotTraceFilters): string | null =>
  filters.from === '' && filters.to === '' && hasNumberCondition(filters)
    ? null
    : validatePeriod(filters);

const itemQuery = (filters: LotTraceFilters) =>
  filters.item === '' ? {} : { itemId: Number(filters.item) };

const range = (fromKey: string, toKey: string, filters: LotTraceFilters) => ({
  ...(filters.from === '' ? {} : { [fromKey]: filters.from }),
  ...(filters.to === '' ? {} : { [toKey]: filters.to }),
});

export const receiptQuery = (
  kind: 'MATERIAL' | 'PRODUCT',
  filters: LotTraceFilters,
  part: SourcePart,
  page: number,
  size: number,
): ReceiptLineQuery => ({
  receiptTypeCode: kind,
  ...range('receiptDateFrom', 'receiptDateTo', filters),
  ...itemQuery(filters),
  ...part,
  page,
  size,
});

export const inputQuery = (
  filters: LotTraceFilters,
  part: SourcePart,
  page: number,
  size: number,
): InputLineQuery => ({
  ...range('inputDateFrom', 'inputDateTo', filters),
  ...itemQuery(filters),
  ...part,
  page,
  size,
});

export const packingQuery = (
  filters: LotTraceFilters,
  part: SourcePart,
  page: number,
  size: number,
): PackingLineQuery => ({
  ...range('packedDateFrom', 'packedDateTo', filters),
  ...itemQuery(filters),
  ...part,
  page,
  size,
});

export const shipmentQuery = (
  filters: LotTraceFilters,
  part: SourcePart,
  page: number,
  size: number,
): ShipmentLineQuery => ({
  ...range('shipDateFrom', 'shipDateTo', filters),
  ...itemQuery(filters),
  ...part,
  page,
  size,
});

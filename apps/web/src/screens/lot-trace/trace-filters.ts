import { PAGE_SIZES, type PageSize } from '../../patterns/page-nav';
import { DEFAULT_SIZE } from './filters';
import { validatePeriod, type Period } from './period';
import type { BackwardListQuery, ForwardListQuery, ForwardStage } from './trace-types';

/**
 * 화면 안 탭. 탭은 무엇으로 찾는지만 고른다(자재 LOT, 제품 LOT, 입출고 현황). 주소 값은 서버 목록 이름을 따라
 * `forward`(자재 LOT 목록), `backward`(제품 LOT 목록)이다. 처음 열면 자재 LOT. 마지막 탭과 조건은 주소에 남긴다.
 */
export const TABS = ['forward', 'backward', 'movements'] as const;
export type TraceTab = (typeof TABS)[number];
export type TraceDirection = 'forward' | 'backward';

export const readTab = (params: URLSearchParams): TraceTab =>
  TABS.find((tab) => tab === params.get('tab')) ?? 'forward';

export const FORWARD_STAGES = [
  'RECEIVED',
  'CONSUMED',
  'PRODUCED',
  'PRODUCTION_RECEIVED',
  'PACKED',
  'SHIPPED',
] as const satisfies readonly ForwardStage[];
export const BACKWARD_STAGES = ['PRODUCED', 'PRODUCTION_RECEIVED', 'PACKED', 'SHIPPED'] as const;

export const stagesOf = (direction: TraceDirection): readonly ForwardStage[] =>
  direction === 'forward' ? FORWARD_STAGES : BACKWARD_STAGES;

export type DateAxis = 'PRODUCED' | 'SHIPPED';

/** 정방향, 역방향 조회 조건 — **주소가 정본이다.** 빈 조건은 키를 두지 않는다. */
export interface TraceFilters extends Period {
  /** LOT 번호 일부(`q`). 조건 칸에서 기간과 함께 찾을 때 */
  q: string;
  /** LOT 번호 정확 일치(`lotNo`). 조건 칸에서 기간 없이 찾을 때, 다른 탭이나 화면에서 넘어올 때 */
  lot: string;
  item: string;
  /** 정방향: 입하번호 */
  inbound: string;
  /** 역방향: 출하번호 */
  shipment: string;
  /** 역방향: W/O 번호 */
  workOrder: string;
  axis: DateAxis;
  /** 정방향 공급사, 역방향 고객 */
  partner: string;
  /** 정방향만: 입고 창고 */
  warehouse: string;
  stage: string;
  page: number;
  size: PageSize;
}

/** 지나온 LOT 하나. 상세에서 [보기]로 다른 LOT을 가운데 두면 쌓이고, 상세 머리 위 경로 줄이 이것으로 그려진다. */
export interface PathStep {
  lotType: 'MATERIAL' | 'PRODUCTION';
  lotId: number;
  lotNo: string;
}

const POSITIVE = /^[1-9][0-9]*$/;
const positive = (raw: string | null): string => (raw !== null && POSITIVE.test(raw) ? raw : '');
const text = (raw: string | null): string => (raw ?? '').trim();

export const readTraceFilters = (
  direction: TraceDirection,
  params: URLSearchParams,
): TraceFilters => {
  const stage = params.get('stage') ?? '';
  const rawSize = Number(params.get('size'));
  return {
    q: text(params.get('q')),
    lot: text(params.get('lot')),
    item: positive(params.get('item')),
    inbound: direction === 'forward' ? text(params.get('ir')) : '',
    shipment: direction === 'backward' ? text(params.get('sh')) : '',
    workOrder: direction === 'backward' ? text(params.get('wo')) : '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    axis: direction === 'backward' && params.get('axis') === 'SHIPPED' ? 'SHIPPED' : 'PRODUCED',
    partner: positive(params.get('partner')),
    warehouse: direction === 'forward' ? positive(params.get('wh')) : '',
    stage: (stagesOf(direction) as readonly string[]).includes(stage) ? stage : '',
    page: Number(positive(params.get('page')) || 1),
    size: PAGE_SIZES.find((size) => size === rawSize) ?? DEFAULT_SIZE,
  };
};

export const readTraceSelected = (params: URLSearchParams): number | null => {
  const raw = params.get('selected');
  return raw !== null && POSITIVE.test(raw) ? Number(raw) : null;
};

/**
 * [보기]로 `next`를 가운데 둘 때의 경로. 이미 지나온 LOT이면 그 자리까지 되돌려 경로가 돌며 늘지 않게 한다
 * (자재 → 생산 → 같은 자재). 아니면 지금 LOT(`here`)을 끝에 붙인다.
 */
export const pathTo = (path: readonly PathStep[], here: PathStep, next: PathStep): PathStep[] => {
  const index = path.findIndex((step) => step.lotId === next.lotId);
  return index >= 0 ? path.slice(0, index) : [...path, here];
};

const STEP_SEPARATOR = '~';

/** 지나온 경로. 가운데 LOT(`selected`)이 없으면 경로도 뜻이 없어 비운다. 깨진 단계는 버린다. */
export const readPath = (params: URLSearchParams): PathStep[] =>
  readTraceSelected(params) === null
    ? []
    : params.getAll('via').flatMap((raw) => {
        const [type, id, ...rest] = raw.split(STEP_SEPARATOR);
        const lotNo = rest.join(STEP_SEPARATOR);
        if (type !== 'M' && type !== 'P') return [];
        if (id === undefined || !POSITIVE.test(id) || lotNo === '') return [];
        return [
          {
            lotType: type === 'M' ? 'MATERIAL' : 'PRODUCTION',
            lotId: Number(id),
            lotNo,
          } satisfies PathStep,
        ];
      });

const writeStep = (step: PathStep): string =>
  [step.lotType === 'MATERIAL' ? 'M' : 'P', String(step.lotId), step.lotNo].join(STEP_SEPARATOR);

export const toTraceSearchParams = (
  direction: TraceDirection,
  filters: TraceFilters,
  selected: number | null = null,
  path: readonly PathStep[] = [],
): URLSearchParams => {
  const next = new URLSearchParams();
  if (direction === 'backward') next.set('tab', 'backward');
  const put = (key: string, value: string) => {
    if (value !== '') next.set(key, value);
  };
  put('q', filters.q);
  put('lot', filters.lot);
  put('item', filters.item);
  if (direction === 'forward') put('ir', filters.inbound);
  if (direction === 'backward') {
    put('sh', filters.shipment);
    put('wo', filters.workOrder);
  }
  put('from', filters.from);
  put('to', filters.to);
  if (direction === 'backward' && filters.axis === 'SHIPPED') next.set('axis', 'SHIPPED');
  put('partner', filters.partner);
  if (direction === 'forward') put('wh', filters.warehouse);
  put('stage', filters.stage);
  if (filters.page > 1) next.set('page', String(filters.page));
  if (filters.size !== DEFAULT_SIZE) next.set('size', String(filters.size));
  if (selected !== null) next.set('selected', String(selected));
  for (const step of path) next.append('via', writeStep(step));
  return next;
};

export const EMPTY_TRACE_FILTERS: TraceFilters = {
  q: '',
  lot: '',
  item: '',
  inbound: '',
  shipment: '',
  workOrder: '',
  from: '',
  to: '',
  axis: 'PRODUCED',
  partner: '',
  warehouse: '',
  stage: '',
  page: 1,
  size: DEFAULT_SIZE,
};

/** 정확 일치 진입점(LOT 번호, 입하번호, 출하번호, W/O 번호)으로 집으면 기간은 선택이다(계약). */
export const hasExactEntry = (filters: TraceFilters): boolean =>
  [filters.lot, filters.inbound, filters.shipment, filters.workOrder].some((value) => value !== '');

/** 조회할 수 있으면 `null`, 아니면 기간 칸 아래 사유. 기간만으로 조회하고, 정확 일치 번호가 있으면 기간은 선택이다. */
export const tracePeriodReason = (filters: TraceFilters): string | null =>
  filters.from === '' && filters.to === '' && hasExactEntry(filters)
    ? null
    : validatePeriod(filters);

const stageQuery = <S extends string>(stage: string): { currentStageCode?: S[] } =>
  stage === '' ? {} : { currentStageCode: [stage as S] };

const optionalNumber = (value: string): number | undefined =>
  value === '' ? undefined : Number(value);

export const forwardQuery = (
  filters: TraceFilters,
  page: number,
  size: number,
): ForwardListQuery => ({
  ...(filters.item === '' ? {} : { itemId: optionalNumber(filters.item) }),
  ...(filters.lot === '' ? {} : { lotNo: filters.lot }),
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.inbound === '' ? {} : { inboundReceiptNo: filters.inbound }),
  ...(filters.from === '' ? {} : { receiptDateFrom: filters.from }),
  ...(filters.to === '' ? {} : { receiptDateTo: filters.to }),
  ...(filters.partner === '' ? {} : { supplierId: optionalNumber(filters.partner) }),
  ...(filters.warehouse === '' ? {} : { warehouseId: optionalNumber(filters.warehouse) }),
  ...stageQuery<NonNullable<ForwardListQuery['currentStageCode']>[number]>(filters.stage),
  page,
  size,
});

export const backwardQuery = (
  filters: TraceFilters,
  page: number,
  size: number,
): BackwardListQuery => ({
  ...(filters.item === '' ? {} : { itemId: optionalNumber(filters.item) }),
  ...(filters.lot === '' ? {} : { lotNo: filters.lot }),
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.shipment === '' ? {} : { shipmentNo: filters.shipment }),
  ...(filters.workOrder === '' ? {} : { workOrderNo: filters.workOrder }),
  ...(filters.from === '' && filters.to === '' ? {} : { dateAxis: filters.axis }),
  ...(filters.from === '' ? {} : { dateFrom: filters.from }),
  ...(filters.to === '' ? {} : { dateTo: filters.to }),
  ...(filters.partner === '' ? {} : { customerId: optionalNumber(filters.partner) }),
  ...stageQuery<NonNullable<BackwardListQuery['currentStageCode']>[number]>(filters.stage),
  page,
  size,
});

/**
 * 다른 탭이나 화면에서 한 LOT을 여는 주소. 정확 일치(`lot`)로 집고 기간은 비운다(계약상 선택).
 * 지나온 경로(`path`)를 함께 넘기면 상세 머리 위 경로 줄에 남는다.
 */
export const openLotParams = (
  direction: TraceDirection,
  lot: { lotId: number; lotNo: string },
  path: readonly PathStep[] = [],
): URLSearchParams =>
  toTraceSearchParams(direction, { ...EMPTY_TRACE_FILTERS, lot: lot.lotNo }, lot.lotId, path);

/** 출하 한 건의 LOT 전부를 제품 LOT 탭으로 연다(입출고 현황의 제품 출고 줄). */
export const openShipmentParams = (shipmentNo: string, onlyLotId: number | null): URLSearchParams =>
  toTraceSearchParams('backward', { ...EMPTY_TRACE_FILTERS, shipment: shipmentNo }, onlyLotId);

/** LOT 생산 이력 조회 화면 주소. 다른 화면(W-03-01 LOT 상세)이 한 LOT의 추적을 열 때 쓴다. */
export const LOT_TRACE_PATH = '/production/lot-trace';

/** 한 LOT의 추적을 여는 주소. 자재 LOT은 자재 LOT 탭, 그 밖의 LOT(생산, 제품)은 제품 LOT 탭이다. */
export const lotTraceHref = (lot: { lotId: number; lotNo: string; lotTypeCode: string }): string =>
  `${LOT_TRACE_PATH}?${openLotParams(lot.lotTypeCode === 'MATERIAL' ? 'forward' : 'backward', lot).toString()}`;

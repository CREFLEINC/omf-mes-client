/*
 * 005 C-K4 덧댐 — W-01-09 입고 관리(§12), 재고 현황 · LOT 이력 · LOT 현황 입하 LOT 칸(§13).
 * 서버 병합 뒤 `gen:api` 로 다시 만들고 이 파일을 걷는다(T111). 계약에 적히지 않아 화면이 정한 칸은 「(C5 정함)」 · 「(C6 정함)」.
 *
 * 칸 모양은 서버 S7f 계약(`logistics-01자재창고.json` · `quality-03품질.json`)을 그대로 옮겼다 — 지어낸 칸은 없다.
 */
import type { Json, MaterialPackage } from './forward-contract';
import type { components, paths } from './generated/api';

/** 입하 LOT 조건 — `inboundLotId`(정확) · `inboundLotNo`(번호 정확 일치). 계약 §13. */
export interface InboundLotFilterQuery {
  inboundLotId?: number;
  inboundLotNo?: string;
}

/** 행에 실리는 입하 LOT — 입하 LOT 이 없는 LOT(생산 · 재생 등)은 둘 다 null, 이전 데이터는 `IL-MIG-…`. */
export interface InboundLotColumns {
  inboundLotId: number | null;
  inboundLotNo: string | null;
}

/** 입하 중(RECEIVING) 입하 LOT 요약 — P/O 라인 목록 `receivingInboundLots[]`(계약 §12 · G1 · 서버 S7f). */
export interface ReceivingInboundLot {
  inboundLotId: number;
  /** `IL-YYYYMMDD-NNNN` */
  inboundLotNo: string;
  /** 지금까지 받은 양(품목 기본 단위 — P/O 라인 단위와 다를 수 있다). */
  receivedQty: number;
}

/** P/O 라인 목록 한 행 — 같은 공장 · 공급사 · 품목의 입하 중 입하 LOT(0~1건)을 더한다. */
export type PurchaseOrderLineListItemForward =
  components['schemas']['PurchaseOrderLineListItem'] & {
    receivingInboundLots: ReceivingInboundLot[];
  };

/** 입고 관리 허브의 LOT 한 줄 — 자재 관리 LOT 의 입하 LOT · 패키징(계약 §12). 라벨 대기 줄은 셋 다 null. */
export type InboundLotProgressForward = components['schemas']['InboundLotProgress'] &
  InboundLotColumns & {
    package: MaterialPackage | null;
  };

/** 재고 잔액 한 줄 — `groupBy=LOT` 줄에만 입하 LOT 칸이 실린다(다른 묶음 방식에는 칸 없음). */
export type InventoryBalanceForward = components['schemas']['InventoryBalance'] &
  Partial<InboundLotColumns>;

/** LOT 품질 상태 한 줄(W-03-01) — 입하 LOT 칸을 더한다. */
export type LotQualityStatusForward = components['schemas']['LotQualityStatus'] & InboundLotColumns;

type GetOf<P extends keyof paths> = NonNullable<paths[P]['get']>;
type QueryOf<P extends keyof paths> = NonNullable<GetOf<P>['parameters']['query']>;
type BodyOf<P extends keyof paths> = GetOf<P>['responses'] extends {
  200: { content: { 'application/json': infer B } };
}
  ? B
  : never;
type ItemOf<P extends keyof paths> = BodyOf<P> extends { items: (infer I)[] } ? I : never;

/** 목록 응답의 `items` 한 줄에 칸을 더한다. 나머지(page · totals · summary)는 생성 타입 그대로. */
type WithItems<P extends keyof paths, Item> = Omit<BodyOf<P>, 'items'> & { items: Item[] };

/** 생성 경로의 조회 하나를 덮는다 — 질의에 `Q` 를 더하고 200 응답을 `R` 로. 다른 메서드 · 응답은 그대로다. */
type OverrideGet<P extends keyof paths, Q, R> = Omit<paths[P], 'get'> & {
  get: Omit<GetOf<P>, 'parameters' | 'responses'> & {
    parameters: Omit<GetOf<P>['parameters'], 'query'> & { query?: QueryOf<P> & Q };
    responses: Omit<GetOf<P>['responses'], 200> & { 200: Json<R> };
  };
};

export interface ForwardPaths005Inventory {
  /** §12 — P/O 라인 행에 입하 중 입하 LOT(`receivingInboundLots`). */
  '/logistics/purchase-order-lines': OverrideGet<
    '/logistics/purchase-order-lines',
    unknown,
    WithItems<'/logistics/purchase-order-lines', PurchaseOrderLineListItemForward>
  >;
  /** §12 — LOT 진행 행에 `inboundLotId` · `inboundLotNo` · `package`. */
  '/logistics/purchase-orders/{purchaseOrderId}/inbound-progress': OverrideGet<
    '/logistics/purchase-orders/{purchaseOrderId}/inbound-progress',
    unknown,
    WithItems<
      '/logistics/purchase-orders/{purchaseOrderId}/inbound-progress',
      InboundLotProgressForward
    >
  >;
  /** §13 W-01-07 — 입하 LOT 조건은 범위 조건(창고 · 품목 · LOT 중 하나)으로 인정된다. */
  '/inventory/balances': OverrideGet<
    '/inventory/balances',
    InboundLotFilterQuery,
    WithItems<'/inventory/balances', InventoryBalanceForward>
  >;
  /** §13 W-02-09 「자재 입고」 — 입하 LOT 조건은 기본 기간을 풀어 준다. */
  '/logistics/goods-receipt-lines': OverrideGet<
    '/logistics/goods-receipt-lines',
    InboundLotFilterQuery,
    WithItems<
      '/logistics/goods-receipt-lines',
      ItemOf<'/logistics/goods-receipt-lines'> & InboundLotColumns
    >
  >;
  /** §13 W-02-09 「투입」 — 같은 두 조건 · 기본 기간을 풀어 준다. */
  '/trace/material-input-lines': OverrideGet<
    '/trace/material-input-lines',
    InboundLotFilterQuery,
    WithItems<
      '/trace/material-input-lines',
      ItemOf<'/trace/material-input-lines'> & InboundLotColumns
    >
  >;
  /** §13 W-03-01 — 목록 행에 입하 LOT, 조건 둘. */
  '/quality/lot-statuses': OverrideGet<
    '/quality/lot-statuses',
    InboundLotFilterQuery,
    WithItems<'/quality/lot-statuses', LotQualityStatusForward>
  >;
  /** §13 W-03-01 — 요약은 목록과 같은 WHERE(조건만 더한다). */
  '/quality/lot-status-summary': OverrideGet<
    '/quality/lot-status-summary',
    InboundLotFilterQuery,
    BodyOf<'/quality/lot-status-summary'>
  >;
}

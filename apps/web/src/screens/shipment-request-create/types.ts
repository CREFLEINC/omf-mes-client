import type { components } from '@omf-mes/api-client';

/**
 * W-04-01 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * `shipment-schedule`·`product-stock-status`도 `ShipmentRequest`·`SalesOrder`를 다루지만
 * 형태가 같아도 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type SalesOrderResponse = components['schemas']['SalesOrder'];
type SalesOrderLineResponse = components['schemas']['SalesOrderLine'];
type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];
export type ShipmentRequestCreate = components['schemas']['ShipmentRequestCreate'];
export type ShipmentRequestLineCreate = components['schemas']['ShipmentRequestLineCreate'];

export type PageMeta = components['schemas']['PageMeta'];

/** 좌측 목록 한 줄. `lines`는 목록 응답에 실리지 않는다 — 상세(`GET .../{id}`)에서만 온다. */
export interface SalesOrderView {
  salesOrderId: number;
  salesOrderNo: string;
  customerId: number;
  shipToPartnerId: number;
  orderDate: string;
  /** 값으로 분기하지 않고 그대로 보인다(공유계약 G-2 · omf-mes#145 값 목록 미정) */
  statusCode: string;
}

export const toSalesOrderView = (data: SalesOrderResponse): SalesOrderView => ({
  salesOrderId: data.salesOrderId,
  salesOrderNo: data.salesOrderNo,
  customerId: data.customerId,
  shipToPartnerId: data.shipToPartnerId,
  orderDate: data.orderDate,
  statusCode: data.statusCode,
});

export interface SalesOrderListResult {
  items: SalesOrderView[];
  page: PageMeta;
}

/** 지시서 라인 — 잔여 라인을 뽑는 데 필요한 값만 옮긴다(`line-draft.ts`가 소비한다). */
export interface SalesOrderLineView {
  salesOrderLineId: number;
  itemId: number;
  orderedQty: number;
  uomId: number;
  /** 누적 출하 수량. 서버가 유지한다 — 화면이 다시 세지 않는다(공유계약 L-2) */
  shippedQty: number;
}

const toSalesOrderLineView = (data: SalesOrderLineResponse): SalesOrderLineView => ({
  salesOrderLineId: data.salesOrderLineId,
  itemId: data.itemId,
  orderedQty: data.orderedQty,
  uomId: data.uomId,
  shippedQty: data.shippedQty,
});

/** 지시서 상세 — 편성 폼이 승계 원천으로 쓴다. */
export interface SalesOrderDetailView {
  salesOrderId: number;
  salesOrderNo: string;
  customerId: number;
  shipToPartnerId: number;
  lines: SalesOrderLineView[];
}

export const toSalesOrderDetailView = (data: SalesOrderResponse): SalesOrderDetailView => ({
  salesOrderId: data.salesOrderId,
  salesOrderNo: data.salesOrderNo,
  customerId: data.customerId,
  shipToPartnerId: data.shipToPartnerId,
  lines: (data.lines ?? []).map(toSalesOrderLineView),
});

/**
 * 편성 모드 — **지시서 경유**(고객·납품처 잠김, 라인 고정) 또는 **단독 생성**(전부 직접 입력).
 * `salesOrderId`를 비우면 단독 생성이다(계약 설명 · 계획서 「확정된 것」).
 */
export type AssignmentMode = 'fromOrder' | 'standalone';

/**
 * 출하작업지시 라인 초안 — 아직 보내지 않은 입력이다.
 *
 * **친 글자를 그대로 들고 있는다.** 숫자로 강제해 들고 있으면 지우는 도중에 값이 튄다
 * (전례 `stock-adjust`·`po-register`의 라인 초안과 같은 규율).
 *
 * **`requestedQty`는 지시서 경유 라인에서만 자동 채워지고 읽기 전용이다** — 미결 항목 표의
 * 구현 판단(요청 수량 편집 가능 여부). 단독 생성 줄은 사용자가 입력한다.
 */
export interface ShipmentRequestLineDraft {
  /** 안정 키. 서버로 나가지 않는다 — 표의 `getRowId`가 쓴다 */
  key: string;
  /** 지시서 경유 라인의 원본 라인. 단독 생성 줄은 `null` */
  salesOrderLineId: number | null;
  itemId: string;
  requestedQty: string;
  allocatedQty: string;
  uomId: string;
  customerLotRequirement: string;
  shippingInspectionRequired: boolean;
  minimumRemainingShelfLifeDays: string;
}

/** 방금 만든 편성 — 결과 안내 구획이 그리는 것 전부다. */
export interface CreatedShipmentRequestView {
  shipmentRequestNo: string;
  /** 서버가 준 글자 그대로(공유계약 G-2) — 「완료」로 옮겨 적지 않는다 */
  statusCode: string;
  lineCount: number;
}

export const toCreatedShipmentRequestView = (
  data: ShipmentRequestResponse,
): CreatedShipmentRequestView => ({
  shipmentRequestNo: data.shipmentRequestNo,
  statusCode: data.statusCode,
  lineCount: data.lines?.length ?? 0,
});

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

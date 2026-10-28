import type { PageMeta } from './types';

/**
 * 입하 초과분 발주 연결의 모양 — **서버 장부 P-115(입하 ↔ P/O 배정)를 손으로 옮긴다.**
 *
 * 세 경로(`/logistics/inbound-unallocated` 목록 · `…/inbound-receipt-lines/{id}/allocation-candidates` 후보 ·
 * `POST …/allocations` 연결)는 계약 사본 밖이라 생성 타입에 없다. 서버
 * `src/logistics/inbound-receipt/inbound-allocation-view.ts` 의 `UnallocatedLineView`·`InboundAllocationView`·
 * `AllocationCandidateView` 와 같다. 계약 사본에 실리면 이 파일을 지우고 생성 타입을 쓴다.
 *
 * **초과분**은 입하 줄 하나 중 어느 P/O 라인에도 넣지 않은 몫이다(서버 「미배정」 `unallocatedQty` = 받은 수량 − 배정 합).
 * ERP 가 추가 P/O 를 만들면 그 P/O 라인에 사람이 연결한다(서버 「배정」) — 서버가 후보를 제안하고 사람이 확정한다
 * (사용자 결정 2026-10-21). 연결 전에도 그 수량은 재고로 쓴다(LOT 은 줄 전체 수량이다).
 *
 * 연결 해제(`DELETE …/allocations/{id}`)는 아직 화면에 없다 — 「연결한 초과분」 목록 경로가 서버에 없어 해제할 자리를
 * 정하지 못했다(사용자 결정 2026-10-27 「해제는 나중에」).
 */

/** P/O 라인 한 줄을 가리키는 값. 사람에게는 발주번호와 줄번호만 보인다. */
export interface OrderLineRef {
  purchaseOrderLineId: number;
  purchaseOrderId: number;
  purchaseOrderNo: string;
  erpPurchaseOrderNo: string | null;
  lineNo: number;
}

/** 입하 줄의 P/O 배정 한 몫 — 어느 P/O 라인에 얼마를, 언제. */
export interface InboundAllocation {
  inboundReceiptPoAllocationId: number;
  inboundReceiptLineId: number;
  allocatedQty: number;
  allocatedAt: string;
  orderLine: OrderLineRef;
}

/** 초과분이 남은 입하 줄 — 무엇이 얼마나 남았고 어디에 얼마나 들어갔나. */
export interface UnallocatedLine {
  inboundReceiptLineId: number;
  lineNo: number;
  inboundReceiptId: number;
  inboundReceiptNo: string;
  receiptDatetime: string;
  /** 입하 예외 유형(공통 코드 `INBOUND_RECEIPT_EXCEPTION_TYPE`). 고객사급 · 무상샘플은 서버가 빼고 준다(`NO_ORDER_EXCEPTION_TYPES`). */
  exceptionTypeCode: string | null;
  /** 줄 전체 수량 — LOT 의 처음 수량이다. */
  receivedQty: number;
  /** 초과분 — 받은 수량 중 어느 P/O 라인에도 넣지 않은 몫. */
  unallocatedQty: number;
  plantId: number;
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  uomId: number;
  uomCode: string;
  lotId: number | null;
  lotNo: string | null;
  /** 이 줄이 이미 들어간 P/O 라인들(입하 때 들어간 몫 포함). 다 초과분이면 비어 있다. */
  allocations: InboundAllocation[];
}

export interface UnallocatedListResult {
  items: UnallocatedLine[];
  page: PageMeta;
}

/** 목록 질의. 취소했거나 취소 요청 중인 입하는 서버가 뺀다. */
export interface UnallocatedQuery {
  plantId?: number;
  supplierId?: number;
  itemId?: number;
  /** 입하 예외 유형이 이 중 하나인 줄을 뺀다(쉼표로 잇는다) — 예외 유형이 없는 줄은 남고, 전체 수도 뺀 뒤의 수다. */
  excludeExceptionTypeCode?: string;
  page?: number;
  size?: number;
}

/**
 * 연결할 수 있는 P/O 라인 후보 — 같은 공장·공급사·품목·단위이고 취소·닫힘이 아니며 초과분을 다 받을 수 있는 라인.
 * 남은 수량이 초과분과 같은 라인(`exactMatch`)이 먼저, 그다음 최근 발주다(서버가 정렬한다). 줄 자신이 들어간 P/O
 * 라인도 후보가 된다 — ERP 가 추가 P/O 대신 원래 P/O 수량을 늘려 준 경우다.
 */
export interface ExcessCandidate extends OrderLineRef {
  orderDate: string;
  expectedReceiptDate: string | null;
  orderedQty: number;
  receivedQty: number;
  /** 발주 + 초과 허용치 − 받은 수량 — 이만큼까지 연결할 수 있다. */
  roomQty: number;
  exactMatch: boolean;
}

export interface ExcessCandidateListResult {
  items: ExcessCandidate[];
}

/**
 * 발주와 이을 일이 없는 입하 예외 유형 — 고객사급(고객이 대 준 자재) · 무상샘플. 서버는 무엇을 뺄지 화면에 맡긴다 —
 * 목록을 부를 때 `excludeExceptionTypeCode` 로 보낸다. **초과입하(`OVER_DELIVERY`) · 긴급입하(`URGENT_RECEIPT`)는 빼지
 * 않는다** — 발주보다 더 왔거나 발주보다 먼저 온 것이라 나중에 발주에 연결한다(사용자 2026-10-23 「초과 된 것을 나중에
 * 새로운 발주에 연결」).
 */
export const NO_ORDER_EXCEPTION_TYPES: readonly string[] = ['CUSTOMER_SUPPLY', 'FREE_SAMPLE'];

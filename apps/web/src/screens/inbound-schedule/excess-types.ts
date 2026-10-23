import type { PageMeta } from './types';

/**
 * 입하 초과분 발주 연결의 모양 — **서버 장부 P-100 을 손으로 옮긴다.**
 *
 * 네 경로(`/logistics/inbound-excesses` 목록 · 후보 · `:link` · `:unlink`)는 계약 사본 밖이라 생성 타입에 없다.
 * 서버 `src/logistics/inbound-receipt/inbound-excess.ts` 의 `InboundExcessView`·`ExcessCandidateView` 와 같다.
 * 계약 사본에 실리면 이 파일을 지우고 생성 타입을 쓴다.
 *
 * **초과분**은 입하 줄 하나 중 P/O 라인에 넣지 않은 몫이다(`excessQty`). ERP 가 추가 P/O 를 만들면 그 P/O
 * 라인에 사람이 연결한다 — 서버가 후보를 제안하고 사람이 확정한다(사용자 결정 2026-10-21). 연결 전에도 그 수량은
 * 재고로 쓴다(LOT 은 줄 전체 수량이다).
 */

/** P/O 라인 한 줄을 가리키는 값. 사람에게는 발주번호와 줄번호만 보인다. */
export interface OrderLineRef {
  purchaseOrderLineId: number;
  purchaseOrderId: number;
  purchaseOrderNo: string;
  erpPurchaseOrderNo: string | null;
  lineNo: number;
}

export interface InboundExcess {
  inboundReceiptExcessId: number;
  excessQty: number;
  /** 연결한 시각. 미연결이면 `null`. */
  linkedAt: string | null;
  /** 연결된 추가 P/O 라인. 미연결이면 `null`. */
  linkedOrderLine: OrderLineRef | null;
  inboundReceiptId: number;
  inboundReceiptNo: string;
  receiptDatetime: string;
  inboundReceiptLineId: number;
  lineNo: number;
  /** 줄 전체 수량 — LOT 의 처음 수량이다. */
  receivedQty: number;
  /** 이 줄이 처음 연결된 P/O 라인(초과분을 뺀 몫이 들어간 쪽). */
  sourceOrderLine: OrderLineRef | null;
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
}

export interface InboundExcessListResult {
  items: InboundExcess[];
  page: PageMeta;
}

/** 목록 질의. `linked` 기본은 `false`(미연결만)다. 취소했거나 취소 요청 중인 입하는 서버가 뺀다. */
export interface InboundExcessQuery {
  linked?: boolean;
  plantId?: number;
  supplierId?: number;
  itemId?: number;
  page?: number;
  size?: number;
}

/**
 * 연결할 수 있는 P/O 라인 후보 — 같은 공장·공급사·품목·단위이고 취소·닫힘이 아니며 초과분을 다 받을 수 있는 라인.
 * 남은 수량이 초과분과 같은 라인(`exactMatch`)이 먼저, 그다음 최근 발주다(서버가 정렬한다).
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

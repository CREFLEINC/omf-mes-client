import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입의 별칭. 화면 슬라이스끼리 타입을 나눠 쓰지 않는다 —
 * 다른 화면의 같은 이름 타입을 가져다 쓰면 그쪽 사정이 이 화면을 바꾼다.
 */
export type PurchaseOrder = components['schemas']['PurchaseOrder'];
/** 목록 한 행 — 헤더에 입하 진행(`receiptStatusCode`)·라인 수 같은 묶음 값을 더한 것. */
export type PurchaseOrderListItem = components['schemas']['PurchaseOrderListItem'];
/** 라인 — 외자 발주 라인만 ERP 통관번호 · 순번 · 받은 시각이 채워진다(서버 장부 P-143 · server #913). */
export type PurchaseOrderLine = components['schemas']['PurchaseOrderLine'];
export type PurchaseOrderDetail = components['schemas']['PurchaseOrderDetailResponse'];

/*
 * ERP 원본 칸(헤더 `erpOrderTypeCode` · `erpPurchaseGroupCode` · `erpIoTypeCode`, 라인 `erpStorageLocationCode` ·
 * `cancelledAt`)은 생성 타입에 있다(server #911). 코드 칸의 이름은 서버가 싣지 않는다 — 공통코드(`ORDER_TYPE` ·
 * `PUR_GROUP` · `SL_TYPE`)에서 찾고, `erpIoTypeCode` 는 코드 그룹이 없어 원본 코드를 그대로 보인다. 칸을 그리는 쪽은
 * 키가 빠진 응답(#737 이전 서버)도 「없음」으로 받는다.
 */

/** 외자 발주(직수입)의 ERP 발주 유형 코드. 통관번호 단추와 칸은 이 발주에만 보인다. */
export const FOREIGN_ORDER_TYPE = 'PO';

export const isForeignOrder = (order: PurchaseOrder): boolean =>
  order.erpOrderTypeCode === FOREIGN_ORDER_TYPE;

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface PurchaseOrderListResult {
  items: PurchaseOrderListItem[];
  page: PageMeta;
}

export interface SelectOption {
  value: string;
  label: string;
}

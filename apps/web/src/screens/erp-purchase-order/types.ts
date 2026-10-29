import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입의 별칭. 화면 슬라이스끼리 타입을 나눠 쓰지 않는다 —
 * 다른 화면의 같은 이름 타입을 가져다 쓰면 그쪽 사정이 이 화면을 바꾼다.
 */
export type PurchaseOrder = components['schemas']['PurchaseOrder'] &
  PurchaseOrderErpFields &
  PurchaseOrderProgressFields;
export type PurchaseOrderLine = components['schemas']['PurchaseOrderLine'] &
  PurchaseOrderLineErpFields;
export type PurchaseOrderDetail = Omit<
  components['schemas']['PurchaseOrderDetailResponse'],
  'purchaseOrder' | 'lines'
> & { purchaseOrder: PurchaseOrder; lines: PurchaseOrderLine[] };

/**
 * ERP 에서 받은 원본 칸 — **계약에 없어 생성 타입에 없다.** 서버 #737(`feat/erp-fields-in-responses`)이
 * 응답에 더했다(서버 장부 `docs/계약-선행-수정항목.md` P-67). 계약 사본에 같은 이름으로 실려 오면
 * 이 교차 타입을 걷어 낸다.
 *
 * 발주 뷰는 값이 없으면 `null` 을 싣는다. 이 칸을 안 싣는 서버(#737 이전)도 있으므로 키가 빠진
 * 경우까지 함께 받는다 — 둘 다 「없음」이다.
 * 코드 칸의 이름은 서버가 싣지 않는다 — 공통코드(`ORDER_TYPE` · `PUR_GROUP` · `SL_TYPE`)에서 찾는다.
 * `erpIoTypeCode` 는 코드 그룹이 없어 원본 코드를 그대로 보인다.
 */
export interface PurchaseOrderErpFields {
  /** ERP `PO_TYPE_CD` — 공통코드 `ORDER_TYPE` */
  erpOrderTypeCode?: string | null;
  /** ERP `PUR_GRP_CD` — 공통코드 `PUR_GROUP` */
  erpPurchaseGroupCode?: string | null;
  /** ERP `IO_TYPE_CD` — 코드 그룹 없음, 원본 그대로 */
  erpIoTypeCode?: string | null;
}

/**
 * 입하 진행 — 실제 응답에는 실려 오지만 **계약 사본에 없어 생성 타입에 없다.** 계약에 실려 오면 이 교차 타입을 걷는다.
 * 키가 빠진 응답도 받는다 — 그때 목록의 진행 칸은 「없음」이다.
 */
export interface PurchaseOrderProgressFields {
  /** 입하 진행 — `NOT_STARTED` · `PARTIAL` · `COMPLETED` · `CANCELLED` */
  receiptStatusCode?: string | null;
  /** 라인 수 */
  lineCount?: number | null;
  /** 입하가 끝나지 않은 라인 수 */
  openLineCount?: number | null;
}

export interface PurchaseOrderLineErpFields {
  /** ERP `SL_CD` — 공통코드 `SL_TYPE` */
  erpStorageLocationCode?: string | null;
  /** ERP 가 라인 취소(`CREATE_TYPE=C`)를 보낸 시각(date-time). 없으면 취소되지 않은 라인 */
  cancelledAt?: string | null;
  /**
   * ERP 통관번호 · 순번 · 받은 시각 — 외자 발주 라인만 채워진다(서버 장부 P-143 · omf-mes-server#872). 계약 밖 칸이라
   * 키가 빠진 응답(옛 서버)도 받는다 — 둘 다 「없음」이다.
   */
  erpCustomsClearanceNo?: string | null;
  erpCustomsClearanceSeq?: number | null;
  erpCustomsClearanceFetchedAt?: string | null;
}

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
  items: PurchaseOrder[];
  page: PageMeta;
}

export interface SelectOption {
  value: string;
  label: string;
}

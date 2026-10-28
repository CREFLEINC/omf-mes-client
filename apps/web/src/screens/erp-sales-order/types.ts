import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입의 별칭. 화면 슬라이스끼리 타입을 나눠 쓰지 않는다.
 * 목록과 상세가 같은 `SalesOrder` 다 — 상세에만 `lines` 가 채워져 온다(계약 설명 「라인을 함께 내린다」).
 */
export type SalesOrderLine = components['schemas']['SalesOrderLine'] & SalesOrderLineErpFields;
export type SalesOrder = Omit<components['schemas']['SalesOrder'], 'lines'> &
  SalesOrderErpFields &
  SalesOrderProgressFields & { lines?: SalesOrderLine[] };

/**
 * ERP 에서 받은 원본 칸 — **계약에 없어 생성 타입에 없다.** 서버 #737(`feat/erp-fields-in-responses`)이
 * 응답에 더했다(서버 장부 `docs/계약-선행-수정항목.md` P-67). 계약 사본에 같은 이름으로 실려 오면
 * 이 교차 타입을 걷어 낸다.
 *
 * 수주 뷰는 값이 없으면 **키를 뺀다**(발주 뷰는 `null`). 어느 쪽이 와도 「없음」으로 읽게 `null` 도 받는다.
 * 코드 칸의 이름은 서버가 싣지 않는다 — 공통코드(`SO_TYPE` · `SALE_GROUP` · `SL_TYPE`)에서 찾는다.
 * `erpMovementTypeCode` 는 코드 그룹이 없어 원본 코드를 그대로 보인다.
 */
export interface SalesOrderErpFields {
  /** ERP `SO_TYPE_CD` — 공통코드 `SO_TYPE` */
  erpOrderTypeCode?: string | null;
  /** ERP `MOV_TYPE` — 코드 그룹 없음, 원본 그대로 */
  erpMovementTypeCode?: string | null;
  /** ERP `SALES_GRP_CD` — 공통코드 `SALE_GROUP` */
  erpSalesGroupCode?: string | null;
}

/**
 * 출하 진행 — **서버에 요청한 칸이라(2026-10-28) 아직 오지 않는다.** 실려 오기 전에는 목록의 진행 칸이 「없음」이다.
 * 계약 사본에 실려 오면 이 교차 타입을 걷는다.
 */
export interface SalesOrderProgressFields {
  /** 출하 진행 — `NOT_STARTED` · `PARTIAL` · `COMPLETED` · `CANCELLED` */
  shipStatusCode?: string | null;
  /** 라인 수 */
  lineCount?: number | null;
  /** 출하가 끝나지 않은 라인 수 */
  openLineCount?: number | null;
}

export interface SalesOrderLineErpFields {
  /** ERP `SL_CD` — 공통코드 `SL_TYPE` */
  erpStorageLocationCode?: string | null;
  /** ERP 가 라인 취소(`CREATE_TYPE=C`)를 보낸 시각(date-time). 없으면 취소되지 않은 라인 */
  cancelledAt?: string | null;
}

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface SalesOrderListResult {
  items: SalesOrder[];
  page: PageMeta;
}

export interface SelectOption {
  value: string;
  label: string;
}

import type { components } from '@omf-mes/api-client';

/**
 * W-01-09 화면 슬라이스의 계약.
 *
 * **입하 예정 = 아직 다 들어오지 않은 P/O 라인이다**(omf-mes-server#741). 고객사는 ASN 을 쓰지 않아
 * ASN 경로(`/logistics/asns`)가 늘 비어 있었다 — 그래서 이 화면은 P/O 라인 목록을 본다.
 *
 * ⚠ **계약 사본에 없는 경로다.** `GET /logistics/purchase-order-lines` 는 omf-mes-server#749
 * (진행 값 이름 #753 · 장부 P-78)가 계약보다 먼저 연 것이라 `@omf-mes/api-client` 생성 타입에 없다.
 * 응답·질의 모양을 서버 `purchase-order-line-list.ts` 에서 **여기에 손으로 옮긴다.** 사본이 실려
 * `gen:api` 가 만들면 이 두 타입을 생성 타입으로 바꾸고 `queries.ts` 의 넓힘을 지운다.
 *
 * 이 화면은 **읽기만 한다.** 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름
 * 파일을 참조하지 않는다.
 */

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 입하 진행 — **서버가 판정한다**(화면이 규칙을 복사하지 않는다).
 *
 * - `CANCELLED` — 라인이 ERP 에서 취소됐거나 헤더가 취소됐다. 남은 수량은 0 으로 온다
 * - `COMPLETED` — 누적 입하 ≥ 발주 수량. 부족 허용치를 빼지 않는다
 * - `PARTIAL` / `NOT_STARTED` — 받은 것이 있는가
 */
export type ReceiptStatusCode = 'NOT_STARTED' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';

/**
 * 입하 예정 한 줄 — P/O 라인 하나와 그 헤더 칸(server #749 · 장부 P-78 `PurchaseOrderLineListItem`).
 *
 * **키는 언제나 다 온다.** 비어 있는 칸은 `null` 로 온다 — 화면이 「키 없음」 갈래를 따로 두지 않는다.
 */
export interface InboundScheduleLine {
  purchaseOrderId: number;
  /** MES 채번 발주번호 */
  purchaseOrderNo: string;
  erpPurchaseOrderNo: string | null;
  supplierId: number;
  plantId: number;
  /** `YYYY-MM-DD` */
  orderDate: string;
  /** 헤더의 입고 예정일(납기). `YYYY-MM-DD`. 없으면 목록 맨 뒤로 간다. */
  expectedReceiptDate: string | null;
  /** 헤더 상태 — `PurchaseOrder.statusCode` 와 같다. */
  purchaseOrderStatusCode: string;
  purchaseOrderLineId: number;
  lineNo: number;
  itemId: number;
  uomId: number;
  /** 이름 칸(server #762) — 품목·공급사·단위를 따로 부르지 않는다. */
  itemCode: string;
  itemName: string;
  supplierCode: string;
  supplierName: string;
  uomCode: string;
  uomName: string;
  orderedQty: number;
  receivedQty: number;
  /** 파생 — 발주 − 누적 입하. 초과 입하면 0 에서 자르고, 취소된 라인은 0 이다. */
  remainingQty: number;
  toleranceOverQty: number;
  toleranceUnderQty: number;
  /** ERP 창고 코드(`SL_CD`) — 공통코드 `SL_TYPE` 으로 이름을 푼다. */
  erpStorageLocationCode: string | null;
  /** 라인이 ERP 에서 취소된 시각. 취소되지 않았으면 `null`. */
  cancelledAt: string | null;
  receiptStatusCode: ReceiptStatusCode;
}

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface InboundScheduleListResult {
  items: InboundScheduleLine[];
  page: PageMeta;
}

/**
 * 목록 조회 질의(server #749 `parseLineListQuery`). **채운 조건만 키가 실린다.**
 *
 * - `openOnly` — 서버 기본이 `true` 라 **끌 때만** 싣는다
 * - `overdueOnly` — 서버 기본이 `false` 라 **켤 때만** 싣는다. 켜면 미완료 조건이 함께 걸린다
 * - `size` — 늘 20 을 싣는다(사용자 지시 2026-10-20)
 */
export interface InboundScheduleQuery {
  expectedReceiptDateFrom?: string;
  expectedReceiptDateTo?: string;
  supplierId?: number;
  plantId?: number;
  itemId?: number;
  /** 발주번호 · ERP 발주번호 부분일치 */
  q?: string;
  openOnly?: boolean;
  overdueOnly?: boolean;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
  /** 서버 상한 200. */
  size?: number;
}

/**
 * 오른쪽 표 — 고른 P/O 의 라인(server #762 `purchaseOrderId`). ⚠ 서버 기본이 미완료만이라 **`openOnly=false`
 * 를 늘 싣는다** — 고른 발주의 라인은 다 들어온 것까지 다 보여야 한다.
 */
export interface PurchaseOrderLinesQuery {
  purchaseOrderId: number;
  openOnly: false;
  size: number;
}

/**
 * 왼쪽 표 — P/O 묶음 한 줄(server #762 · `GET /logistics/purchase-orders` 의 `PurchaseOrderListItem`).
 * 계약 사본(`gen:api`)에 실리기 전이라 손으로 옮긴다.
 */
export interface PurchaseOrderSummary {
  purchaseOrderId: number;
  purchaseOrderNo: string;
  erpPurchaseOrderNo?: string | null;
  supplierId: number;
  plantId: number;
  orderDate: string;
  expectedReceiptDate?: string | null;
  statusCode: string;
  supplierCode: string;
  supplierName: string;
  /** 취소 포함 전체 라인 수 */
  lineCount: number;
  /** 남은 라인 수 */
  openLineCount: number;
  /** `itemId` 로 찾았을 때 그 품목 라인 수. 아니면 null */
  matchedLineCount: number | null;
  /**
   * 취소되지 않은 라인의 합계. ⭐ 라인 단위가 둘 이상이면 다섯 칸 모두 null 이다 — 화면은 「—」.
   */
  uomId: number | null;
  uomCode: string | null;
  orderedQtyTotal: number | null;
  receivedQtyTotal: number | null;
  remainingQtyTotal: number | null;
  /** 서버 판정 — 라인과 같은 어휘 */
  receiptStatusCode: ReceiptStatusCode;
}

export interface PurchaseOrderSummaryListResult {
  items: PurchaseOrderSummary[];
  page: PageMeta;
}

/** 왼쪽 표 조회 질의 — 기존 P/O 목록 질의에 #762 가 더한 조건. 채운 조건만 키가 실린다. */
export interface PurchaseOrderSummaryQuery {
  expectedReceiptDateFrom?: string;
  expectedReceiptDateTo?: string;
  supplierId?: number;
  plantId?: number;
  itemId?: number;
  q?: string;
  openOnly?: boolean;
  overdueOnly?: boolean;
  page?: number;
  size?: number;
}

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부는 선택지를 거르는 데 쓰지 않고 표식을 붙이는 데 쓴다.** 지금은 쓰지 않는
 * 거래처·공장을 참조하는 과거 발주가 있다 — 미사용 값을 빼면 그 발주들을 조건으로 찾을 방법이
 * 사라진다. 표식을 붙이는 자리는 `screen.tsx`의 `toSelectOptions` 한 곳이다.
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
  /**
   * 「코드 · 이름」을 따로 쓰는 자리(표의 코드 열·이름 열)를 위한 두 조각. 선택지는 `label` 을 쓴다.
   * 코드만 있는 참조(단위)는 두지 않는다.
   */
  code?: string;
  name?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

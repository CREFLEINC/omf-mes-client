import type { components, paths } from '@omf-mes/api-client';

/**
 * W-01-09 화면 슬라이스의 계약.
 *
 * **입하 예정 = 아직 다 들어오지 않은 P/O 라인이다**(omf-mes-server#741). 고객사는 ASN 을 쓰지 않아
 * ASN 경로(`/logistics/asns`)가 늘 비어 있었다 — 그래서 이 화면은 P/O 라인 목록을 본다.
 *
 * 왼쪽 발주 목록 · 단계 건수 · LOT 진행은 생성 타입의 별칭이다(server #911 로 계약에 실렸다). 오른쪽 라인 목록
 * (`GET /logistics/purchase-order-lines` · server #749 · 장부 P-78)도 server #912(전달본 2026-10-30)로 계약에 실렸다.
 *
 * 이 화면은 **읽기만 한다.** 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름
 * 파일을 참조하지 않는다.
 */

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 입하 예정 한 줄 — P/O 라인 하나와 그 헤더·공급사·품목·단위 칸(server #749 · #762 · 장부 P-78 `PurchaseOrderLineListItem`).
 *
 * **키는 언제나 다 온다.** 비어 있는 칸은 `null` 로 온다 — 화면이 「키 없음」 갈래를 따로 두지 않는다.
 * `remainingQty` 는 발주 − 누적 입하(0 에서 자른다 · 취소된 라인은 0)다.
 */
export type InboundScheduleLine = components['schemas']['PurchaseOrderLineListItem'];

/**
 * 입하 진행 — **서버가 판정한다**(화면이 규칙을 복사하지 않는다).
 *
 * - `CANCELLED` — 라인이 ERP 에서 취소됐거나 헤더가 취소됐다. 남은 수량은 0 으로 온다
 * - `COMPLETED` — 누적 입하 ≥ 발주 수량. 부족 허용치를 빼지 않는다
 * - `PARTIAL` / `NOT_STARTED` — 받은 것이 있는가
 */
export type ReceiptStatusCode = InboundScheduleLine['receiptStatusCode'];

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export type InboundScheduleListResult =
  paths['/logistics/purchase-order-lines']['get']['responses'][200]['content']['application/json'];

/**
 * 왼쪽 표 — P/O 묶음 한 줄(server #762 · `GET /logistics/purchase-orders` 의 `PurchaseOrderListItem`).
 * ⭐ 라인 단위가 둘 이상이면 단위·합계 다섯 칸(`uomId` · `uomCode` · `…QtyTotal`)이 모두 null 이다 — 화면은 「—」.
 */
export type PurchaseOrderSummary = components['schemas']['PurchaseOrderListItem'];

/**
 * 입고 단계 — **서버가 LOT 마다 판정한다**(규범 C-17 — 화면이 검사 결과·입고 전표·적치 작업을 따로 조회해 조합하지 않는다).
 * 값 목록은 생성 타입 `InboundLotProgress.stageCode` 와 같다(장부 P-110). 모르는 값은 번역하지 않고 중립 색으로 그대로 낸다.
 *
 * | 값 | 뜻(다음 할 일) | 근거 |
 * | --- | --- | --- |
 * | `LABEL_PENDING` | 라벨 발행 대기 — POP 「자재LOT 등록·라벨 발행」 | 라벨 미부착 입하 라인이라 LOT 이 아직 없다 |
 * | `INSPECTION_REQUIRED` | 검사 의뢰 전 — 다음 할 일 없음(의뢰는 입하 등록 때 서버가 만든다) | 검사 대상인데 열린 검사 의뢰가 없다 |
 * | `INSPECTION_REQUESTED` · `INSPECTION_IN_PROGRESS` | 검사 대기 · 검사 중 — 품질팀 | 검사 의뢰 REQUESTED · IN_PROGRESS |
 * | `INSPECTION_HELD` | 보류 — 품질팀 | 판정 HELD 또는 LOT 보류 |
 * | `RECEIPT_READY` | 입고 대기 — 「입고 처리」(이 화면의 오른쪽 창) | LOT NORMAL·DEFECTIVE·검사 생략, 입고 전표 없음 |
 * | `PUTAWAY_PENDING` · `PUTAWAY_TEMPORARY` | 적치 대기 · 임시 적치 — PDA | 적치 작업 PENDING · COMPLETED_TEMPORARY |
 * | `COMPLETED` | 완료 | 적치 작업 COMPLETED |
 * | `CANCELLED` | 취소 | 입하 전표 취소 |
 */
export type InboundStageCode = components['schemas']['InboundLotProgress']['stageCode'];

/**
 * 단계 **묶음** — 탭 줄의 건수 칩 · 왼쪽 표의 「진행」 열 · 목록 조건(`inboundStage`)이 쓰는 굵은 단위다.
 * 끝난 것(완료·취소)은 묶음이 아니다 — 세지도 거르지도 않는다.
 */
export type InboundStageGroup = NonNullable<PurchaseOrderSummaryQuery['inboundStage']>;

export type InboundStageCounts = Partial<Record<InboundStageGroup, number>>;

/**
 * LOT 줄의 다음 할 일 — 서버가 정한다(생성 타입 `InboundLotProgress.nextActionCode`). `POST_RECEIPT` 만 이 화면이 하고,
 * `ISSUE_LABEL`(POP) · `PUTAWAY`(PDA) 는 다른 기기의 일이라 글자로만 낸다. 검사 의뢰는 입하 등록 때 서버가 만들므로
 * 「의뢰 요청」 값은 없다(사용자 결정 2026-10-29 · omf-mes-server#805 · #909).
 */
export type InboundNextActionCode = NonNullable<
  components['schemas']['InboundLotProgress']['nextActionCode']
>;

/**
 * 한 발주의 LOT 하나 — 입하 라인에서 나온 자재 LOT 과, 그 뒤 단계(검사·입고·적치)의 근거.
 * `GET /logistics/purchase-orders/{purchaseOrderId}/inbound-progress` 의 `items[]`(생성 타입 `InboundLotProgress`).
 *
 * `stageCode` 만 넓힌다 — 서버가 단계를 더해도 화면이 깨지지 않고 모르는 값을 그대로 내야 해서(`| string`)다.
 * `allocatedQty`(서버 #843)는 이 입하 줄에서 **이** 발주 라인들에 들어간 몫이다 — 초과분을 다른 발주에 연결한 줄은
 * 두 발주에 다 나타나는데, 원 발주에는 원래 몫 · 연결한 발주에는 연결한 몫이다. `receivedQty` 는 줄 전체다.
 *
 * **라벨 미부착 입하 라인도 한 줄이다**(`LABEL_PENDING` · 사용자 지시 2026-10-23 「라벨 미부착도 확인해야 해」). 그 줄은
 * LOT 이 아직 없어 `lotId` · `lotNo` · `lotStatusCode` 가 `null` 이고, 줄은 입하 라인(`inboundReceiptLineId`)으로 가린다.
 */
export type InboundLotProgress = Omit<components['schemas']['InboundLotProgress'], 'stageCode'> & {
  stageCode: InboundStageCode | string;
};

/** LOT 이 붙은 줄 — 「입고 처리」는 LOT 하나를 대상으로 하므로 이 줄에만 나타난다. */
export type IssuedLotProgress = InboundLotProgress & { lotId: number; lotNo: string };

export interface InboundProgressResult {
  items: InboundLotProgress[];
}

/** `GET /logistics/purchase-orders:inbound-stage-counts` — 목록과 같은 조건(쪽 제외)으로 센 묶음별 LOT 수. */
export type InboundStageCountsResult = components['schemas']['InboundStageCountResponse'];

export interface PurchaseOrderSummaryListResult {
  items: PurchaseOrderSummary[];
  page: PageMeta;
}

/**
 * 왼쪽 표 조회 질의(`GET /logistics/purchase-orders`). **채운 조건만 키가 실린다.**
 *
 * - `openOnly` — 미완료만이 화면 기본이라 **끌 때만** `false` 를 싣는다
 * - `overdueOnly` — **켤 때만** 싣는다. 켜면 미완료 조건이 함께 걸린다
 * - `sort` — 열 정렬 `열,방향`(`OrderSortParam`). 없으면 서버 기본 순서(발주일 최신순). 모르는 열·방향은 400 이다
 */
export type PurchaseOrderSummaryQuery = NonNullable<
  paths['/logistics/purchase-orders']['get']['parameters']['query']
>;

/**
 * 왼쪽 발주 목록의 **정렬 열** — 서버가 정렬한다(omf-mes-server #824 · 장부 P-116 · 2026-10-24 실서버 확인). 목록이 쪽(20건)
 * 단위라 화면이 정렬하면 보이는 쪽 안에서만 섞여 쪽을 넘는 순서가 틀린다.
 *
 * 질의는 **한 칸 `sort=열,방향`** 이다(W/O 목록과 같은 모양 · 방향 생략은 asc). 모르는 열·방향은 400 이다.
 * 같은 값끼리는 서버가 `purchase_order_id` 내림으로 가르고, 정렬이 없으면 지금 순서(발주일 최신순)다.
 *
 * | 값 | 열 | 서버 순서(asc) |
 * | --- | --- | --- |
 * | `overdue` | 상태 | 지연 → 정상 → 끝남(지연 = 「지연」 조건과 같은 기준 · 납기 없는 남은 발주는 정상) |
 * | `expectedReceiptDate` | 납기 | 납기 없는 발주는 방향과 상관없이 맨 뒤 |
 * | `purchaseOrderNo` | 발주번호 | MES 번호 |
 * | `inboundStage` | 진행 | 가장 뒤처진 묶음(라벨 발행 → 검사 → 보류 → 입고 → 적치) → 그 수. 묶음 없는 발주는 늘 맨 뒤 |
 * | `supplierName` | 공급사명 | |
 * | `openLineCount` | 미입고 품목 | |
 * | `orderDate` | 발주일 | |
 */
export type OrderSortKey =
  | 'overdue'
  | 'expectedReceiptDate'
  | 'purchaseOrderNo'
  | 'inboundStage'
  | 'supplierName'
  | 'openLineCount'
  | 'orderDate';

export interface OrderSort {
  key: OrderSortKey;
  direction: 'ascending' | 'descending';
}

/** 서버 질의 값 — `expectedReceiptDate,desc`. */
export type OrderSortParam = `${OrderSortKey},${'asc' | 'desc'}`;

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

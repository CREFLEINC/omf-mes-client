/*
 * 005 C-K4 덧댐 — W-01-16 입하/입고 작업 기록 — 배정 · 최종 마감(§5).
 * 서버 병합 뒤 `gen:api` 로 다시 만들고 이 파일을 걷는다(T111). 계약에 적히지 않아 화면이 정한 칸은 「(C5 정함)」 · 「(C6 정함)」.
 *
 * ⛔ ERP 구매입고 송신 · 송신 상태(`erpMessageKey` 등)는 여기 두지 않는다 — #265.
 */
import type {
  InboundLot,
  InboundLotDetail,
  InboundLotId,
  Json,
  NoParameters,
  Op,
  Unused,
} from './forward-contract';

/* 입하 LOT 행 · 상세에 더한 W-01-16 칸(forward-contract.ts 의 제자리 덧댐)을 패키지 밖으로 낸다. */
export type { InboundLotFinalizeBlocker, InboundLotFinalizeBlockerCode } from './forward-contract';

/**
 * 매칭 후보 P/O 라인 한 줄(계약 §5 `GET …/allocation-candidates`) — 같은 공장·공급사·품목의 미마감 P/O 라인 +
 * 이 입하 LOT 에 이미 매칭된 라인, 발주일 순. 칸 이름은 `InboundAllocationCandidate`(이전 데이터 줄 축)를 따르고
 * 그 계약에 없는 것은 「(C6 정함)」.
 */
export interface InboundLotAllocationCandidate {
  purchaseOrderLineId: number;
  purchaseOrderId: number;
  purchaseOrderNo: string;
  lineNo: number;
  orderDate: string;
  erpPurchaseOrderNo: string | null;
  /** 발주량(품목 기본 단위). */
  orderedQty: number;
  /** 이 P/O 라인에 지금까지 오른 받은 양 — 이 입하 LOT 몫(`thisLotQty`) 포함. */
  receivedQty: number;
  /** 초과 허용치(C6 정함 — 계약 「초과 허용치」). */
  toleranceQty: number;
  /** 이 입하 LOT 의 지금 매칭 몫 — 매칭이 없으면 0. */
  thisLotQty: number;
  /** 이 라인에 매칭할 수 있는 최대 = 발주 + 허용치 − (받은 양 − 이 입하 LOT 몫). */
  maxQty: number;
  /** 입하 마감 뒤에 열린 초과분 P/O 라인인가(C6 정함 — 비고 「초과분 발주 · 마감 뒤 생김」). */
  openedAfterReceiptClose?: boolean;
}

/** `PUT …/po-allocations` 본문(계약 §5) — 배정 전체 교체. 0 인 라인은 싣지 않는다. */
export interface InboundLotPoAllocationReplace {
  versionNo: number;
  allocations: { purchaseOrderLineId: number; qty: number }[];
}

/** `POST …:finalize` 본문(계약 §5). P/O 없음이 남으면 `acknowledgeUnallocated: true` 가 있어야 한다. */
export interface InboundLotFinalize {
  versionNo: number;
  acknowledgeUnallocated?: boolean;
}

/**
 * 400 `RANGE`(매칭 저장) · `UNALLOCATED_REMAINS`(최종 마감)의 `details`(계약 §5). 응답의 어디에 실리는지(봉투 맨 위 ·
 * 오류 줄)는 계약이 적지 않아 둘 다 읽는다(C6 정함).
 */
export interface InboundLotWorkRecordErrorDetails {
  purchaseOrderLineId?: number;
  maxQty?: number;
  unallocatedQty?: number;
}

export interface ForwardPaths005WorkRecord {
  /** 005 — 매칭 후보 P/O 라인(계약 §5). 권한 W-01-16. 응답 봉투 `items`(C6 정함). */
  '/logistics/inbound-lots/{inboundLotId}/allocation-candidates': Unused & {
    parameters: NoParameters;
    put?: never;
    post?: never;
    get: Op<
      { query?: never; header?: never; path: InboundLotId; cookie?: never },
      never,
      { 200: Json<{ items: InboundLotAllocationCandidate[] }> }
    >;
  };
  /** 005 — P/O 배정 전체 교체(계약 §5). `RECEIVED` · `ON_FINALIZE` 만. 권한 W-01-16. */
  '/logistics/inbound-lots/{inboundLotId}/po-allocations': Unused & {
    parameters: NoParameters;
    get?: never;
    post?: never;
    put: Op<
      { query?: never; header?: never; path: InboundLotId; cookie?: never },
      { content: { 'application/json': InboundLotPoAllocationReplace } },
      { 200: Json<InboundLotDetail> }
    >;
  };
  /** 005 — 최종 마감(계약 §5). ERP 구매입고 적재는 #265. 권한 W-01-16. */
  '/logistics/inbound-lots/{inboundLotId}:finalize': Unused & {
    parameters: NoParameters;
    get?: never;
    put?: never;
    post: Op<
      {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: InboundLotId;
        cookie?: never;
      },
      { content: { 'application/json': InboundLotFinalize } },
      { 200: Json<InboundLot> }
    >;
  };
}

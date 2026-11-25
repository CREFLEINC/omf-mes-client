import type {
  components,
  MaterialLotSummary,
  MaterialLotTabRow,
  MaterialPackage,
  WaitingMaterialLotGroup,
} from '@omf-mes/api-client';

type PrinterResponse = components['schemas']['Printer'];

/** 프린터 상태. 계약의 enum 을 그대로 쓴다 — 화면이 값을 늘리거나 줄이지 않는다. */
export type PrinterStatus = PrinterResponse['status'];

/**
 * 화면이 다루는 프린터 한 대.
 *
 * `statusMessage`는 **서버가 주는 사람이 읽는 설명**이다. 화면이 `status`로 문구를 조립하지
 * 않는다(계약 명시) — 조립하면 서버가 값을 늘렸을 때 화면만 모르는 문구가 생긴다.
 */
export interface PrinterView {
  printerName: string;
  displayName: string;
  status: PrinterStatus;
  /** 없을 수 있다. 없는 것과 조회하지 못한 것은 다른 상태다(공유계약 G-9). */
  statusMessage: string | null;
  isDefault: boolean;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toPrinterView = (data: PrinterResponse): PrinterView => ({
  printerName: data.printerName,
  displayName: data.displayName,
  status: data.status,
  statusMessage: data.statusMessage ?? null,
  isDefault: data.isDefault,
});

/**
 * 머리에 보일 한 대를 고른다 — **기본 프린터가 있으면 그것, 없으면 첫 번째.**
 *
 * 프린터 설치 구성(대수·단말당 배정)이 고객 정리 대기라 **한 대 전제로 동작한다**(착수 이슈
 * 미결 4). 여러 대가 오면 고르는 자리가 필요하지만 그 구성이 정해지기 전에는 만들지 않는다.
 */
export const toHeadPrinter = (printers: PrinterView[]): PrinterView | null =>
  printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;

/**
 * 목록에 놓이는 **자재 관리 LOT 한 개**(005 · omf-all-around#254) — 공급사·품목 묶음의 값과 LOT 값을 합친 것.
 *
 * ⭐ 005 부터 라벨은 입하 전 **대기** 자재 관리 LOT 에 찍는다(FR-007). 옛 화면의 「입하 줄 → LOT 등록 → 발행」은
 *    없다 — LOT 은 「자재 관리 LOT 만들기」(발행 묶음)가 이미 만들었다. 그래서 이 줄에는 LOT 이 늘 있다.
 */
export interface LabelLot {
  lotId: number;
  lotNo: string;
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  /** 품목 기본 단위. */
  uomCode: string;
  lotQty: number;
  package: MaterialPackage | null;
  supplierLotNo: string | null;
  lifecycleStatusCode: MaterialLotSummary['lifecycleStatusCode'];
  /** 품질 상태 — 대기 LOT 는 검사 대기. 막힘 판정에 쓴다. */
  statusCode: string;
  inboundLotNo: string | null;
  lastIssue: { issueSeq: number; issuedAt: string } | null;
  /**
   * 등록일시 — 발행 대기 표의 일시 칸과 [최신순 | 오래된순]이 이 값으로 선다(사용자 지시 2026-11-19).
   * 선택인 까닭: 분할 LOT 라벨(`goods-issue-qr`)도 이 줄 타입을 쓰는데 그쪽은 분할 일시로 따로 줄 세운다.
   */
  createdAt?: string;
  /** 탭에서의 차례(피처 014) — 미출력 탭은 만든 차례(1 부터). 일괄 출력 장수가 이 차례의 앞에서부터다. */
  seq?: number;
  /** 만든 방식(피처 014) — AUTO 조회가 P/O 몫으로 · MANUAL [만들기]. */
  creationModeCode?: MaterialLotTabRow['creationModeCode'];
  /** 만들 때 채운 P/O 라인(AUTO 만). */
  purchaseOrderLine?: MaterialLotTabRow['purchaseOrderLine'];
  /** 받은 시각(입하된 LOT 탭) · 폐기 시각(폐기 LOT 탭). */
  receivedAt?: string | null;
  voidedAt?: string | null;
}

/** 공급사·품목 하나 — 품목 표 · 번호 찾기 · 만들기 창이 함께 쓰는 이름표. */
export interface PairRef {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  /** 품목 기본 단위. */
  uomCode: string;
}

/** 탭 목록의 한 줄(피처 014 `MaterialLotTabRow`)을 화면 줄로 옮기는 **유일한 지점**이다. */
export const toLabelLotFromRow = (row: MaterialLotTabRow, pair: PairRef): LabelLot => ({
  lotId: row.lotId,
  lotNo: row.lotNo,
  supplierId: pair.supplierId,
  supplierCode: pair.supplierCode,
  supplierName: pair.supplierName,
  itemId: pair.itemId,
  itemCode: pair.itemCode,
  itemName: pair.itemName,
  uomCode: row.uomCode,
  lotQty: row.lotQty,
  package: row.package,
  supplierLotNo: row.supplierLotNo,
  lifecycleStatusCode: row.lifecycleStatusCode,
  statusCode: row.statusCode,
  inboundLotNo: row.inboundLotNo,
  lastIssue: row.lastLabelIssue,
  createdAt: row.createdAt,
  seq: row.seq,
  creationModeCode: row.creationModeCode,
  purchaseOrderLine: row.purchaseOrderLine,
  receivedAt: row.receivedAt,
  voidedAt: row.voidedAt,
});

/** 공급사·품목 묶음의 열쇠 — 품목 표의 한 줄. */
export const pairKeyOf = (supplierId: number, itemId: number): string =>
  `${String(supplierId)}:${String(itemId)}`;

/** 응답 한 묶음의 LOT 을 화면 줄로 옮기는 **유일한 지점**이다. */
export const toLabelLots = (group: WaitingMaterialLotGroup): LabelLot[] =>
  group.lots.map((lot) => ({
    lotId: lot.lotId,
    lotNo: lot.lotNo,
    supplierId: group.supplierId,
    supplierCode: group.supplierCode,
    supplierName: group.supplierName,
    itemId: group.itemId,
    itemCode: group.itemCode,
    itemName: group.itemName,
    uomCode: group.uomCode,
    lotQty: lot.lotQty,
    package: lot.package,
    supplierLotNo: lot.supplierLotNo,
    lifecycleStatusCode: lot.lifecycleStatusCode,
    statusCode: lot.statusCode,
    inboundLotNo: lot.inboundLotNo,
    lastIssue: lot.lastLabelIssue,
    createdAt: lot.createdAt,
  }));

/** 대기(입하 전) 자재 관리 LOT 인가 — 고르기 · 폐기 · 첫 발행의 대상. */
export const isWaiting = (lot: LabelLot): boolean => lot.lifecycleStatusCode === 'WAITING';

/** 폐기된 LOT 은 라벨을 찍지 않는다(발행 조건 「생애 `VOIDED` 거절」 · 계약 §1). */
export const isVoided = (lot: LabelLot): boolean => lot.lifecycleStatusCode === 'VOIDED';

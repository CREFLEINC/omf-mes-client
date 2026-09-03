import type { components } from '@omf-mes/api-client';

import { DELIVERY_LABEL, type LabelKind } from './codes';

type AllocationResponse = components['schemas']['ShipmentLotAllocation'];
type ShipmentResponse = components['schemas']['Shipment'];
type HandlingUnitResponse = components['schemas']['HandlingUnit'];
type PrinterResponse = components['schemas']['Printer'];
type DocumentIssueResponse = components['schemas']['DocumentIssue'];
type DocumentIssueSummaryResponse = components['schemas']['DocumentIssueSummary'];

export interface ShipmentView {
  shipmentId: number;
  shipmentNo: string;
}

export const toShipmentView = (data: ShipmentResponse): ShipmentView => ({
  shipmentId: data.shipmentId,
  shipmentNo: data.shipmentNo,
});

/**
 * 출하 배분 한 건 — **납품 라벨의 대상**이다(요구서 §3-8).
 *
 * ⛔ **응답을 통째로 넓히지 않는다.** 배분에는 창고·단위·잔여 수량이 함께 오는데 이 화면이
 * 그리지도 보내지도 않는 값이다 — 자리를 두지 않으면 새어 나갈 경로도 없다.
 */
export interface AllocationView {
  shipmentLotAllocationId: number;
  lotId: number;
  /**
   * 없을 수 있다 — 계약이 선택으로 둔다.
   *
   * ⚠ **없을 때 대신 그릴 것이 응답에 없다.** 품목 코드는 배분 응답에 실리지 않는다(계약 확인
   * 2026-09-02) — 계획 §6-C 로 올린 자리다. 그때까지는 자리표시 문구를 그린다.
   */
  lotNo: string | null;
  /** 포장하지 않는 출하도 있다(계약 명시) — 그래서 비어 올 수 있다. */
  handlingUnitId: number | null;
  /**
   * 출하검사에 합격했는가. **서버가 판정한 값이다** — 화면이 검사 결과를 보고 정하지 않는다.
   *
   * ⭐ 검사 대상이 아닌 배분도 참으로 온다(계약 명시) — 「검사를 안 거쳤다」가 「발행하면
   * 안 된다」가 아니기 때문이다.
   */
  oqcPassed: boolean;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toAllocationView = (data: AllocationResponse): AllocationView => ({
  shipmentLotAllocationId: data.shipmentLotAllocationId,
  lotId: data.lotId,
  lotNo: data.lotNo ?? null,
  handlingUnitId: data.handlingUnitId ?? null,
  oqcPassed: data.oqcPassed,
});

/**
 * 취급 단위 한 건 — **포장 라벨의 대상**이다(요구서 §3-8 · 스펙 §0).
 *
 * `statusCode` 는 **그대로 보이기만 한다.** 계약이 「확정된 값 목록이 없으므로 화면은 서버가
 * 내려주는 값을 그대로 표시하고 **값 자체로 분기하지 않는다**」로 못박았다(공유계약 G-2).
 */
export interface HandlingUnitView {
  handlingUnitId: number;
  handlingUnitNo: string;
  statusCode: string;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toHandlingUnitView = (data: HandlingUnitResponse): HandlingUnitView => ({
  handlingUnitId: data.handlingUnitId,
  handlingUnitNo: data.handlingUnitNo,
  statusCode: data.statusCode,
});

/**
 * 목록 ②에 놓이는 **대상 한 줄** — 라벨 종류가 무엇이든 같은 모양이다.
 *
 * 스펙 §3 의 네 칸(대상 · 상태 · 최근 발행 · 회차)이 그대로 이 타입이다. 종류에 따라
 * **무엇이 대상인가**는 갈리지만(배분 ↔ 취급 단위) 표의 모양은 갈리지 않는다 — 갈라 두면
 * 표 컴포넌트가 둘이 되고 회차 열을 두 번 고치게 된다.
 */
export interface TargetRow {
  /** 발행 요청의 `targetId` 로 그대로 실린다. 종류에 따라 배분 또는 취급 단위 식별자다. */
  targetId: number;
  /**
   * 화면에 그리는 대상 이름.
   *
   * ⚠ **클라이언트가 조립하지 않는다**(공유계약 A-10) — 서버가 준 문자열 하나를 그대로 쓴다.
   * 납품 라벨은 LOT 번호(없으면 품목 코드), 포장 라벨은 취급 단위 번호다.
   */
  displayName: string;
  /**
   * 소속 LOT. **포장 라벨은 비운다** — 한 포장에 여러 LOT 이 섞여 하나로 정할 수 없다
   * (스펙 §5-3 · 공유계약 A-21). 비우는 것이 결손이 아니라 결정이다.
   */
  lotId: number | null;
  /**
   * 발행할 수 있는가. **납품 라벨만 이 값이 거짓이 된다** — 고객에게 나가는 것이라 OQC
   * 합격 건에만 붙는다(스펙 §5-1). 포장 라벨은 검사와 무관해 언제나 참이다.
   */
  isIssuable: boolean;
  /** 상태 칸에 그리는 문자열. 종류마다 뜻이 다르다 — 합격 여부 / 취급 단위 상태. */
  statusLabel: string;
}

/**
 * 한 대상의 발행 현황 — 목록의 「최근 발행 · 회차」 칸이 쓴다.
 *
 * ⛔ **회차를 화면이 세지 않는다.** 같은 대상을 다른 단말에서도 찍으므로 화면이 센 값은 곧
 * 틀린다(착수 이슈 §6).
 */
export interface IssueSummaryView {
  targetId: number;
  issueCount: number;
  lastIssuedAt: string | null;
  lastPrintOutcome: DocumentIssueSummaryResponse['lastPrintOutcome'];
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toIssueSummaryView = (data: DocumentIssueSummaryResponse): IssueSummaryView => ({
  targetId: data.targetId,
  issueCount: data.issueCount,
  lastIssuedAt: data.lastIssuedAt ?? null,
  lastPrintOutcome: data.lastPrintOutcome ?? null,
});

/**
 * 배분을 목록 줄로 옮긴다 — **납품 라벨 갈래.**
 *
 * ⛔ **미합격 건을 목록에서 빼지 않는다.** 스펙 §3 의 목록이 검사 대기 건을 「⛔ 발행 불가」로
 * 함께 그린다 — 빼 버리면 사용자는 그 포장이 «어디 갔는지» 알 수 없고, 검사를 기다리는
 * 중인지 애초에 이 출하에 없는지 구분하지 못한다(공유계약 G-9).
 */
export const toDeliveryRow = (
  allocation: AllocationView,
  passedLabel: string,
  waitingLabel: string,
  unnamedLabel: string,
): TargetRow => ({
  targetId: allocation.shipmentLotAllocationId,
  // 서버가 준 표시 문자열만 쓴다 — 없으면 지어내지 않고 「없음」을 밝힌다(공유계약 G-9).
  displayName: allocation.lotNo ?? unnamedLabel,
  lotId: allocation.lotId,
  isIssuable: allocation.oqcPassed,
  statusLabel: allocation.oqcPassed ? passedLabel : waitingLabel,
});

/**
 * 취급 단위를 목록 줄로 옮긴다 — **포장 라벨 갈래.**
 *
 * `lotId` 를 비운다(스펙 §5-3). ⛔ 배분에서 아무 LOT 이나 골라 채우지 않는다 — 한 포장에
 * 여러 LOT 이 섞이므로 하나를 고르면 계보가 거짓이 된다.
 */
export const toPackingRow = (unit: HandlingUnitView): TargetRow => ({
  targetId: unit.handlingUnitId,
  displayName: unit.handlingUnitNo,
  lotId: null,
  isIssuable: true,
  statusLabel: unit.statusCode,
});

/** 프린터 상태. 계약의 enum 을 그대로 쓴다 — 화면이 값을 늘리거나 줄이지 않는다. */
export type PrinterStatus = PrinterResponse['status'];

/**
 * 화면이 다루는 프린터 한 대.
 *
 * `statusMessage` 는 **서버가 주는 사람이 읽는 설명**이다 — 화면이 `status` 로 문구를
 * 조립하지 않는다(계약 명시).
 */
export interface PrinterView {
  printerName: string;
  displayName: string;
  status: PrinterStatus;
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

/** 처음 고를 한 대 — 기본 프린터가 있으면 그것, 없으면 첫 번째. 없으면 `null`. */
export const toDefaultPrinterName = (printers: PrinterView[]): string | null =>
  (printers.find((printer) => printer.isDefault) ?? printers[0])?.printerName ?? null;

/** 인쇄 결과. 계약의 enum 을 그대로 쓴다 — 보고 전에는 `PENDING` 이다. */
export type PrintOutcome = DocumentIssueResponse['printOutcome'];

/**
 * 발행 기록 한 건.
 *
 * 회차가 오르면 **새 행**이고 이전 회차는 남는다 — 그래서 이력이 세로 `Stepper` 로 선다
 * (스펙 §7).
 */
export interface IssueView {
  documentIssueLogId: number;
  targetId: number;
  displayName: string;
  issueSeq: number;
  reissueReasonName: string | null;
  issuedAt: string;
  printOutcome: PrintOutcome;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toIssueView = (data: DocumentIssueResponse): IssueView => ({
  documentIssueLogId: data.documentIssueLogId,
  targetId: data.target.targetId,
  displayName: data.target.displayName,
  issueSeq: data.issueSeq,
  reissueReasonName: data.reissueReasonName ?? null,
  issuedAt: data.issuedAt,
  printOutcome: data.printOutcome,
});

/** 계약의 `date-time` 을 목록 칸에 맞게 줄인다 — 월-일 시:분. POP 목록에 연도 자리가 없다. */
const DATETIME_PATTERN = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u;

/**
 * 최근 발행 시각 표기.
 *
 * ⛔ **형식이 아니면 원문을 그대로 낸다.** 화면이 삼키면 서버가 무엇을 보냈는지 알 수 없다
 * (공유계약 G-9).
 */
export const formatIssuedAt = (value: string): string => {
  const matched = DATETIME_PATTERN.exec(value);

  return matched === null ? value : `${matched[1]}-${matched[2]} ${matched[3]}:${matched[4]}`;
};

/**
 * 고른 대상 중 **하나라도 이미 발행된 것이 있는가.**
 *
 * 계약이 「대상 중 하나라도 이미 발행된 것이 있으면 재발행 사유가 **필수**」로 정했고, 없으면
 * 422 다. ⛔ 화면이 회차를 세어 판정하지 않는다 — `summary` 가 준 발행 횟수로만 가른다.
 */
export const needsReissueReason = (
  selectedIds: readonly number[],
  summaries: readonly IssueSummaryView[],
): boolean =>
  selectedIds.some((id) =>
    summaries.some((summary) => summary.targetId === id && summary.issueCount > 0),
  );

/** 라벨 종류가 대상 목록의 갈래를 정한다 — 화면 곳곳에서 같은 판정을 되풀이하지 않는다. */
export const isDelivery = (kind: LabelKind): boolean => kind === DELIVERY_LABEL;

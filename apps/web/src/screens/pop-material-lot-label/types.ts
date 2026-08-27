import type { components } from '@omf-mes/api-client';

type InboundReceiptResponse = components['schemas']['InboundReceipt'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 화면이 다루는 입하 건 한 줄.
 *
 * **계약 응답을 통째로 넓히지 않고 쓰는 값만 옮긴다.** 응답에는 차량 번호·입하장·예외 유형·
 * 승인 요청·접수자가 함께 오는데 이 화면이 그리지도 보내지도 않는 값이다 — 타입에 자리를
 * 두지 않으면 그 값이 화면으로 샐 경로도 없다.
 */
export interface ReceiptView {
  inboundReceiptId: number;
  inboundReceiptNo: string;
  supplierId: number;
  receiptDatetime: string;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toReceiptView = (data: InboundReceiptResponse): ReceiptView => ({
  inboundReceiptId: data.inboundReceiptId,
  inboundReceiptNo: data.inboundReceiptNo,
  supplierId: data.supplierId,
  receiptDatetime: data.receiptDatetime,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface ReceiptListResult {
  items: ReceiptView[];
  page: PageMeta;
}

/** 계약의 date-time 문자열에서 날짜 조각만 뽑는다. */
const RFC3339_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})T/u;

/**
 * 입하일 표기 — **날짜까지만 보인다.**
 *
 * 1024×768에 좌우 2단이라 시각을 넣을 가로 여유가 없고, 이 화면이 입하 건을 고르는 데
 * 시각까지 필요하지 않다(같은 날 여러 건이면 입하번호로 갈린다).
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 — 「—」로
 * 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다(공유계약 G-9).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatReceiptDate = (value: string): string =>
  RFC3339_DATE_PATTERN.exec(value)?.[1] ?? value;

type InboundReceiptLineResponse = components['schemas']['InboundReceiptLine'];

/**
 * 화면이 다루는 입하 라인 한 줄.
 *
 * **`supplierLotMissing`이 이 화면의 갈림길이다.** 공급사가 LOT 을 붙여 온 건은 이 화면의
 * 대상이 아니다(사전부착 경로가 따로 있다). 계약이 이 값을 **라인** 속성으로 두고 입하 건
 * 목록에는 필터를 주지 않아, 걸러 내는 대신 **줄마다 표시**한다(검토 요청 omf-mes#245 ③).
 */
export interface LineView {
  inboundReceiptLineId: number;
  lineNo: number;
  itemId: number;
  receivedQty: number;
  uomId: number;
  /** 참이면 공급사 LOT 이 없다 — MES 가 발번할 대상이다. */
  supplierLotMissing: boolean;
}

/** 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toLineView = (data: InboundReceiptLineResponse): LineView => ({
  inboundReceiptLineId: data.inboundReceiptLineId,
  lineNo: data.lineNo,
  itemId: data.itemId,
  receivedQty: data.receivedQty,
  uomId: data.uomId,
  supplierLotMissing: data.supplierLotMissing,
});

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

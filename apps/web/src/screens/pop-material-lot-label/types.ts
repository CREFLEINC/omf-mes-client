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

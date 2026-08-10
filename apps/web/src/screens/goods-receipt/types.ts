import type { components } from '@omf-mes/api-client';

/**
 * W-01-10 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **입하 전표를 읽고 입고 전표를 쓴다.** PR ①이 다루는 것은 읽기뿐이고
 * (`GET /logistics/inbound-receipts`·같은 경로의 `/lines`), 쓰기는 PR ②에서 붙는다.
 * 그래서 이 파일에는 **초안 타입이 아직 없다** — 쓰이지 않는 타입을 먼저 세우면
 * 어느 값이 실제로 화면에 있는지 읽을 수 없다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type InboundReceiptResponse = components['schemas']['InboundReceipt'];
type InboundReceiptLineResponse = components['schemas']['InboundReceiptLine'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 화면이 다루는 입하 전표 한 건.
 *
 * **계약 응답을 통째로 넓히지 않고 쓰는 값만 옮긴다.** 응답에는 차량 번호·입하장(도크)·
 * 예외 유형·승인 요청·접수자가 함께 오는데, 이 화면이 그리지도 보내지도 않는 값이다 —
 * 타입에 자리를 두지 않으면 그 번호가 화면으로 샐 경로도 없다(#44).
 *
 * `supplierId`·`plantId`는 이름을 푸는 열쇠다. **`plantId`는 뒤따르는 PR의 요청 조립이
 * 사용자에게 묻지 않고 여기서 가져가는 값이기도 하다**(계획 결정 8) — 원천 문서가 이 입고의
 * 근거이므로 공장도 그 전표의 값을 따른다.
 */
export interface IrView {
  inboundReceiptId: number;
  inboundReceiptNo: string;
  supplierId: number;
  plantId: number;
  receiptDatetime: string;
  /** 선택 필드는 전부 `null`로 모은다 — 키 없음과 `null`이 갈리면 대시 표기가 자리마다 달라진다. */
  deliveryNoteNo: string | null;
  statusCode: string;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toIrView = (data: InboundReceiptResponse): IrView => ({
  inboundReceiptId: data.inboundReceiptId,
  inboundReceiptNo: data.inboundReceiptNo,
  supplierId: data.supplierId,
  plantId: data.plantId,
  receiptDatetime: data.receiptDatetime,
  // `??`를 쓴다 — 빈 문자열은 서버가 보낸 값이라 `null`로 뭉개면 그 사실이 사라진다.
  deliveryNoteNo: data.deliveryNoteNo ?? null,
  statusCode: data.statusCode,
});

/**
 * 화면이 다루는 입하 라인 한 줄.
 *
 * **`lotId`가 이 화면의 갈림길이다**(계획 결정 5). 계약이 입고 라인의 `lotId`를 **필수**로
 * 두는데 입하 라인의 `lotId`는 **nullable**이라 값이 없으면 보낼 것이 없다. 그 판정은
 * `line-select.ts` 한 곳이 한다.
 *
 * `receivedQty`·`itemId`·`uomId`는 **입고 요청에 그대로 실린다**(계획 결정 4 — 전량 입고라
 * 수량 입력칸이 없다). 그 배선은 PR ②에 있고, 이 PR은 값을 보이는 것까지다.
 *
 * `inspectionRequired`·`statusCode`는 **고른 줄의 제목줄에서만** 보인다 — 열로 만들면
 * 표 하한을 넘긴다(계획 §5.5).
 */
export interface IrLineView {
  inboundReceiptLineId: number;
  inboundReceiptId: number;
  lineNo: number;
  itemId: number;
  receivedQty: number;
  uomId: number;
  expiryDate: string | null;
  /** **없을 수 있다.** 없으면 이 줄로 입고할 수 없다 — 그 판정은 `line-select.ts`가 한다. */
  lotId: number | null;
  inspectionRequired: boolean;
  statusCode: string;
}

/** 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toIrLineView = (data: InboundReceiptLineResponse): IrLineView => ({
  inboundReceiptLineId: data.inboundReceiptLineId,
  inboundReceiptId: data.inboundReceiptId,
  lineNo: data.lineNo,
  itemId: data.itemId,
  receivedQty: data.receivedQty,
  uomId: data.uomId,
  expiryDate: data.expiryDate ?? null,
  lotId: data.lotId ?? null,
  inspectionRequired: data.inspectionRequired,
  statusCode: data.statusCode,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface IrListResult {
  items: IrView[];
  page: PageMeta;
}

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부는 선택지를 거르는 데 쓰지 않고 표식을 붙이는 데 쓴다.** 지금은 쓰지 않는
 * 거래처를 참조하는 과거 입하가 실제로 있고, 미사용 값을 빼면 그 입하를 조건으로 찾을 방법이 사라진다.
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/** 계약의 date-time 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 입하일시 표기(`2026-08-06 09:12`).
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 자재가 실제로 도착한
 * 곳의 시각이고, 보는 사람의 시간대로 옮기면 같은 전표가 사람마다 다른 시각으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 —
 * 「—」로 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

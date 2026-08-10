import type { components } from '@omf-mes/api-client';

/**
 * W-01-03 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **발주를 읽고 입하를 쓴다.** PR ①이 다루는 것은 읽기 둘뿐이고
 * (`GET /logistics/purchase-orders`·같은 경로의 `/lines`), 쓰기는 PR ②에서 붙는다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type PurchaseOrderResponse = components['schemas']['PurchaseOrder'];
type PurchaseOrderLineResponse = components['schemas']['PurchaseOrderLine'];
type InboundReceiptResponse = components['schemas']['InboundReceipt'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 저장 갈래. **계약에서 끌어온다** — 손으로 적은 유니온은 계약이 갈래를 늘려도 조용히 남는다.
 *
 * **기본값을 두지 않는다**(이슈 §6). 세 갈래는 각각 다른 버튼이고, 무엇을 저장하는지는
 * 누르기 전에 정해져야 한다.
 */
export type SplitMode = components['schemas']['InboundReceiptSplitRequest']['mode'];

/**
 * 화면이 다루는 발주 한 건.
 *
 * **계약 응답을 통째로 넓히지 않고 쓰는 값만 옮긴다.** 응답에는 사업부·ERP 발주번호·
 * 승인 요청 번호가 함께 오는데 셋 다 이 화면이 그리지도 보내지도 않는 값이다 —
 * 타입에 자리를 두지 않으면 그 번호가 화면으로 샐 경로도 없다(#44).
 *
 * `supplierId`·`plantId`는 그리지 않지만 남긴다. 이름을 푸는 열쇠이고,
 * 뒤따르는 PR의 요청 조립이 **사용자에게 묻지 않고** 여기서 가져가는 값이다(계획 결정 8).
 */
export interface PoView {
  purchaseOrderId: number;
  purchaseOrderNo: string;
  supplierId: number;
  plantId: number;
  orderDate: string;
  /** 선택 필드는 전부 `null`로 모은다 — 키 없음과 `null`이 갈리면 대시 표기가 자리마다 달라진다. */
  expectedReceiptDate: string | null;
  statusCode: string;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toPoView = (data: PurchaseOrderResponse): PoView => ({
  purchaseOrderId: data.purchaseOrderId,
  purchaseOrderNo: data.purchaseOrderNo,
  supplierId: data.supplierId,
  plantId: data.plantId,
  orderDate: data.orderDate,
  // `??`를 쓴다 — 빈 문자열은 서버가 보낸 값이라 `null`로 뭉개면 그 사실이 사라진다.
  expectedReceiptDate: data.expectedReceiptDate ?? null,
  statusCode: data.statusCode,
});

/**
 * 화면이 다루는 발주 라인 한 줄.
 *
 * **초과를 판정할 수 있는 값이 이 스키마에만 있다**(계획 결정 2) — 발주 수량 ·
 * 누적 입하 수량 · 초과 허용치 셋이 함께 온다. 입하 예정 라인에는 예정 수량뿐이라
 * 무엇이 초과인지 가를 수 없다.
 *
 * **부족 허용치를 들이지 않는다.** 이 화면은 넘치는 쪽만 가른다 — 들이면 쓰지 않는 값이 남는다.
 */
export interface PoLineView {
  purchaseOrderLineId: number;
  purchaseOrderId: number;
  lineNo: number;
  itemId: number;
  orderedQty: number;
  uomId: number;
  /** 누적 입하 수량. 서버가 갱신하며 화면이 정하지 않는다 */
  receivedQty: number;
  /** 초과 허용치. 계약이 「이 값을 넘으면 초과 입하 분리로 간다」로 정의했다 */
  toleranceOverQty: number;
}

/** 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toPoLineView = (data: PurchaseOrderLineResponse): PoLineView => ({
  purchaseOrderLineId: data.purchaseOrderLineId,
  purchaseOrderId: data.purchaseOrderId,
  lineNo: data.lineNo,
  itemId: data.itemId,
  orderedQty: data.orderedQty,
  uomId: data.uomId,
  receivedQty: data.receivedQty,
  toleranceOverQty: data.toleranceOverQty,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface PoListResult {
  items: PoView[];
  page: PageMeta;
}

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부는 선택지를 거르는 데 쓰지 않고 표식을 붙이는 데 쓴다.** 지금은 쓰지 않는
 * 거래처를 참조하는 과거 발주가 실제로 있고, 미사용 값을 빼면 그 발주를 조건으로 찾을 방법이 사라진다.
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

/**
 * 라인 바깥의 초안 — **두 전표에 함께 실리는 머리 입력과 초과분에만 실리는 두 칸**이다.
 *
 * 라인 초안과 갈라 두는 이유는 되돌아가는 신호가 다르기 때문이다. 라인 초안은 라인 응답이
 * 오면 그 응답으로 새로 만들어지지만, 머리 입력은 **고른 발주가 바뀔 때만** 비워진다 —
 * 라인을 다시 부르는 것만으로 치던 비고가 사라지면 안 된다.
 *
 * **친 글자를 그대로 들고 있는다.** 날짜·시각을 `Date`로 강제해 들고 있으면 아직 완성되지 않은
 * 입력(`2026-08-0`)이 그 자리에서 사라진다.
 */
export interface HeaderDraft {
  /** `datetime-local` 입력의 값(`YYYY-MM-DDTHH:mm`). offset이 없어 보낼 때 붙인다 */
  receiptDatetime: string;
  deliveryNoteNo: string;
  remarks: string;
  /** 값 목록이 확정되지 않아 선택지가 비어 있다 — 지금은 늘 빈 문자열이다(계획 결정 14) */
  exceptionTypeCode: string;
  exceptionReason: string;
}

export const EMPTY_HEADER_DRAFT: HeaderDraft = {
  receiptDatetime: '',
  deliveryNoteNo: '',
  remarks: '',
  exceptionTypeCode: '',
  exceptionReason: '',
};

/**
 * 버릴 것이 있는가. 대상을 바꾸거나 취소할 때 확인을 받을지 정한다(계획 결정 10).
 *
 * **다섯 칸을 모두 본다.** 한 칸만 보면 나머지 넷에 친 값이 확인 없이 사라진다.
 * 공백만 친 칸은 버릴 값이 아니다 — 라인 수량(`hasAnyQty`)과 같은 기준이다.
 */
export const hasAnyHeaderValue = (header: HeaderDraft): boolean =>
  Object.values(header).some((text) => text.trim() !== '');

/**
 * 만들어진 전표 한 건 — **화면이 내는 값만 담는다.**
 *
 * `inboundReceiptNo`는 사용자가 나중에 이 전표를 찾을 때 쓰는 **업무 번호**라 내는 것이 맞다.
 * `inboundReceiptId`는 내부 번호(FK)이므로 타입에 자리를 두지 않는다 — 자리가 없으면
 * 결과 구획으로 샐 경로도 없다(#44). 이 구분이 이 화면에서 처음 갈리는 자리다.
 *
 * `statusCode`는 값으로 분기하지 않고 그대로 보인다(공유계약 G-2).
 */
export interface CreatedReceiptView {
  inboundReceiptNo: string;
  statusCode: string;
}

/** 등록 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCreatedReceiptView = (data: InboundReceiptResponse): CreatedReceiptView => ({
  inboundReceiptNo: data.inboundReceiptNo,
  statusCode: data.statusCode,
});

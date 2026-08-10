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

export type PageMeta = components['schemas']['PageMeta'];

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

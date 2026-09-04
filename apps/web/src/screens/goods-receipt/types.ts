import type { components } from '@omf-mes/api-client';

/**
 * W-01-10 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **입하 전표를 읽고 입고 전표를 쓴다.** 읽기는
 * `GET /logistics/inbound-receipts`·같은 경로의 `/lines`·창고·위치·자재 LOT이고,
 * 쓰기는 `POST /logistics/goods-receipts` 하나다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type InboundReceiptResponse = components['schemas']['InboundReceipt'];
type InboundReceiptLineResponse = components['schemas']['InboundReceiptLine'];
type WarehouseResponse = components['schemas']['Warehouse'];
type LocationResponse = components['schemas']['Location'];
type GoodsReceiptResponse = components['schemas']['GoodsReceipt'];
type GoodsReceiptLineResponse = components['schemas']['GoodsReceiptLine'];

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

/**
 * 화면이 다루는 창고 한 건.
 *
 * **`plantId`를 함께 들고 있는다.** 요청에 싣는 공장은 입하 전표의 값이지만(계획 결정 8),
 * 고른 창고의 공장을 **함께 보여** 어긋남이 눈에 보이게 한다. 막지는 않는다 — 어떤 조합이
 * 성립하는지 정한 규칙이 데이터에 없어 화면이 판정할 수 없다.
 *
 * **`isActive`를 담지 않는다.** 창고·위치 목록은 참조 풀이와 달리 `includeInactive`를 켜지
 * 않는다 — 지금 물건을 넣을 자리를 고르는 칸이라 쓰지 않는 창고가 선택지에 있을 이유가 없다.
 * 담을 값이 없으면 표식을 붙일 경로도 생기지 않는다.
 */
export interface WarehouseView {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  plantId: number;
}

export const toWarehouseView = (data: WarehouseResponse): WarehouseView => ({
  warehouseId: data.warehouseId,
  warehouseCode: data.warehouseCode,
  warehouseName: data.warehouseName,
  plantId: data.plantId,
});

/**
 * 화면이 다루는 적치 위치 한 자리.
 *
 * **`parentLocationId`가 이 타입의 요점이다.** 위치는 자기참조 계층이라(계약 실측)
 * 선택칸을 1단 그룹으로 접을 때 이 값이 그룹을 정한다 — 접는 규칙은 `location-options.ts`가 갖는다.
 */
export interface LocationView {
  locationId: number;
  parentLocationId: number | null;
  locationCode: string;
  locationName: string;
}

export const toLocationView = (data: LocationResponse): LocationView => ({
  locationId: data.locationId,
  parentLocationId: data.parentLocationId ?? null,
  locationCode: data.locationCode,
  locationName: data.locationName,
});

/** 값 목록이 확정되지 않은 코드 다섯. 선택지와 자리표시는 `code-options.ts`가 소유한다. */
export type GoodsReceiptCodeKey =
  'receiptType' | 'sourceDocumentType' | 'qualityStatus' | 'inventoryStatus' | 'reason';

/** 사용자가 고른 코드값. 아직 고르지 않은 것은 빈 문자열이다. */
export type CodeDraft = Record<GoodsReceiptCodeKey, string>;

/**
 * 화면에서 입력했으나 아직 보내지 않은 값.
 *
 * **주소에 싣지 않는다** — 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을
 * 같은 통로로 다루게 된다.
 *
 * **수량이 없다.** 전량 입고라 수량 입력칸을 두지 않고 입하 라인의 값을 그대로 싣는다
 * (계획 결정 4). 품목·단위·자재 LOT도 같은 이유로 여기 없다 — 초안에 자리를 두지 않으면
 * 사용자가 그 값을 바꿀 경로도 생기지 않는다.
 */
export interface ReceiptDraft {
  /** 창고·위치는 선택칸 값이라 문자열이다. 요청 조립이 번호로 옮긴다. */
  warehouse: string;
  location: string;
  codes: CodeDraft;
  receiptDatetime: string;
  remarks: string;
}

export const EMPTY_CODE_DRAFT: CodeDraft = {
  receiptType: '',
  sourceDocumentType: '',
  qualityStatus: '',
  inventoryStatus: '',
  reason: '',
};

export const EMPTY_RECEIPT_DRAFT: ReceiptDraft = {
  warehouse: '',
  location: '',
  codes: EMPTY_CODE_DRAFT,
  receiptDatetime: '',
  remarks: '',
};

/**
 * 버릴 것이 있는가. **모든 칸을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다.
 */
export const hasAnyDraftValue = (draft: ReceiptDraft): boolean =>
  draft.warehouse !== '' ||
  draft.location !== '' ||
  draft.receiptDatetime !== '' ||
  draft.remarks.trim() !== '' ||
  Object.values(draft.codes).some((value) => value !== '');

/**
 * 입고 처리 결과 — **화면이 증거를 가진 것만 담는다.**
 *
 * **내부 번호를 담지 않는다**(#44). `goodsReceiptId`·`goodsReceiptLineId`·`lotId`·
 * `inventoryTransactionLineId`의 자리가 이 타입에 없으므로 결과 구획으로 샐 경로도 없다.
 * `goodsReceiptNo`는 사용자가 나중에 이 전표를 찾을 때 쓰는 업무 번호라 담는 것이 맞다 —
 * 이 구분이 이 화면에서 갈리는 자리다.
 *
 * 원장은 **유무만** 담는다. 번호를 담으면 내야 할 것이 없는데 낼 수 있게 된다.
 */
export interface GoodsReceiptResultView {
  goodsReceiptNo: string;
  statusCode: string;
  /** 계약이 원천 문서를 비울 수 있게 했다(2026-08-31 확정). 이 화면은 늘 입하 전표를 원천으로 보내지만, 응답을 지어내지 않는다 */
  sourceDocumentTypeCode: string | null;
  /** 응답의 `erpMessageQueued`. **키가 없을 수 있어** `undefined`를 그대로 나른다. */
  erpMessageQueued: boolean | undefined;
  lineCount: number;
  ledgerLineCount: number;
}

/**
 * **원천 문서의 「번호」를 여기 담지 않는다.** 응답이 주는 것은 내부 식별자뿐이고 사용자가
 * 읽는 번호는 이 화면이 고른 입하 전표의 입하번호다 — 그 값은 결과가 그려지는 순간에도
 * 화면에 그대로 있으므로(성공해도 고른 전표를 유지한다) 결과에 복사해 두지 않고 그때 읽는다.
 */
export const toGoodsReceiptResultView = (
  goodsReceipt: GoodsReceiptResponse,
  lines: readonly GoodsReceiptLineResponse[],
): GoodsReceiptResultView => ({
  goodsReceiptNo: goodsReceipt.goodsReceiptNo,
  statusCode: goodsReceipt.statusCode,
  sourceDocumentTypeCode: goodsReceipt.sourceDocumentTypeCode ?? null,
  erpMessageQueued: goodsReceipt.erpMessageQueued,
  lineCount: lines.length,
  /* `null`과 키 없음을 함께 「원장 라인이 없다」로 센다 — 둘 다 낼 번호가 없다는 뜻이다. */
  ledgerLineCount: lines.filter(
    (line) =>
      line.inventoryTransactionLineId !== undefined && line.inventoryTransactionLineId !== null,
  ).length,
});

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

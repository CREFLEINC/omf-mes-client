import type { components } from '@omf-mes/api-client';

/**
 * W-01-06 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 화면은 **폐기 대상을 입고 전표에서 골라 출고 전표(폐기 품의)를 만들고 상신한다.**
 * **이 회차(PR ②)까지에도 쓰기가 없다** — 대상 전표를 고르고 **그 전표의 어느 줄을 얼마나
 * 폐기할지 정하는** 데까지다.
 *
 * **대상의 원천이 입고 전표인 이유**(계획 결정 2): 계약이 요구하는 출고 라인 한 줄은
 * 품목·자재 LOT·수량·단위·출발 위치 다섯이 전부 필수인데, 재고 잔액은 축 하나만 채워 내려
 * (`groupBy`가 LOT이면 위치가 비고, LOCATION이면 LOT이 빈다) 다섯을 채울 수 없다.
 * 입고 라인은 다섯을 그대로 준다 — 적치 목적지가 곧 폐기 출고의 출발 위치다.
 *
 * **이 회차의 타입은 입고 전표 헤더·라인과 재고 잔액까지다.** 출고 전표·승인 요청의 화면
 * 타입은 그 값을 실제로 읽는 회차에서 생긴다 — 미리 두면 아무도 지나지 않는 변환기가 남는다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type ReceiptResponse = components['schemas']['GoodsReceipt'];
export type ReceiptLineResponse = components['schemas']['GoodsReceiptLine'];
export type BalanceResponse = components['schemas']['InventoryBalance'];
export type WarehouseResponse = components['schemas']['Warehouse'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 화면이 다루는 입고 전표 한 건.
 *
 * **계약 응답을 통째로 넓히지 않고 쓰는 값만 옮긴다.** 응답에는 공장·원천 문서 유형과
 * 식별자·사유·비고·ERP 적재 여부가 함께 오는데, 이 화면이 그리지도 보내지도 않는 값이다 —
 * 타입에 자리를 두지 않으면 그 번호가 화면으로 샐 경로도 없다(`omf-mes#44`).
 *
 * `warehouseId`가 두 가지 일을 한다 — 목록의 창고 이름을 푸는 열쇠이고, **그 전표의 라인이
 * 놓인 창고**라 뒤 회차의 위치 이름 조회와 잔액 조회의 조건이 된다.
 *
 * **`sourceDocumentId`를 담지 않는다.** 품의를 만들 때 계약이 요구하는 `sourceDocumentId`는
 * **이 입고 전표 자신**(`goodsReceiptId`)이지 입고 전표가 가리키는 앞 문서가 아니다 —
 * 앞 문서를 담아 두면 그 값을 요청에 실어 보내는 잘못된 길이 열린다.
 */
export interface ReceiptView {
  goodsReceiptId: number;
  goodsReceiptNo: string;
  receiptTypeCode: string;
  warehouseId: number;
  receiptDatetime: string;
  statusCode: string;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toReceiptView = (data: ReceiptResponse): ReceiptView => ({
  goodsReceiptId: data.goodsReceiptId,
  goodsReceiptNo: data.goodsReceiptNo,
  receiptTypeCode: data.receiptTypeCode,
  warehouseId: data.warehouseId,
  receiptDatetime: data.receiptDatetime,
  statusCode: data.statusCode,
});

/**
 * 화면이 다루는 입고 라인 한 줄.
 *
 * **폐기 라인이 요구하는 다섯이 여기 다 있다** — `itemId`·`lotId`·`receiptQty`·`uomId`·
 * `destinationLocationId`. 계약이 그 다섯을 전부 필수로 두었고, 적치 목적지가 곧 폐기 출고의
 * 출발 위치다(계획 결정 2).
 *
 * **품질·재고 상태를 담지 않는다.** 「이 줄을 폐기할 수 있는가」를 **상태 코드로 판정하지
 * 않기** 때문이다(공유계약 G-2 · `line-select.ts`) — 자리를 두면 그 값으로 가르는 길이 열린다.
 *
 * **줄번호·원장 라인 번호도 담지 않는다.** 서버가 부여한 순번은 사용자에게 뜻이 적고
 * (계획 §5.5 — 열을 늘리는 것보다 줄이는 것이 먼저다), 원장 라인은 낼 것이 번호밖에 없다.
 * 「전기됐는가」를 원장 라인 유무로 판정하는 자리는 **출고 라인**이지 입고 라인이 아니다.
 */
export interface ReceiptLineView {
  goodsReceiptLineId: number;
  itemId: number;
  lotId: number;
  receiptQty: number;
  uomId: number;
  destinationLocationId: number;
}

/** 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toReceiptLineView = (data: ReceiptLineResponse): ReceiptLineView => ({
  goodsReceiptLineId: data.goodsReceiptLineId,
  itemId: data.itemId,
  lotId: data.lotId,
  receiptQty: data.receiptQty,
  uomId: data.uomId,
  destinationLocationId: data.destinationLocationId,
});

/** 잔액 줄이 묶인 축. **계약이 닫아 둔 열거**라 화면이 읽어도 뜻을 지어내는 것이 아니다. */
export type BalanceGroupBy = BalanceResponse['groupBy'];

/**
 * 화면이 다루는 재고 잔액 한 줄. **폐기 수량의 상한을 만드는 데만 쓴다** — 목록으로 그리지 않는다.
 *
 * **가용 수량(`availableQty`)에 자리를 두지 않는다**(계획 결정 4 · 완료 조건 C23).
 * 그 값은 보유에서 예약·피킹·**보류**를 뺀 것인데, 폐기 대상은 바로 그 **보류·차단된 재고**일
 * 가능성이 크다 — 상한으로 쓰면 **폐기해야 할 것을 화면이 막는다.** 타입에 자리가 없으면
 * 나중에 그 값을 집어 오는 경로도 없다.
 *
 * 예약·피킹·보류 수량과 소유·품질·재고 상태 코드도 담지 않는다. 이 화면의 판단(얼마까지
 * 폐기할 수 있는가)에 쓰이지 않고, 코드는 값 목록이 확정되지 않아 해석할 수도 없다.
 */
export interface BalanceView {
  /**
   * 이 줄이 묶인 축.
   *
   * **담는 이유는 상한이 축을 건너뛰지 못하게 하기 위해서다**(`on-hand.ts`). 계약은 축을
   * 한 번에 하나만 채워 내리고 `lotId`도 「LOT일 때 채워진다」로 두었는데, 축이 `ITEM`인 줄은
   * **그 품목의 전 LOT을 합친 값**이다 — 그것을 한 LOT의 상한으로 쓰면 상한이 실제보다
   * 몇 배 느슨해진다. 값 목록이 확정되지 않은 코드와 달리 이 축은 **계약이 닫아 둔 열거**라
   * 읽는 것이 뜻을 지어내는 것이 아니다(공유계약 G-2가 막는 자리가 아니다).
   */
  groupBy: BalanceGroupBy;
  /**
   * 어느 자재 LOT의 잔액인가. **`groupBy`가 LOT이 아닌 줄에는 오지 않는다**(계약) —
   * 그래서 없음을 없음으로 옮긴다. `?? 0`으로 메우면 **0번 LOT의 잔액**이라는 없는 사실이
   * 만들어지고, 그것이 어느 줄의 상한으로 읽힐 수 있다.
   */
  lotId: number | null;
  onHandQty: number;
  /**
   * 그 수량의 단위. **비교하기 전에 라인의 단위와 같은지 본다** — 다르면 100과 5를 견주는
   * 셈이 되고, 화면에는 단위를 옮기는 수단이 없다.
   */
  uomId: number;
}

/** 잔액 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toBalanceView = (data: BalanceResponse): BalanceView => ({
  groupBy: data.groupBy,
  lotId: data.lotId ?? null,
  onHandQty: data.onHandQty,
  uomId: data.uomId,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface ReceiptListResult {
  items: ReceiptView[];
  page: PageMeta;
}

/**
 * 상세 조회 결과. **헤더와 라인이 한 번에 온다**(`GoodsReceiptDetailResponse`) —
 * 라인을 따로 부르지 않는 이유가 이것이고, **라인 목록에 쪽 정보가 없어** 전건이 온다.
 */
export interface ReceiptDetailResult {
  receipt: ReceiptView;
  lines: ReceiptLineView[];
}

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부는 선택지를 거르는 데 쓰지 않고 표식을 붙이는 데 쓴다.** 지금은 쓰지 않는
 * 창고를 참조하는 과거 입고가 실제로 있고, 미사용 값을 빼면 그 입고를 조건으로 찾을 방법이 사라진다.
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

/**
 * 창고 항목. **유형 코드를 함께 나른다.**
 *
 * 폐기 대상은 불량 판정을 받아 들어온 자재가 놓인 창고에서 나오는데, **화면은 어느 창고가
 * 그 창고인지 판정할 수 없다** — 창고 유형의 값 목록이 확정되지 않았기 때문이다(계획 결정 2·8).
 * 그래서 유형 코드를 **읽어 두기만** 하고, 자리표시가 채워지는 순간 선택지를 좁히는 데 쓴다
 * (`code-options.ts`의 `DEFECT_WAREHOUSE_TYPE_CODES` · 전환 감지기).
 *
 * **값으로 분기하지 않는다** — 지금 이 코드는 「좁힐 수 있는가」를 묻는 자리에만 들어간다.
 */
export interface WarehouseEntry extends LookupEntry {
  warehouseTypeCode: string;
}

/**
 * 자재 LOT 항목. **보류 여부를 함께 나른다.**
 *
 * 폐기해도 LOT 보류는 그대로 유지되므로 사용자가 그 사실을 아는 자리가 화면에 있어야 한다.
 * **표식은 표시일 뿐이며 선택을 막지 않는다** — 보류·차단된 자재를 덜어 내는 것이 이 화면의
 * 주 용도이고, 막으면 폐기해야 할 것을 화면이 막는 셈이 된다(계획 결정 4와 같은 논거).
 */
export interface LotEntry extends LookupEntry {
  held: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/** 계약의 date-time 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 입고 일시 표기(`2026-08-06 09:12`).
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 자재가 실제로 들어온 곳의
 * 시각이고, 보는 사람의 시간대로 옮기면 같은 전표가 사람마다 다른 시각으로 보인다.
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

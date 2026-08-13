import type { components } from '@omf-mes/api-client';

/**
 * W-01-06 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 화면은 **폐기 대상을 입고 전표에서 골라 출고 전표(폐기 품의)를 만들고 상신한다.**
 * **이 회차(PR ①)에는 쓰기가 없다** — 대상이 될 입고 전표를 조건으로 좁혀 고르는 데까지다.
 *
 * **대상의 원천이 입고 전표인 이유**(계획 결정 2): 계약이 요구하는 출고 라인 한 줄은
 * 품목·자재 LOT·수량·단위·출발 위치 다섯이 전부 필수인데, 재고 잔액은 축 하나만 채워 내려
 * (`groupBy`가 LOT이면 위치가 비고, LOCATION이면 LOT이 빈다) 다섯을 채울 수 없다.
 * 입고 라인은 다섯을 그대로 준다 — 적치 목적지가 곧 폐기 출고의 출발 위치다.
 *
 * **이 회차의 타입은 입고 전표 헤더까지다.** 라인·잔액·출고 전표·승인 요청의 화면 타입은
 * 그 값을 실제로 읽는 회차에서 생긴다 — 미리 두면 아무도 지나지 않는 변환기가 남는다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type ReceiptResponse = components['schemas']['GoodsReceipt'];
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

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface ReceiptListResult {
  items: ReceiptView[];
  page: PageMeta;
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

import type { components } from '@omf-mes/api-client';

/**
 * W-01-05 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 화면은 **입고 전표를 읽고 출고 전표를 쓴다.** 읽기는 `GET /logistics/goods-receipts`·
 * 같은 경로의 상세·재고 잔액·참조 여섯이고, 쓰기는 `POST /logistics/goods-issues` 하나다.
 * **이 회차(PR ①)에는 쓰기가 없다** — 대상 전표와 그 라인을 읽는 데까지다.
 *
 * **대상의 원천이 입고 전표인 이유**(계획 결정 2): 계약이 요구하는 반품 라인 한 줄은
 * 품목·자재 LOT·수량·단위·출발 위치 다섯이 전부 필수인데, 재고 잔액은 축 하나만 채워 내려
 * (`groupBy`가 LOT이면 위치가 비고, LOCATION이면 LOT이 빈다) 다섯을 채울 수 없다.
 * 입고 라인은 다섯을 그대로 준다 — 적치 목적지가 곧 반품의 출발 위치다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type ReceiptResponse = components['schemas']['GoodsReceipt'];
export type ReceiptLineResponse = components['schemas']['GoodsReceiptLine'];
export type BalanceResponse = components['schemas']['InventoryBalance'];
export type IssueResponse = components['schemas']['GoodsIssue'];
export type IssueLineResponse = components['schemas']['GoodsIssueLine'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 화면이 다루는 입고 전표 한 건.
 *
 * **계약 응답을 통째로 넓히지 않고 쓰는 값만 옮긴다.** 응답에는 공장·원천 문서 유형과
 * 식별자·사유·비고·ERP 적재 여부가 함께 오는데, 이 화면이 그리지도 보내지도 않는 값이다 —
 * 타입에 자리를 두지 않으면 그 번호가 화면으로 샐 경로도 없다(#44).
 *
 * `warehouseId`가 두 가지 일을 한다 — 목록·제목줄의 창고 이름을 푸는 열쇠이고,
 * **그 전표의 라인이 놓인 창고**라 위치 이름 조회와 잔액 조회의 조건이 된다.
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
 * **반품 라인이 요구하는 다섯이 여기 다 있다** — `itemId`·`lotId`·`receiptQty`·`uomId`·
 * `destinationLocationId`. 계약이 그 다섯을 전부 필수로 두었고, 적치 목적지가 곧 반품의
 * 출발 위치다(계획 결정 2).
 *
 * **줄번호를 담지 않는다.** 서버가 부여한 순번이라 사용자에게 뜻이 적고, 이 표에서 줄을
 * 식별하는 것은 품목과 자재 LOT이다(계획 §5.5 — 열을 늘리는 것보다 줄이는 것이 먼저다).
 *
 * **품질·재고 상태와 원장 라인 번호도 담지 않는다.** 이 화면의 판단(무엇을 되돌려 보낼까)에
 * 쓰이지 않고, 원장 라인은 낼 것이 번호밖에 없다.
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

/**
 * 화면이 다루는 재고 잔액 한 줄. **반품 수량의 상한을 만드는 데만 쓴다** — 목록으로 그리지 않는다.
 *
 * **가용 수량(`availableQty`)에 자리를 두지 않는다**(계획 결정 9 · 완료 조건 C34).
 * 그 값은 보유에서 예약·피킹·**보류**를 뺀 것인데, 보류된 자재 LOT을 되돌려 보내는 것이 이
 * 화면의 주 용도다 — 상한으로 쓰면 **반품해야 할 것을 화면이 막는다.** 타입에 자리가 없으면
 * 나중에 그 값을 집어 오는 경로도 없다.
 *
 * 예약·피킹·보류 수량과 소유·품질·재고 상태 코드도 담지 않는다. 이 화면의 판단(얼마까지
 * 되돌려 보낼 수 있는가)에 쓰이지 않고, 코드는 값 목록이 확정되지 않아 해석할 수도 없다.
 */
export interface BalanceView {
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
 * 자재 LOT 항목. **보류 여부를 함께 나른다.**
 *
 * 반품해도 LOT 보류는 그대로 유지되므로(착수 이슈 §6) 사용자가 그 사실을 아는 자리가 화면에
 * 있어야 한다. **표식은 표시일 뿐이며 선택을 막지 않는다** — 보류된 LOT을 되돌려 보내는 것이
 * 이 화면의 주 용도다.
 */
export interface LotEntry extends LookupEntry {
  held: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 반품 정보가 받는 코드 **넷** — 계약이 요청 필수로 요구하는 것들이다.
 *
 * **조회 조건의 코드 둘(입고 유형·상태)과 갈라 둔다.** 둘은 비어 있어도 아무것도 막지 않지만
 * 이 넷은 하나라도 비면 **반품 처리 전체**가 막힌다. 한 타입으로 뭉치면 초안이 쓰지 않는
 * 키까지 들고 다니게 되고, 「무엇이 필수인가」가 자료 구조에서 읽히지 않는다.
 *
 * 선택지를 만드는 쪽(`code-options.ts`)이 이 타입을 넓혀 여섯을 다룬다 — 반대 방향으로 두면
 * 타입 파일이 선택지 파일을 참조해 서로를 부르게 된다.
 */
export type ReturnCodeKey = 'issueType' | 'sourceDocumentType' | 'destinationType' | 'reason';

/**
 * 반품 정보 초안 — **아직 보내지 않은 입력**이다(수명 표의 「반품 정보 초안」 열).
 *
 * **주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을 같은
 * 통로로 다루게 된다.
 *
 * **친 글자를 그대로 들고 있는다** — 번호로 강제해 들고 있으면 「고르지 않음」과 「0번」이
 * 구분되지 않는다. 번호로 옮기는 자리는 요청 조립 한 곳이다(`issue-request.ts`).
 */
export interface ReturnDraft {
  /** 고른 공급사의 번호를 글자로. 빈 문자열이 「아직 고르지 않았다」다. */
  readonly supplier: string;
  readonly codes: Readonly<Record<ReturnCodeKey, string>>;
  /** `YYYY-MM-DD`. 달력 컨트롤이 이 모양으로만 방출한다. */
  readonly issuedDate: string;
  /** `HH:mm`. 시각 입력칸이 이 모양으로만 방출한다. */
  readonly issuedTime: string;
  readonly replacementExpected: boolean;
  readonly sendToErp: boolean;
  readonly remarks: string;
}

/**
 * 빈 초안.
 *
 * **`sendToErp`만 참으로 시작한다** — 착수 이슈 §4가 「송신 토글은 두되 기본값을 켜짐으로
 * 고정」하라고 적었고 계약의 기본값도 참이다. 나머지는 전부 비어 있다: **출고 일시를 지금
 * 시각으로 미리 채우지 않는다.** 채우면 사용자가 확인하지 않은 시각이 되돌릴 수 없는 전표에
 * 실리고, 어제 나간 것을 오늘 등록하는 흔한 경우에 조용히 틀린다.
 */
export const EMPTY_RETURN_DRAFT: ReturnDraft = {
  supplier: '',
  codes: { issueType: '', sourceDocumentType: '', destinationType: '', reason: '' },
  issuedDate: '',
  issuedTime: '',
  replacementExpected: false,
  sendToErp: true,
  remarks: '',
};

/**
 * 버릴 것이 있는가. **모든 칸을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다.
 *
 * `sendToErp`는 **기본값에서 달라졌을 때만** 초안으로 센다. 늘 참으로 시작하므로 그대로 두면
 * 「아무것도 넣지 않았는데 버릴 것이 있다」가 되어 파기 확인 창이 늘 뜬다.
 */
export const hasAnyReturnDraftValue = (draft: ReturnDraft): boolean =>
  draft.supplier !== '' ||
  Object.values(draft.codes).some((code) => code !== '') ||
  draft.issuedDate !== '' ||
  draft.issuedTime !== '' ||
  draft.replacementExpected ||
  !draft.sendToErp ||
  draft.remarks !== '';

/**
 * 만들어진 반품 전표의 줄 하나. **서버가 되돌려 준 값이다** — 화면이 보낸 값을 되비추지 않는다.
 *
 * `goodsIssueLineId`·`goodsIssueId`·`lineNo`를 담지 않는다. 앞 둘은 내부 번호라 낼 것이
 * 아니고(#44), 줄번호는 서버가 부여한 순번이라 사용자에게 뜻이 적다(라인 표에도 없다).
 */
export interface ReturnResultLineView {
  itemId: number;
  lotId: number;
  issueQty: number;
  uomId: number;
}

/**
 * 반품 처리 결과 — **화면이 확인한 것만 담는다**(계획 결정 13).
 *
 * 담지 않는 것: 내부 번호(`goodsIssueId`) · 재고 차감량 · 전기 완료 여부. 앞의 것은 #44이고
 * 뒤의 둘은 **응답에 없다** — 자리를 두지 않으면 화면이 확인하지 않은 것을 말할 경로도 없다.
 *
 * `statusCode`는 **그대로 담고 값으로 분기하지 않는다**(공유계약 G-2). 목이
 * `postImmediately: true`에도 `DRAFT`를 되돌려 주는 것이 실측됐다 — 값으로 「전기 완료」를
 * 판정했다면 그 자리에서 거짓말을 한다.
 */
export interface ReturnResultView {
  goodsIssueNo: string;
  statusCode: string;
  /**
   * ERP 송신 대기열 적재 여부. **계약이 선택 필드로 두어 오지 않을 수 있다** —
   * `?? true`로 접으면 아무 근거 없이 「적재됐다」로 읽힌다. 없음을 없음으로 옮긴다.
   */
  erpMessageQueued: boolean | null;
  lines: ReturnResultLineView[];
}

/** 응답 한 벌을 결과 타입으로 옮기는 **유일한 지점**이다. */
export const toReturnResultView = (
  issue: IssueResponse,
  lines: readonly IssueLineResponse[],
): ReturnResultView => ({
  goodsIssueNo: issue.goodsIssueNo,
  statusCode: issue.statusCode,
  erpMessageQueued: issue.erpMessageQueued ?? null,
  lines: lines.map((line) => ({
    itemId: line.itemId,
    lotId: line.lotId,
    issueQty: line.issueQty,
    uomId: line.uomId,
  })),
});

/*
 * **창고 전용 화면 타입을 두지 않는다.**
 *
 * 이 화면에서 창고는 **이름으로만** 쓰인다 — 조건 줄의 선택지 · 목록 표의 칸 · 제목줄, 셋 다
 * 「코드 · 이름」 한 줄이다. 그 변환은 참조 풀이가 이미 하고 있으므로(`lookups.ts`의
 * `useWarehouseOptions`) 중간 타입을 하나 더 두면 **지나지 않는 변환기**가 남는다.
 * 계획 §4.1의 PR ②·③ 표에도 창고를 값으로 다루는 자리가 없다(공급사는 거래처에서 고른다).
 */

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

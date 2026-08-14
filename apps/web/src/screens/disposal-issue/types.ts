import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * W-01-06 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 화면은 **폐기 대상을 입고 전표에서 골라 출고 전표(폐기 요청)를 만들고 승인을 요청한다.**
 * **이 회차(PR ④)에 쓰기가 둘 생긴다** — 전표 생성과 승인 요청이며, 사용자 조작은 「승인 요청」
 * 한 번이다(승인 기록 정정 1-1). 기타출고 처리(전기)는 뒤 회차다.
 *
 * **대상의 원천이 입고 전표인 이유**(계획 결정 2): 계약이 요구하는 출고 라인 한 줄은
 * 품목·자재 LOT·수량·단위·출발 위치 다섯이 전부 필수인데, 재고 잔액은 축 하나만 채워 내려
 * (`groupBy`가 LOT이면 위치가 비고, LOCATION이면 LOT이 빈다) 다섯을 채울 수 없다.
 * 입고 라인은 다섯을 그대로 준다 — 적치 목적지가 곧 폐기 출고의 출발 위치다.
 *
 * **이 회차의 타입은 입고 전표 헤더·라인 · 재고 잔액 · 출고 전표 헤더·라인 · 승인 요청까지다.**
 * 쓰기 본문(등록·상신·전기)의 타입은 그 요청을 실제로 보내는 회차에서 생긴다 — 미리 두면
 * 아무도 지나지 않는 변환기가 남는다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

const t = messages.disposalIssue;

export type ReceiptResponse = components['schemas']['GoodsReceipt'];
export type ReceiptLineResponse = components['schemas']['GoodsReceiptLine'];
export type BalanceResponse = components['schemas']['InventoryBalance'];
export type WarehouseResponse = components['schemas']['Warehouse'];

/** 출고 전표(= 폐기 요청) 헤더와 라인. **이 화면이 만들고 처리하는 전표다.** */
export type IssueResponse = components['schemas']['GoodsIssue'];
export type IssueLineResponse = components['schemas']['GoodsIssueLine'];

/**
 * 승인 요청 상세. **결재선 진행을 단계 배열로 함께 내린다** — 계약이 그렇게 적었고,
 * 그래서 단계 전용 조회를 만들지 않는다.
 */
export type ApprovalRequestDetailResponse = components['schemas']['ApprovalRequestDetail'];
export type ApprovalStepResponse = components['schemas']['ApprovalStep'];

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
 * 화면이 다루는 출고 전표(= 폐기 요청) 한 건.
 *
 * **`approvalRequestId`를 담는 이유가 이 타입의 요점이다.** 「이 전표의 승인을 요청했는가」를
 * **그 값이 있는가로만** 판정하고(계획 결정 7 · 공유계약 G-2), 있으면 그 값을 **그대로**
 * 승인 요청 조회의 경로 조각으로 옮긴다(결정 10). 값이 없으면 부르지 않는다 —
 * `?? 0`으로 메우면 **0번 요청**을 여는 요청이 나간다.
 *
 * **화면에는 그 번호가 나가지 않는다**(`omf-mes#44`). 조회에만 쓰이고, 사용자가 보는 것은
 * 조회로 얻은 승인 요청**번호**(`AP-…`)다.
 *
 * **도착지 짝을 담는다**(변경 통지 #128 · 완료 조건 C27). 앞 회차까지 담지 않던 값이다 —
 * 낼 것이 **번호밖에 없었기** 때문이다. 이제 그 번호를 이름으로 푸는 조회가 생겨(`lookups.ts`의
 * `usePartnerNames`) ③ 구획이 「누가 가져가는가」를 「코드 · 이름」으로 말한다. **번호를 화면에
 * 내려고 담는 것이 아니다** — 번호는 이름을 맞춰 보는 데만 쓰이고 어느 표기에도 담기지 않는다.
 *
 * **원천 문서를 담지 않는다.** 이 화면이 그리지도 보내지도 않는 값이고 낼 것이 번호밖에 없다.
 * **대체 입고 예정(`replacementExpected`)도 담지 않는다** — 반품 축이다.
 */
export interface IssueView {
  goodsIssueId: number;
  goodsIssueNo: string;
  issueTypeCode: string;
  /** 그 전표가 나간 창고. 이름 풀이와 **그 전표 라인의 위치 이름 조회**의 조건이 된다. */
  sourceWarehouseId: number;
  issuedAt: string;
  statusCode: string;
  /** 폐기 사유 코드. 계약이 선택으로 두어 **없이 오는 전표가 실재한다.** */
  reasonCode: string | null;
  /**
   * 도착지 짝 — **함께 있거나 함께 없다**(#128 ⛔ · 한쪽만 보내면 서버가 400을 낸다).
   *
   * 둘 다 없으면 **자체 폐기**다. 「아직 안 골랐다」와 갈리지 않느냐는 물음이 여기서는 서지
   * 않는다 — 저장된 전표에는 고르는 중인 상태가 없다.
   *
   * **유형 코드를 뜻으로 해석하지 않는다.** 값 목록이 확정되지 않아 화면이 뜻을 붙이면 값이
   * 정해질 때 조용히 틀린다 — 담는 이유는 「짝이 있는가」를 두 값으로 함께 보기 위해서다.
   */
  destinationTypeCode: string | null;
  destinationId: number | null;
  /** 상신 여부의 **유일한 근거**. 없으면 아직 결재에 올라가지 않은 전표다. */
  approvalRequestId: number | null;
  /**
   * ERP 송신 **대기열에 적재**됐는가. 계약이 「적재이지 전송이 아니다」라고 못 박았다 —
   * 화면도 「전송됨」이라 적지 않는다. 계약이 선택으로 두어 **오지 않는 갈래가 따로 있다.**
   */
  erpMessageQueued: boolean | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toIssueView = (data: IssueResponse): IssueView => ({
  goodsIssueId: data.goodsIssueId,
  goodsIssueNo: data.goodsIssueNo,
  issueTypeCode: data.issueTypeCode,
  sourceWarehouseId: data.sourceWarehouseId,
  issuedAt: data.issuedAt,
  statusCode: data.statusCode,
  reasonCode: data.reasonCode ?? null,
  /* 짝을 **함께** 옮긴다 — 한쪽만 옮기면 「도착지가 있는데 누구인지 모른다」를 가릴 수 없다. */
  destinationTypeCode: data.destinationTypeCode ?? null,
  destinationId: data.destinationId ?? null,
  approvalRequestId: data.approvalRequestId ?? null,
  erpMessageQueued: data.erpMessageQueued ?? null,
});

/**
 * 화면이 다루는 출고 라인 한 줄.
 *
 * **원장 라인 번호를 담는다** — 「이 줄이 전기됐는가」를 그 값의 유무로만 판정하기 때문이다
 * (계획 결정 7). 계약이 그 필드를 「전기로 생긴 원장 라인」이라 적었고, 상태 코드로 판정하면
 * 조용히 틀린다: 목이 전기 뒤에도 초안 상태를 그대로 주는 것이 실측됐다.
 * **화면에 나가는 것은 번호가 아니라 표식이다**(`omf-mes#44`).
 *
 * **줄번호·전표 번호·피킹 라인은 담지 않는다.** 서버가 부여한 순번은 사용자에게 뜻이 적고
 * (계획 §5.5), 피킹은 생산 불출 축이라 폐기 품의에 오지 않는다.
 */
export interface IssueLineView {
  goodsIssueLineId: number;
  itemId: number;
  lotId: number;
  issueQty: number;
  uomId: number;
  sourceLocationId: number;
  inventoryTransactionLineId: number | null;
}

/** 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toIssueLineView = (data: IssueLineResponse): IssueLineView => ({
  goodsIssueLineId: data.goodsIssueLineId,
  itemId: data.itemId,
  lotId: data.lotId,
  issueQty: data.issueQty,
  uomId: data.uomId,
  sourceLocationId: data.sourceLocationId,
  inventoryTransactionLineId: data.inventoryTransactionLineId ?? null,
});

/** 이력 목록 조회 결과. */
export interface IssueListResult {
  items: IssueView[];
  page: PageMeta;
}

/**
 * 출고 상세 조회 결과. **헤더와 라인이 한 번에 온다**(`GoodsIssueDetailResponse`).
 * 라인 전용 경로가 계약에 있으나 부르면 같은 값을 한 번 더 받는다.
 */
export interface IssueDetailResult {
  issue: IssueView;
  lines: IssueLineView[];
}

/**
 * 헤더와 라인을 함께 주는 응답을 화면 타입으로 옮기는 **유일한 지점**이다.
 *
 * **상세 조회와 전표 생성이 같은 모양을 돌려준다**(계약 실측 — 둘 다 `GoodsIssueDetailResponse`).
 * 옮기기를 자리마다 손으로 적으면 한쪽만 고쳐져 **방금 만든 전표와 다시 읽은 전표가 서로 다른
 * 값을 보이게** 된다 — 이 화면에서 그 둘은 같은 전표다.
 */
export const toIssueDetailResult = (data: {
  goodsIssue: IssueResponse;
  lines: IssueLineResponse[];
}): IssueDetailResult => ({
  issue: toIssueView(data.goodsIssue),
  lines: data.lines.map(toIssueLineView),
});

/**
 * 폐기 요청 정보 폼이 다루는 코드 셋.
 *
 * **셋이 전부 계약의 등록 필수 자리다**(계획 결정 8) — 값 목록이 비어 있는 동안 이 화면으로는
 * 폐기 요청을 올릴 수 없다. 조회 조건의 코드는 이 union에 들지 않는다(`code-options.ts`가
 * 넓혀 쓴다) — 비어 있어도 아무것도 막지 않아 성질이 다르다.
 *
 * **다섯에서 셋으로 줄었다**(변경 통지 #124·#128). 폐기 계정은 회계 소관이라 MES가 다루지
 * 않고, 도착지 유형은 짝인 도착지 식별자를 공급할 자리가 함께 사라져 **한쪽만 실린 전표**가
 * 만들어지지 않게 같이 없앴다 — 잠긴 칸으로 남기지 않고 **정의째** 없앤다.
 */
export type DisposalCodeKey = 'issueType' | 'sourceDocumentType' | 'reason';

/**
 * 폐기 요청 정보 초안 — **아직 보내지 않은 입력**이다(수명 표의 「폐기」 열).
 *
 * **요청 사유가 여기 함께 있는 것이 이 화면의 형태다**(승인 기록 정정 1-1). 사용자 조작이
 * 「승인 요청」 하나이고 그 한 번에 전표 생성과 승인 요청이 잇달아 나가므로, 사유는 **보내기
 * 전에 이 폼에서 받는다.** 이력 탭의 재요청은 자기 초안을 따로 갖는다 — 매인 대상이 다르기
 * 때문이다(이쪽은 고른 입고 전표, 그쪽은 고른 폐기 요청).
 *
 * **주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을 같은
 * 통로로 다루게 된다.
 *
 * **친 글자를 그대로 들고 있는다** — 번호로 강제해 들고 있으면 「고르지 않음」과 「0번」이
 * 구분되지 않는다. 번호로 옮기는 자리는 요청 조립 한 곳이다(`issue-request.ts`).
 */
export interface DisposalDraft {
  readonly codes: Readonly<Record<DisposalCodeKey, string>>;
  /** `YYYY-MM-DD`. 달력 컨트롤이 이 모양으로만 방출한다. */
  readonly issuedDate: string;
  /** `HH:mm`. 시각 입력칸이 이 모양으로만 방출한다. */
  readonly issuedTime: string;
  readonly remarks: string;
  /**
   * **자체 폐기인가**(외부 업체 없음) — 변경 통지 #128.
   *
   * 체크와 거래처 선택이 **함께 있어야 하는 이유**가 이 자리다. 「아직 안 골랐다」와
   * 「자체 폐기라 없다」는 나가는 본문에서 똑같이 「도착지 두 키가 없음」으로 보이므로,
   * 체크가 없으면 화면이 그 둘을 가를 수 없다 — 그래서 통지가 체크박스를 뺄 수 없다고 적었다.
   */
  readonly isSelfDisposal: boolean;
  /**
   * 고른 폐기 거래처. **선택지의 값 그대로**(문자열)를 들고 있는다 — 번호로 강제해 들고 있으면
   * 「고르지 않음」과 「0번」이 구분되지 않는다. 번호로 옮기는 자리는 요청 조립 한 곳이다
   * (`issue-request.ts`의 `readDisposalDestination`).
   *
   * **자체 폐기를 체크하면 비어 있다**(`withSelfDisposal`) — 체크와 값이 함께 남는 조합은
   * 존재하지 않는다.
   */
  readonly disposalPartnerId: string;
  /**
   * 요청 사유. **결재함 목록에서 첫 줄이 요약을 겸한다**(공유계약 A-12 보강 · 계약 명시).
   *
   * **최소 길이를 화면이 정하지 않는다**(승인 기록 §13-6 안 A). 정해진 규칙이 다르면 정당한
   * 사유가 막히고, 글자 수를 화면이 지어내는 것이 된다 — 막는 것은 빈 값과 공백만이고
   * 나머지는 자리표시 문구·보조 문구·확인 창이 **유도**한다.
   */
  readonly reason: string;
}

/**
 * 빈 초안.
 *
 * **미리 채우는 값이 하나도 없다.** 출고 일시를 지금 시각으로 채우면 사용자가 확인하지 않은
 * 시각이 되돌릴 수 없는 전표에 실리고, 어제 폐기한 것을 오늘 올리는 흔한 경우에 조용히 틀린다.
 */
export const EMPTY_DISPOSAL_DRAFT: DisposalDraft = {
  codes: {
    issueType: '',
    sourceDocumentType: '',
    reason: '',
  },
  issuedDate: '',
  issuedTime: '',
  remarks: '',
  /* **미리 체크하지 않는다.** 자체 폐기는 사용자가 정하는 사실이지 화면의 기본값이 아니다. */
  isSelfDisposal: false,
  disposalPartnerId: '',
  reason: '',
};

/**
 * 자체 폐기 체크를 반영한 초안 — **체크하면 고른 거래처를 함께 비운다**(변경 통지 #128 문면).
 *
 * 값을 남긴 채 칸만 잠그면 「체크했는데 거래처가 실린」 초안이 남고, 그 초안은 짝을 만드는
 * 자리에서 어느 쪽으로도 읽힐 수 있다. **그 조합이 아예 만들어지지 않게** 전이를 이 함수
 * 하나로 모은다 — 화면 핸들러에서 손으로 비우면 다른 경로에서 한쪽만 바뀐다.
 *
 * 체크를 풀 때 **비운 값을 되살리지 않는다.** 되살리려면 지운 값을 어딘가 들고 있어야 하는데,
 * 그것은 「체크하면 값을 비운다」와 같은 말이 아니다.
 */
export const withSelfDisposal = (draft: DisposalDraft, isSelfDisposal: boolean): DisposalDraft =>
  isSelfDisposal
    ? { ...draft, isSelfDisposal: true, disposalPartnerId: '' }
    : { ...draft, isSelfDisposal: false };

/**
 * 버릴 것이 있는가. **모든 칸을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다.
 *
 * 「입력 지우기」가 줄 초안과 이 초안을 **함께** 버리므로, 판정도 두 자리에서 함께 나와야
 * 「지울 것이 없다」는 잠금이 실제와 어긋나지 않는다(`line-draft.ts`의 짝).
 */
export const hasAnyDisposalDraftValue = (draft: DisposalDraft): boolean =>
  Object.values(draft.codes).some((code) => code !== '') ||
  draft.issuedDate !== '' ||
  draft.issuedTime !== '' ||
  draft.remarks !== '' ||
  draft.isSelfDisposal ||
  draft.disposalPartnerId !== '' ||
  draft.reason !== '';

/**
 * 사람이 읽는 이름 — **이름 자리가 전부 이 판정 하나를 지난다.**
 *
 * 상신자·승인자 이름은 계약이 필수로 두었으나 **빈 문자열도 공백만인 값도 스키마를
 * 통과한다.** 그때 화면은 번호를 대신 내지 않고 그 사실을 적는다(`omf-mes#44`).
 *
 * **판정을 한 자리에 두는 이유**: 자리마다 따로 적으면 한쪽은 `=== ''`이고 다른 쪽은
 * `.trim()`이 되어, 같은 요청이 어디서는 빈 칸으로 어디서는 안내로 보인다.
 *
 * **이름 안의 공백은 건드리지 않는다.** 판정에만 다듬기를 쓰고 값은 실려 온 그대로 낸다.
 */
export const readableName = (value: string, whenMissing: string): string =>
  value.trim() === '' ? whenMissing : value;

/**
 * 상신 사유 **전문**을 줄 단위로 나눈다.
 *
 * **줄바꿈이 뜻을 나른다.** 계약이 승인 요청의 업무 값을 사유 **하나**로 두어(수량·금액
 * 컬럼이 물리 모델에 없다) 상신자가 여러 줄로 근거를 적는다 — 한 줄로 이어 붙이면 문단
 * 구분이 사라져 무엇이 무엇의 근거인지 읽을 수 없다.
 *
 * **가운데 빈 줄과 줄 안의 공백을 건드리지 않는다** — 문단 구분과 들여쓴 목록이 사유의
 * 일부다. 걷어 내는 것은 CRLF의 캐리지 리턴뿐이며 그것은 글자가 아니라 줄바꿈의 일부다.
 *
 * **자르거나 줄이지 않는다.** 이 화면은 사유의 전문을 보는 자리다.
 */
export const toReasonLines = (reason: string): string[] =>
  reason.trim() === '' ? [t.values.emptyReason] : reason.split(/\r?\n/);

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

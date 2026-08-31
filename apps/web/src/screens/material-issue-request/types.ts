import type { components } from '@omf-mes/api-client';

/**
 * W-02-10 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * `shipment-request-create`·`disposal-issue`도 라인 초안과 전표 생성을 다루지만, 형태가 같아도
 * 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type WorkOrderResponse = components['schemas']['WorkOrder'];
type ShortageLineResponse = components['schemas']['MaterialIssueShortageLine'];
type MaterialIssueRequestResponse = components['schemas']['MaterialIssueRequest'];
type MaterialIssueRequestDetailResponse =
  components['schemas']['MaterialIssueRequestDetailResponse'];

export type MaterialIssueRequestCreate = components['schemas']['MaterialIssueRequestCreate'];
export type MaterialIssueRequestCreateLine =
  components['schemas']['MaterialIssueRequestCreateLine'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 대상 W/O 한 줄.
 *
 * ⭐ **상세를 따로 부르지 않는다.** 목록 응답의 `WorkOrder` 에 `defaultWipLocationId`·`itemCode`·
 * `routingOperationName`·`orderQty`·`uomId` 가 전부 실린다(계약 실측).
 */
export interface WorkOrderView {
  workOrderId: number;
  workOrderNo: string;
  itemId: number;
  /** 목록 표시용. 계약이 선택 필드라 없을 수 있다 */
  itemCode: string | null;
  orderQty: number;
  uomId: number;
  routingOperationName: string | null;
  /** 값으로 분기하지 않고 그대로 보인다(공유계약 G-2) */
  workOrderTypeCode: string;
  /** 도착 위치를 자동으로 채우는 유일한 단서. 없는 W/O 에서는 사용자가 고른다 */
  defaultWipLocationId: number | null;
}

export const toWorkOrderView = (data: WorkOrderResponse): WorkOrderView => ({
  workOrderId: data.workOrderId,
  workOrderNo: data.workOrderNo,
  itemId: data.itemId,
  itemCode: data.itemCode ?? null,
  orderQty: data.orderQty,
  uomId: data.uomId,
  routingOperationName: data.routingOperationName ?? null,
  workOrderTypeCode: data.workOrderTypeCode,
  defaultWipLocationId: data.defaultWipLocationId ?? null,
});

export interface WorkOrderListResult {
  items: WorkOrderView[];
  page: PageMeta;
}

/**
 * 한 W/O 의 품목별 소요·기출고·부족 한 줄.
 *
 * ⛔ **화면이 셋을 다시 계산하지 않는다**(공유계약 L-2). `shortageQty` 는 서버가 낸다.
 */
export interface ShortageLineView {
  itemId: number;
  /** BOM 유래면 원본 구성요소. BOM 밖 품목이면 `null` */
  bomComponentId: number | null;
  uomId: number;
  requiredQty: number;
  issuedQty: number;
  shortageQty: number;
}

export const toShortageLineView = (data: ShortageLineResponse): ShortageLineView => ({
  itemId: data.itemId,
  bomComponentId: data.bomComponentId ?? null,
  uomId: data.uomId,
  requiredQty: data.requiredQty,
  issuedQty: data.issuedQty,
  shortageQty: data.shortageQty,
});

/**
 * 같은 W/O 앞으로 이미 발행된 요청 한 줄.
 *
 * ⚠ 「미출고」를 가려내지 못한다 — `statusCode` 값 목록이 미정이라 문자열로 거를 수 없고,
 * 목록 응답에는 라인(`issuedQty`)이 실리지 않는다(계약 실측). 그래서 **거르지 않고 전부** 보인다.
 */
export interface ExistingRequestView {
  materialIssueRequestId: number;
  issueRequestNo: string;
  /** 서버가 준 글자 그대로(공유계약 G-2) */
  statusCode: string;
  requiredAt: string | null;
}

/**
 * 기존 요청 조회 결과.
 *
 * **건수와 목록을 갈라 든다** — 목록은 첫 쪽뿐이고 건수는 전체다. 둘을 같은 값으로 쓰면 요청이
 * 쌓인 W/O 에서 경고가 실제보다 적은 수를 말한다.
 */
export interface ExistingRequestListResult {
  items: ExistingRequestView[];
  total: number;
}

export const toExistingRequestView = (data: MaterialIssueRequestResponse): ExistingRequestView => ({
  materialIssueRequestId: data.materialIssueRequestId,
  issueRequestNo: data.issueRequestNo,
  statusCode: data.statusCode,
  requiredAt: data.requiredAt ?? null,
});

/** 방금 발행한 요청 — 결과 카드가 그리는 것 전부다. */
export interface CreatedRequestView {
  issueRequestNo: string;
  /** 서버가 준 글자 그대로(공유계약 G-2) — 「완료」로 옮겨 적지 않는다 */
  statusCode: string;
  lineCount: number;
}

/** 발행 응답은 헤더와 라인을 함께 준다(`MaterialIssueRequestDetailResponse` 실측). */
export const toCreatedRequestView = (
  data: MaterialIssueRequestDetailResponse,
): CreatedRequestView => ({
  issueRequestNo: data.materialIssueRequest.issueRequestNo,
  statusCode: data.materialIssueRequest.statusCode,
  lineCount: data.lines.length,
});

/**
 * 요청 품목 한 줄의 초안 — 아직 보내지 않은 입력이다.
 *
 * **친 글자를 그대로 들고 있는다**(`requestedQty: string`). 숫자로 강제해 들고 있으면 지우는
 * 도중에 값이 튄다.
 *
 * ⛔ **라인 「비고」 자리를 두지 않는다.** 계약 `MaterialIssueRequestCreateLine` 은
 * `bomComponentId`·`itemId`·`requestedQty`·`uomId` 넷뿐이라 담을 자리가 없다 — 칸을 만들면
 * 사용자가 친 글자가 조용히 버려진다. 비고는 머리의 `remarks` 하나다.
 */
export interface MaterialIssueLineDraft {
  /** 안정 키. 서버로 나가지 않는다 — 표의 `getRowId`가 쓴다 */
  key: string;
  /** 어디서 온 줄인가. 「불러오기」 재실행이 `manual` 줄을 살려 두는 기준이다 */
  origin: 'shortage' | 'manual';
  /** BOM 유래 판정의 값. `bom-origin.ts` 한 곳에서만 채운다 */
  bomComponentId: number | null;
  itemId: string;
  uomId: string;
  /** 서버가 낸 소요·기출고·부족. 손으로 더한 줄은 셋 다 `null` */
  requiredQty: number | null;
  issuedQty: number | null;
  shortageQty: number | null;
  requestedQty: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

import type { components } from '@omf-mes/api-client';

/**
 * P-02-13 의 검사 대기 큐가 그리는 값.
 *
 * **계약 응답을 그대로 그리지 않는다.** 계약의 `InspectionRequest` 는 화면이 쓰지 않는 필드를
 * 함께 싣고, 표가 그것들을 알면 계약이 필드를 하나 더할 때마다 표가 흔들린다. 뷰 타입이
 * 그 사이를 끊는다.
 *
 * ⚠ **이름이 아니라 번호를 그린다.** 계약은 품목·LOT·작업지시를 **식별자(정수)** 로만 준다 —
 * 이름 문자열이 응답에 없다. 참조 조회를 얹어 이름을 채우는 길도 있으나 두지 않는다:
 * 그 조회의 좁힘·잘림·실패 규칙이 이 표에 함께 따라오고, 대기 큐가 그것 때문에 비어 보일 수
 * 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type InspectionRequestResponse = components['schemas']['InspectionRequest'];
export type InspectionResultResponse = components['schemas']['InspectionResult'];
export type PageMetaResponse = components['schemas']['PageMeta'];

/** 표의 한 줄. 좌측 큐가 좁아 **고르는 데 필요한 것만** 싣는다(화면 스펙 §3). */
export interface InspectionQueueRow {
  inspectionRequestId: number;
  inspectionRequestNo: string;
  inspectionTypeCode: string;
  statusCode: string;
  /** 이 검사가 붙은 작업지시. 없을 수 있다 — 계약이 nullable 로 둔다. */
  workOrderId: number | null;
  lotId: number | null;
  itemId: number;
  targetQty: number;
  /** RFC3339. 표시 형식은 그리는 쪽이 정한다 — 여기서 문자열을 깎지 않는다. */
  requestedAt: string;
}

export interface InspectionQueueResult {
  rows: InspectionQueueRow[];
  page: PageMetaResponse;
}

/** **선택 필드는 `null` 로 모은다** — `undefined` 와 섞이면 그리는 쪽이 둘 다 다뤄야 한다. */
export const toInspectionQueueRow = (item: InspectionRequestResponse): InspectionQueueRow => ({
  inspectionRequestId: item.inspectionRequestId,
  inspectionRequestNo: item.inspectionRequestNo,
  inspectionTypeCode: item.inspectionTypeCode,
  statusCode: item.statusCode,
  workOrderId: item.workOrderId ?? null,
  lotId: item.lotId ?? null,
  itemId: item.itemId,
  targetQty: item.targetQty,
  requestedAt: item.requestedAt,
});

export const toInspectionQueueResult = (response: {
  items: InspectionRequestResponse[];
  page: PageMetaResponse;
}): InspectionQueueResult => ({
  rows: response.items.map(toInspectionQueueRow),
  page: response.page,
});

/**
 * 고른 의뢰의 상세 — 스펙 §4-A.
 *
 * ⚠ **검사기준 버전을 반드시 보인다.** 검사 시점의 기준 버전이 그 검사에 **고정되고**,
 * 이후 기준이 바뀌어도 이 검사는 당시 버전으로 남는다. 감추면 검사자도, 나중에 결과를
 * 읽는 사람도 어느 기준으로 잰 값인지 알 수 없다.
 */
export interface InspectionRequestDetail {
  inspectionRequestId: number;
  inspectionRequestNo: string;
  /**
   * ⚠ 검사 시점에 고정되는 기준 버전. **비어 있을 수 있다** — 검사 기준이 등록되지 않은
   * 상태에서도 검사한다는 확정이 있어(2026-07-15), 기준 없이 만들어진 의뢰가 이 칸을 비운
   * 채 온다. 비면 화면이 **두 번째 갈래**로 간다(§5-2 · 통지 #589).
   *
   * ⚠ 생성 타입은 아직 이 칸을 필수로 잡고 있다(계약은 옵셔널로 바뀌었으나 재생성이 전
   * 도메인을 함께 끌어와 이 이슈에서 돌리지 않았다). **런타임에는 비어 올 수 있으므로**
   * 여기서 없음으로 접는다.
   */
  inspectionPlanVersionId: number | null;
  workOrderId: number | null;
  lotId: number | null;
  itemId: number;
  targetQty: number;
  uomId: number;
  statusCode: string;
  requestedAt: string;
  /** 이 검사가 대표하는 생산 구간(§5-5). 아직 정해지지 않았으면 `null` */
  coverageFromAt: string | null;
  coverageToAt: string | null;
}

export const toInspectionRequestDetail = (
  item: InspectionRequestResponse,
): InspectionRequestDetail => ({
  inspectionRequestId: item.inspectionRequestId,
  inspectionRequestNo: item.inspectionRequestNo,
  inspectionPlanVersionId: item.inspectionPlanVersionId ?? null,
  workOrderId: item.workOrderId ?? null,
  lotId: item.lotId ?? null,
  itemId: item.itemId,
  targetQty: item.targetQty,
  uomId: item.uomId,
  statusCode: item.statusCode,
  requestedAt: item.requestedAt,
  coverageFromAt: item.coverageFromAt ?? null,
  coverageToAt: item.coverageToAt ?? null,
});

/**
 * 검사 결과 한 회차.
 *
 * **회차는 정정하지 않는다** — 재검사는 이전 회차를 고치는 것이 아니라 새 회차를 쌓고
 * `previousResultId` 로 사슬을 잇는다(공유계약 B-10 · 스펙 §6). 그래서 이 뷰는 회차를
 * **읽기 값**으로 나른다.
 */
export interface InspectionResultRound {
  inspectionResultId: number;
  inspectionRound: number;
  inspectedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  overallJudgmentCode: string;
  /** `작성중` · `확정` — 확정된 회차는 더 고치지 않는다 */
  statusCode: string;
  confirmedAt: string | null;
  previousResultId: number | null;
  /** 자유 입력. **기준 없는 갈래**가 쓰는 자리다(§5-2) */
  remarks: string;
}

export const toInspectionResultRound = (item: InspectionResultResponse): InspectionResultRound => ({
  inspectionResultId: item.inspectionResultId,
  inspectionRound: item.inspectionRound,
  inspectedQty: item.inspectedQty,
  acceptedQty: item.acceptedQty,
  rejectedQty: item.rejectedQty,
  heldQty: item.heldQty,
  overallJudgmentCode: item.overallJudgmentCode,
  statusCode: item.statusCode,
  confirmedAt: item.confirmedAt ?? null,
  previousResultId: item.previousResultId ?? null,
  remarks: item.remarks ?? '',
});

/**
 * 회차 목록에서 **지금 편집할 회차**를 고른다 — 가장 큰 회차 하나다.
 *
 * 서버가 주는 차례를 믿지 않고 **회차 번호로 고른다** — 목록의 정렬이 계약에 적혀 있지 않다.
 */
export const latestRound = (rounds: InspectionResultRound[]): InspectionResultRound | null =>
  rounds.reduce<InspectionResultRound | null>(
    (latest, round) =>
      latest === null || round.inspectionRound > latest.inspectionRound ? round : latest,
    null,
  );

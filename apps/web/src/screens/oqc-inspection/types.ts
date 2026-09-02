import type { components } from '@omf-mes/api-client';

/**
 * W-04-03 이 그리는 값 — **계약 응답을 그대로 그리지 않는다.**
 *
 * 계약의 `InspectionRequest` 는 이 화면이 쓰지 않는 필드를 함께 싣고(`workOrderId`·
 * `productionResultId`·`coverageFromAt` 등), 표가 그것들을 알면 계약이 필드를 하나 더할 때마다
 * 표가 흔들린다. 뷰 타입이 그 사이를 끊는다.
 *
 * ⚠ **이름이 아니라 번호를 그린다.** 계약은 품목·LOT·단위를 **식별자(정수)** 로만 준다 —
 * 이름 문자열이 응답에 없다. 참조 조회를 얹어 이름을 채우는 길도 있으나 두지 않는다: 그
 * 조회의 좁힘·잘림·실패 규칙이 이 화면에 함께 따라오고, 대상 목록·상세가 그것 때문에 비어
 * 보일 수 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type InspectionRequestResponse = components['schemas']['InspectionRequest'];
export type InspectionResultResponse = components['schemas']['InspectionResult'];
export type PageMetaResponse = components['schemas']['PageMeta'];

/**
 * 표의 한 줄 — **스펙 §3 이 한 줄에 두 행으로 그린 정보다.**
 *
 * ⚠ **대상 LOT 을 싣지 않는다** — 좁은 창에 비슷한 번호를 둘 늘어놓으면 고르는 데 오히려
 * 방해가 된다. LOT 은 고른 뒤 상세 창이 보인다.
 *
 * ⛔ **회차·검사일을 싣지 못한다** — 계약의 `InspectionRequest` 에 그 둘이 없다(회차와 검사
 * 시각은 «결과»의 값이다). 이 축에서 그리려면 줄마다 결과를 따로 부르거나 축을 결과로 옮겨야
 * 하는데, 뒤쪽은 **아직 판정하지 않은 의뢰가 목록에서 사라지는** 길이라 이 화면이 할 일과
 * 정면으로 어긋난다. 설계 회신 대기(`omf-mes#322`).
 */
export interface InspectionQueueRow {
  /** 행 선택의 열쇠. 계약이 정수로 준다. */
  inspectionRequestId: number;
  /** 사람이 읽고 부르는 번호. 검색(`q`)도 이 값을 훑는다. */
  inspectionRequestNo: string;
  /** 다형 참조의 대상. 줄의 둘째 행에 선다 */
  targetId: number;
  /** 품목 식별자. **코드 문자열이 아니다** — 계약이 정수만 준다(파일 머리 참조). */
  itemId: number;
  /** 검사 수량. 합계 제약의 오른쪽 변이 될 값이다 */
  targetQty: number;
  statusCode: string;
}

export interface InspectionQueueResult {
  rows: InspectionQueueRow[];
  page: PageMetaResponse;
}

export const toInspectionQueueRow = (item: InspectionRequestResponse): InspectionQueueRow => ({
  inspectionRequestId: item.inspectionRequestId,
  inspectionRequestNo: item.inspectionRequestNo,
  targetId: item.targetId,
  itemId: item.itemId,
  targetQty: item.targetQty,
  statusCode: item.statusCode,
});

export const toInspectionQueueResult = (response: {
  items: InspectionRequestResponse[];
  page: PageMetaResponse;
}): InspectionQueueResult => ({
  rows: response.items.map(toInspectionQueueRow),
  page: response.page,
});

/** 계약의 `date-time` 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 일시 표기(`2026-08-18 09:15`).
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset 은 그 일이 일어난 곳의
 * 시각이고, 보는 사람의 시간대로 옮기면 같은 의뢰가 사람마다 다른 시각에 온 것으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 — 「—」로
 * 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/**
 * 고른 의뢰의 상세 — **스펙 §4-A 의 항목들이다.**
 *
 * ⚠ **적용 기준(검사기준 버전)을 반드시 보인다.** 검사 시점의 기준 버전이 그 검사에 **고정되고**
 * 이후 기준이 바뀌어도 이 검사는 당시 버전으로 남는다. 화면이 버전을 감추면 검사자는 자기가
 * 어느 기준으로 재고 있는지 알 수 없고, 나중에 결과를 다시 읽는 사람도 알 수 없다.
 *
 * ⭐ **그 칸이 널일 수 있다**(계약 required 완화 · client#589). 비어도 진행을 막지 않되
 * 「없는 값」을 「못 읽은 값」과 **다른 모양**으로 그린다(공유계약 G-9).
 */
export interface InspectionRequestDetail {
  inspectionRequestId: number;
  inspectionRequestNo: string;
  inspectionTypeCode: string;
  /** ⚠ 다형 참조의 유형. 값 목록이 아직 미정이라 **코드 그대로** 보인다 */
  targetTypeCode: string;
  targetId: number;
  /** ⚠ 검사 시점에 고정되는 기준 버전. 널이면 전용 문구로 그린다 */
  inspectionPlanVersionId: number | null;
  lotId: number | null;
  itemId: number;
  /** 합계 제약의 오른쪽 변 */
  targetQty: number;
  /** ⚠ 정수만 온다 — 표시명이 없어 수량을 단위 없이 그린다 */
  uomId: number;
  statusCode: string;
  requestedAt: string;
}

export const toInspectionRequestDetail = (
  item: InspectionRequestResponse,
): InspectionRequestDetail => ({
  inspectionRequestId: item.inspectionRequestId,
  inspectionRequestNo: item.inspectionRequestNo,
  inspectionTypeCode: item.inspectionTypeCode,
  targetTypeCode: item.targetTypeCode,
  targetId: item.targetId,
  /* 선택 필드를 `null` 로 모은다 — `undefined` 와 섞이면 그리는 쪽이 두 가지를 다 다뤄야 한다. */
  inspectionPlanVersionId: item.inspectionPlanVersionId ?? null,
  lotId: item.lotId ?? null,
  itemId: item.itemId,
  targetQty: item.targetQty,
  uomId: item.uomId,
  statusCode: item.statusCode,
  requestedAt: item.requestedAt,
});

/**
 * 검사 결과 한 회차.
 *
 * **회차는 정정하지 않는다** — 재검사는 이전 회차를 고치는 것이 아니라 새 회차를 쌓고
 * `previousResultId` 로 사슬을 잇는다(§5-3). 그래서 이 뷰는 회차를 **읽기 값**으로 나른다.
 */
export interface InspectionResultRound {
  inspectionResultId: number;
  inspectionRound: number;
  inspectedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  overallJudgmentCode: string;
  /** `작성중` · `확정` — 이 화면은 「확정」만 쓰지만 다른 단말이 남긴 「작성중」이 올 수 있다 */
  statusCode: string;
  confirmedAt: string | null;
  previousResultId: number | null;
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
});

/**
 * 회차 목록에서 **지금 화면이 다루는 회차**를 고른다 — 가장 큰 회차 하나다.
 *
 * 그것이 확정이면 이 의뢰는 판정이 끝난 것이라 **새 회차(재검사)** 로 가야 한다. 회차가 하나도
 * 없으면 아직 아무도 판정하지 않은 의뢰다.
 *
 * 서버가 주는 차례를 믿지 않고 **회차 번호로 고른다** — 목록의 정렬이 계약에 적혀 있지 않다.
 */
export const latestRound = (rounds: InspectionResultRound[]): InspectionResultRound | null =>
  rounds.reduce<InspectionResultRound | null>(
    (latest, round) =>
      latest === null || round.inspectionRound > latest.inspectionRound ? round : latest,
    null,
  );

/**
 * 이력에 실을 차례 — **회차 번호 오름차순**이다. `Stepper` 는 배열 순서를 진행 순서로 읽으므로
 * 1회차가 앞이어야 한다.
 *
 * ⛔ 서버가 준 순서를 그대로 쓰지 않는다 — 목록의 정렬이 계약에 적혀 있지 않다.
 */
export const orderedRounds = (rounds: InspectionResultRound[]): InspectionResultRound[] =>
  rounds.slice().sort((left, right) => left.inspectionRound - right.inspectionRound);

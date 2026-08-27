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

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 의뢰 일시 표기(`2026-08-18 09:15`).
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset 은 의뢰가 일어난 곳의
 * 시각이고, 보는 사람의 시간대로 옮기면 같은 의뢰가 사람마다 다른 시각에 온 것으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다** — 「—」로 바꾸면 값이 없는 것과 못 알아본 것이
 * 구분되지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

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
  inspectionTypeCode: string;
  /** ⚠ 검사 시점에 고정되는 기준 버전. 화면 표시 필수(§4-A) */
  inspectionPlanVersionId: number;
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
  inspectionTypeCode: item.inspectionTypeCode,
  inspectionPlanVersionId: item.inspectionPlanVersionId,
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

/**
 * 최신 회차를 뺀 **이전 회차들**. 큰 회차가 앞에 온다.
 *
 * ⭐ 최신을 **회차 번호로 고른 뒤 식별자로 뺀다.** 번호로 빼면 같은 번호가 둘 있을 때
 * (서버가 잘못 준 상황) 둘 다 사라져 화면에서 이력이 조용히 짧아진다 — 식별자로 빼면
 * 하나만 빠지고 나머지는 눈에 보인다.
 */
export const previousRounds = (rounds: InspectionResultRound[]): InspectionResultRound[] => {
  const latest = latestRound(rounds);

  return rounds
    .filter((round) => round.inspectionResultId !== latest?.inspectionResultId)
    .slice()
    .sort((left, right) => right.inspectionRound - left.inspectionRound);
};

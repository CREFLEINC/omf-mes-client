import type { components } from '@omf-mes/api-client';

/**
 * W-01-01 의 검사 대기 큐가 그리는 값.
 *
 * **계약 응답을 그대로 그리지 않는다.** 계약의 `InspectionRequest` 는 화면이 쓰지 않는 필드를
 * 함께 싣고(`inspectionPlanVersionId`·`targetTypeCode`·`productionResultId` 등), 표가 그것들을
 * 알면 계약이 필드를 하나 더할 때마다 표가 흔들린다. 뷰 타입이 그 사이를 끊는다.
 *
 * ⚠ **이름이 아니라 번호를 그린다.** 계약은 품목·자재 LOT 을 **식별자(정수)** 로만 준다 —
 * 이름 문자열이 응답에 없다. 참조 조회를 얹어 이름을 채우는 길도 있으나 두지 않는다:
 * 그 조회의 좁힘·잘림·실패 규칙이 이 표에 함께 따라오고, 대기 큐가 그것 때문에 비어 보일 수
 * 있다. 전례가 같은 판단을 적어 두었다(`document-progress/queries.ts` 「참조 조회를 두지 않는다」).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type InspectionRequestResponse = components['schemas']['InspectionRequest'];
export type InspectionResultResponse = components['schemas']['InspectionResult'];
export type PageMetaResponse = components['schemas']['PageMeta'];

/** 표의 한 줄. 좌측 큐가 약 1/3 폭이라 **고르는 데 필요한 것만** 싣는다(화면 스펙 §3). */
export interface InspectionQueueRow {
  /** 행 선택의 열쇠. 계약이 정수로 준다. */
  inspectionRequestId: number;
  /** 사람이 읽고 부르는 번호. 검색(`q`)도 이 값을 훑는다. */
  inspectionRequestNo: string;
  inspectionTypeCode: string;
  statusCode: string;
  /** 자재 LOT 식별자. **번호 문자열이 아니다** — 계약이 정수만 준다(파일 머리 참조). */
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

/**
 * 계약 응답 한 건을 표의 한 줄로 옮긴다.
 *
 * **선택 필드는 `null` 로 모은다.** 계약에서 `lotId` 는 없을 수 있고(작업지시 대상 검사 등),
 * `undefined` 와 `null` 이 섞이면 그리는 쪽이 두 가지를 다 다뤄야 한다.
 */
export const toInspectionQueueRow = (item: InspectionRequestResponse): InspectionQueueRow => ({
  inspectionRequestId: item.inspectionRequestId,
  inspectionRequestNo: item.inspectionRequestNo,
  inspectionTypeCode: item.inspectionTypeCode,
  statusCode: item.statusCode,
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

/** 계약의 `date-time` 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 의뢰 일시 표기(`2026-08-18 09:15`).
 *
 * **시각까지 낸다.** 대기 큐에서는 같은 날 올라온 의뢰들의 앞뒤가 곧 처리 차례를 읽는
 * 단서다 — 날짜만 내면 그 순서가 사라진다.
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset 은 의뢰가 일어난 곳의
 * 시각이고, 보는 사람의 시간대로 옮기면 같은 의뢰가 사람마다 다른 시각에 온 것으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 — 「—」로
 * 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * **형식을 새로 짓지 않았다.** 이 저장소가 여러 화면에서 쓰는 규칙 그대로다(연·월·일 + 시·분).
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/**
 * 고른 의뢰의 상세 — **스펙 §4-A 의 여섯 항목이다.**
 *
 * ⚠ **검사기준 버전을 반드시 보인다.** 검사 시점의 기준 버전이 그 검사에 **고정되고**,
 * 이후 기준이 바뀌어도 이 검사는 당시 버전으로 남는다(§4-A). 화면이 버전을 감추면 검사자는
 * 자기가 어느 기준으로 재고 있는지 알 수 없고, 나중에 결과를 다시 읽는 사람도 알 수 없다.
 */
export interface InspectionRequestDetail {
  inspectionRequestId: number;
  inspectionRequestNo: string;
  inspectionTypeCode: string;
  /** ⚠ 검사 시점에 고정되는 기준 버전. 화면 표시 필수(§4-A) */
  inspectionPlanVersionId: number;
  lotId: number | null;
  itemId: number;
  /** 입하 등록 수량. 합계 제약의 오른쪽 변이다 */
  targetQty: number;
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
  inspectionPlanVersionId: item.inspectionPlanVersionId,
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
 * 회차 목록에서 **지금 편집할 회차**를 고른다.
 *
 * ⭐ **가장 큰 회차 하나다.** 그것이 `작성중` 이면 이어서 쓰고, `확정` 이면 이 의뢰는 이미
 * 판정이 끝난 것이라 **새 회차(재검사)** 로 가야 한다 — 이전 회차를 고치지 않는다(§5-3).
 * 회차가 하나도 없으면 아직 아무도 손대지 않은 의뢰다.
 *
 * 서버가 주는 차례를 믿지 않고 **회차 번호로 고른다** — 목록의 정렬이 계약에 적혀 있지 않다.
 */
export const latestRound = (rounds: InspectionResultRound[]): InspectionResultRound | null =>
  rounds.reduce<InspectionResultRound | null>(
    (latest, round) =>
      latest === null || round.inspectionRound > latest.inspectionRound ? round : latest,
    null,
  );

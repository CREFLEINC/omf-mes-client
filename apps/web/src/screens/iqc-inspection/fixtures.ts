import type { CodeValueResponse } from './code-options';
import type { InspectionItemSpecResponse, InspectionMeasurementResponse } from './measurement-rows';
import type {
  InspectionRequestResponse,
  InspectionResultResponse,
  PageMetaResponse,
} from './types';

/**
 * 검사 대기 큐의 시험용 자료.
 *
 * ⛔ **전부 지어낸 값이다.** 이 저장소는 공개이므로 실제 사번·품목코드·LOT 번호·거래처 코드를
 * 픽스처에 넣지 않는다(루트 `CLAUDE.md`). 번호는 형식만 그럴듯하게 만든 합성값이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 대기 중인 흔한 한 건. 다른 픽스처는 이것을 덮어써서 만든다.
 *
 * 상태값은 계약이 확정한 5값 중 하나다(`REQUESTED`·`IN_PROGRESS`·`COMPLETED`·`SKIPPED`·
 * `CANCELLED`). ⛔ 지어낸 코드를 쓰지 않는다 — 배지 판정이 되물림으로 빠져나가 시험이
 * 「모르는 값」 경로를 도는 것을 정상으로 통과시킨다.
 */
export const waitingRequest: InspectionRequestResponse = {
  inspectionRequestId: 1001,
  inspectionRequestNo: 'IR-2026-0001',
  inspectionTypeCode: 'IQC',
  inspectionPlanVersionId: 3001,
  targetTypeCode: 'LOT',
  targetId: 5001,
  itemId: 2001,
  lotId: 5001,
  targetQty: 500,
  uomId: 10,
  statusCode: 'REQUESTED',
  requestedAt: '2026-08-18T09:15:00+09:00',
  versionNo: 1,
};

/** 이미 검사가 시작된 건 — 상태가 갈리는 것을 표가 보이는지 검사한다. */
export const inProgressRequest: InspectionRequestResponse = {
  ...waitingRequest,
  inspectionRequestId: 1002,
  inspectionRequestNo: 'IR-2026-0002',
  statusCode: 'IN_PROGRESS',
  requestedAt: '2026-08-17T14:02:00+09:00',
};

/**
 * 자재 LOT 이 없는 건. 계약에서 `lotId` 는 선택이며(작업지시 대상 검사 등) **없는 것이 정상**이다.
 * 표가 이 갈래에서 깨지지 않아야 한다.
 */
export const requestWithoutLot: InspectionRequestResponse = {
  ...waitingRequest,
  inspectionRequestId: 1003,
  inspectionRequestNo: 'IR-2026-0003',
  /* 의뢰 일시를 겹치지 않게 둔다 — 겹치면 표기 시험이 어느 줄을 본 것인지 가릴 수 없다. */
  requestedAt: '2026-08-16T08:40:00+09:00',
  lotId: undefined,
  workOrderId: 7001,
  targetTypeCode: 'WORK_ORDER',
};

/**
 * 검사기준이 등록되지 않은 상태로 만들어진 건(client#589) — 실무상 W-01-01에서는 안 비지만
 * 방어 경로를 시험하려면 만들 수 있어야 한다.
 */
export const requestWithoutPlanVersion: InspectionRequestResponse = {
  ...waitingRequest,
  inspectionRequestId: 1004,
  inspectionRequestNo: 'IR-2026-0004',
  requestedAt: '2026-08-15T08:40:00+09:00',
  inspectionPlanVersionId: undefined,
};

export const queueItems: InspectionRequestResponse[] = [
  waitingRequest,
  inProgressRequest,
  requestWithoutLot,
];

export const pageOf = (total: number, page = 1, size = 50): PageMetaResponse => ({
  page,
  size,
  total,
});

export const queueResponse = (
  items: InspectionRequestResponse[] = queueItems,
  page: PageMetaResponse = pageOf(items.length),
): { items: InspectionRequestResponse[]; page: PageMetaResponse } => ({ items, page });

/** 아직 확정하지 않은 1회차. 수량이 합계 제약을 만족한다(480 + 15 + 5 = 500). */
export const draftRound: InspectionResultResponse = {
  inspectionResultId: 9001,
  inspectionResultNo: 'IRS-2026-0001',
  inspectionRequestId: waitingRequest.inspectionRequestId,
  inspectionRound: 1,
  inspectedQty: 500,
  acceptedQty: 480,
  rejectedQty: 15,
  heldQty: 5,
  uomId: 10,
  /*
   * ⛔ 확정 코드는 «영문»이다(ACCEPTED·REJECTED·HELD). 스펙 §8-1 의 「합격·불합격·보류」는
   * 표시명이지 코드가 아닌데 그것을 코드로 쓰고 있었다 — 계약의 example 이 "IQC"(검사 유형)
   * 로 틀려 있어 참고할 자리도 없었다. 설계가 그 예시를 정정하며 「이 값을 보고 만든 자리가
   * 있으면 함께 보라」고 지목한 자리다(omf-mes#179).
   */
  overallJudgmentCode: 'ACCEPTED',
  inspectorId: 4001,
  inspectedAt: '2026-08-18T10:00:00+09:00',
  statusCode: '작성중',
  versionNo: 1,
};

/** 확정된 1회차 — 이 의뢰는 판정이 끝났고 고치려면 새 회차를 쌓아야 한다. */
export const confirmedRound: InspectionResultResponse = {
  ...draftRound,
  statusCode: '확정',
  confirmedAt: '2026-08-18T10:30:00+09:00',
};

/**
 * 확정된 1회차 뒤에 쌓인 재검사 2회차. 사슬을 `previousResultId` 로 잇는다.
 *
 * ⛔ **재검사 사유를 넣지 않는다.** 계약이 선택으로 받지만 값 목록이 아직 정해지지 않았고
 * (omf-mes#179), 픽스처에 지어낸 코드를 두면 다음에 읽는 사람이 그것을 실재하는 값으로
 * 읽는다 — 이 슬라이스에서 판정 코드가 정확히 그렇게 틀렸다.
 */
export const reinspectionRound: InspectionResultResponse = {
  ...draftRound,
  inspectionResultId: 9002,
  inspectionResultNo: 'IRS-2026-0002',
  inspectionRound: 2,
  previousResultId: confirmedRound.inspectionResultId,
};

export const roundsResponse = (
  items: InspectionResultResponse[],
): { items: InspectionResultResponse[]; page: PageMetaResponse } => ({
  items,
  page: pageOf(items.length),
});

/**
 * 검사기준 버전의 항목 규격. ⛔ 전부 지어낸 값이다.
 *
 * 세 항목이 서로 다른 형태를 덮는다 — 상하한이 있는 수치형(샘플 3) · 규격이 없는 항목 ·
 * 필수가 아닌 항목. 계약이 `dataTypeCode` 의 값 목록을 아직 확정하지 않아(omf-mes#179)
 * 형태만 갖춰 둔다.
 */
export const dimensionSpec: InspectionItemSpecResponse = {
  inspectionItemSpecId: 7001,
  /* 항목 규격의 기준 버전은 항상 있다(다른 스키마) — waitingRequest의 값과 같은 3001을 그대로 쓴다. */
  inspectionPlanVersionId: 3001,
  sequenceNo: 10,
  inspectionItemCode: 'DIM',
  inspectionItemName: '치수',
  dataTypeCode: 'NUMERIC',
  uomId: 20,
  targetValue: 10,
  lowerLimit: 9.9,
  upperLimit: 10.1,
  measurementCount: 3,
  requiredFlag: true,
  automaticJudgment: true,
};

export const appearanceSpec: InspectionItemSpecResponse = {
  inspectionItemSpecId: 7002,
  /* 항목 규격의 기준 버전은 항상 있다(다른 스키마) — waitingRequest의 값과 같은 3001을 그대로 쓴다. */
  inspectionPlanVersionId: 3001,
  sequenceNo: 20,
  inspectionItemCode: 'APPEAR',
  inspectionItemName: '외관',
  dataTypeCode: 'TEXT',
  measurementCount: 1,
  requiredFlag: true,
  automaticJudgment: false,
};

/** 필수가 아닌 항목. 채번에 구멍이 있어도(시퀀스 5) 화면은 위치로 1부터 센다. */
export const optionalSpec: InspectionItemSpecResponse = {
  inspectionItemSpecId: 7003,
  /* 항목 규격의 기준 버전은 항상 있다(다른 스키마) — waitingRequest의 값과 같은 3001을 그대로 쓴다. */
  inspectionPlanVersionId: 3001,
  sequenceNo: 5,
  inspectionItemCode: 'NOTE',
  inspectionItemName: '비고 측정',
  dataTypeCode: 'TEXT',
  measurementCount: 1,
  requiredFlag: false,
  automaticJudgment: false,
};

export const itemSpecs: InspectionItemSpecResponse[] = [
  dimensionSpec,
  appearanceSpec,
  optionalSpec,
];

/** 치수 1번 샘플의 측정치. 교정이 만료된 장비로 쟀다 — 서버가 그렇게 판정했다. */
export const expiredMeasurement: InspectionMeasurementResponse = {
  inspectionMeasurementId: 8001,
  inspectionItemSpecId: dimensionSpec.inspectionItemSpecId,
  sampleNo: 1,
  numericValue: 10.05,
  judgmentCode: 'ACCEPTED',
  measuredAt: '2026-08-18T10:05:00+09:00',
  inspectionEquipmentId: 6001,
  calibrationExpiredAtMeasurement: true,
};

/** 치수 2번 샘플. 교정이 멀쩡한 장비로 쟀다. */
export const normalMeasurement: InspectionMeasurementResponse = {
  ...expiredMeasurement,
  inspectionMeasurementId: 8002,
  sampleNo: 2,
  numericValue: 9.95,
  calibrationExpiredAtMeasurement: false,
};

export const measurementsResponse = (
  items: InspectionMeasurementResponse[],
): { items: InspectionMeasurementResponse[]; page: PageMetaResponse } => ({
  items,
  page: pageOf(items.length),
});

export const itemSpecsResponse = (
  items: InspectionItemSpecResponse[] = itemSpecs,
): { items: InspectionItemSpecResponse[] } => ({ items });

/**
 * 종합 판정 코드값. ⛔ 셋이다 — 항목 판정과 달리 **보류가 있다**.
 *
 * `displayOrder` 가 뜻을 담으므로(합격·불합격·보류 순) 차례를 뒤섞어 두어 정렬을 시험한다.
 */
export const overallJudgmentCodeValues: CodeValueResponse[] = [
  {
    codeValueId: 3002,
    codeGroupId: 300,
    code: 'REJECTED',
    codeName: '불합격',
    displayOrder: 20,
    isActive: true,
  },
  {
    codeValueId: 3001,
    codeGroupId: 300,
    code: 'ACCEPTED',
    codeName: '합격',
    displayOrder: 10,
    isActive: true,
  },
  {
    codeValueId: 3003,
    codeGroupId: 300,
    code: 'HELD',
    codeName: '보류',
    displayOrder: 30,
    isActive: true,
  },
];

/** 사용 중지된 값. 지금 고를 것은 아니지만 과거 자료에는 남아 있다. */
export const retiredCodeValue: CodeValueResponse = {
  codeValueId: 3009,
  codeGroupId: 300,
  code: 'RETIRED',
  codeName: '폐지값',
  displayOrder: 40,
  isActive: false,
};

export const codeValuesResponse = (
  items: CodeValueResponse[],
): { items: CodeValueResponse[]; page: PageMetaResponse } => ({
  items,
  page: pageOf(items.length),
});

import type { CodeValueResponse } from './code-options';
import type {
  InspectionRequestResponse,
  InspectionResultResponse,
  PageMetaResponse,
} from './types';

/**
 * 출하검사 판정의 시험용 자료.
 *
 * ⛔ **전부 지어낸 값이다.** 이 저장소는 공개이므로 실제 사번·품목코드·LOT 번호·거래처 코드를
 * 픽스처에 넣지 않는다(루트 `CLAUDE.md`). 번호는 형식만 그럴듯하게 만든 합성값이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 판정을 기다리는 흔한 한 건. 다른 픽스처는 이것을 덮어써서 만든다.
 *
 * 상태값은 계약이 확정한 5값 중 하나다. ⛔ 지어낸 코드를 쓰지 않는다 — 배지 판정이 되물림으로
 * 빠져나가 시험이 「모르는 값」 경로를 도는 것을 정상으로 통과시킨다.
 */
export const waitingRequest: InspectionRequestResponse = {
  inspectionRequestId: 4101,
  inspectionRequestNo: 'IR-OQC-0001',
  inspectionTypeCode: 'OQC',
  inspectionPlanVersionId: 3101,
  targetTypeCode: 'SHIPMENT_LINE',
  targetId: 6101,
  itemId: 2101,
  lotId: 5101,
  targetQty: 500,
  uomId: 10,
  statusCode: 'REQUESTED',
  requestedAt: '2026-08-30T09:15:00+09:00',
  versionNo: 1,
};

/**
 * 아직 아무 회차도 없는 **두 번째** 의뢰.
 *
 * ⭐ 회차가 없는 의뢰가 둘 있어야 §9 D2(의뢰를 옮겨도 앞 의뢰의 수량이 남지 않는다)를 잴 수
 * 있다 — 되돌림 값이 양쪽 모두 `null`·0·0·0 이라 **의존성이 부족하면 effect 가 깨어나지 않는다.**
 */
export const anotherWaitingRequest: InspectionRequestResponse = {
  ...waitingRequest,
  inspectionRequestId: 4102,
  inspectionRequestNo: 'IR-OQC-0002',
  itemId: 2102,
  lotId: 5102,
  targetId: 6102,
  targetQty: 300,
  requestedAt: '2026-08-30T10:20:00+09:00',
};

/** 이미 판정이 끝난 건 — 「대기·진행만 보기」를 껐을 때 함께 오는 갈래다. */
export const completedRequest: InspectionRequestResponse = {
  ...waitingRequest,
  inspectionRequestId: 4103,
  inspectionRequestNo: 'IR-OQC-0003',
  statusCode: 'COMPLETED',
  requestedAt: '2026-08-29T14:02:00+09:00',
};

/**
 * 검사 기준이 등록되지 않은 채 만들어진 건 — 실무상 OQC 의뢰에는 서버가 채워 내리지만
 * 방어 경로(전용 문구)를 시험하려면 만들 수 있어야 한다.
 */
export const requestWithoutPlanVersion: InspectionRequestResponse = {
  ...waitingRequest,
  inspectionRequestId: 4104,
  inspectionRequestNo: 'IR-OQC-0004',
  requestedAt: '2026-08-28T08:40:00+09:00',
  inspectionPlanVersionId: undefined,
  lotId: undefined,
};

export const queueItems: InspectionRequestResponse[] = [
  waitingRequest,
  anotherWaitingRequest,
  completedRequest,
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

/**
 * 확정된 1회차. 수량이 합계 제약을 만족한다(480 + 15 + 5 = 500).
 *
 * ⛔ 이 화면은 「작성중」을 만들지 않는다 — 저장 한 번이 곧 확정이다. 그래서 기본 픽스처가
 * 확정본이다.
 */
export const confirmedRound: InspectionResultResponse = {
  inspectionResultId: 9101,
  inspectionResultNo: 'IRS-OQC-0001',
  inspectionRequestId: waitingRequest.inspectionRequestId,
  inspectionRound: 1,
  inspectedQty: 500,
  acceptedQty: 480,
  rejectedQty: 15,
  heldQty: 5,
  uomId: 10,
  /*
   * ⛔ 판정 코드는 «영문»이다(ACCEPTED·REJECTED·HELD). 「합격·불합격·보류」는 표시명이지
   * 코드가 아니다.
   */
  overallJudgmentCode: 'ACCEPTED',
  inspectorId: 4001,
  inspectedAt: '2026-08-30T10:00:00+09:00',
  confirmedAt: '2026-08-30T10:00:00+09:00',
  statusCode: '확정',
  versionNo: 1,
};

/**
 * 확정된 1회차 뒤에 쌓인 재검사 2회차. 사슬을 `previousResultId` 로 잇는다.
 *
 * ⛔ **재검사 사유를 넣지 않는다.** 계약이 선택으로 받지만 대응 코드 그룹이 어디에도 없고,
 * 픽스처에 지어낸 코드를 두면 다음에 읽는 사람이 그것을 실재하는 값으로 읽는다.
 */
export const reinspectionRound: InspectionResultResponse = {
  ...confirmedRound,
  inspectionResultId: 9102,
  inspectionResultNo: 'IRS-OQC-0002',
  inspectionRound: 2,
  overallJudgmentCode: 'REJECTED',
  acceptedQty: 470,
  rejectedQty: 30,
  heldQty: 0,
  inspectedAt: '2026-08-30T11:00:00+09:00',
  confirmedAt: '2026-08-30T11:00:00+09:00',
  previousResultId: confirmedRound.inspectionResultId,
};

/** 다른 단말이 남긴 「작성중」 회차 — 이 화면은 만들지 않지만 읽기는 한다. */
export const draftRound: InspectionResultResponse = {
  ...confirmedRound,
  inspectionResultId: 9103,
  inspectionResultNo: 'IRS-OQC-0003',
  statusCode: '작성중',
  confirmedAt: undefined,
};

export const roundsResponse = (
  items: InspectionResultResponse[],
): { items: InspectionResultResponse[]; page: PageMetaResponse } => ({
  items,
  page: pageOf(items.length),
});

/**
 * 종합 판정 코드값. **셋이다** — 합격·불합격·보류.
 *
 * `displayOrder` 가 뜻을 담으므로(합격·불합격·보류 순) 차례를 뒤섞어 두어 정렬을 시험한다.
 */
export const overallJudgmentCodeValues: CodeValueResponse[] = [
  {
    codeValueId: 3102,
    codeGroupId: 310,
    code: 'REJECTED',
    codeName: '불합격',
    displayOrder: 20,
    isActive: true,
  },
  {
    codeValueId: 3101,
    codeGroupId: 310,
    code: 'ACCEPTED',
    codeName: '합격',
    displayOrder: 10,
    isActive: true,
  },
  {
    codeValueId: 3103,
    codeGroupId: 310,
    code: 'HELD',
    codeName: '보류',
    displayOrder: 30,
    isActive: true,
  },
];

/** 사용 중지된 값. 지금 고를 것은 아니지만 과거 자료에는 남아 있다. */
export const retiredCodeValue: CodeValueResponse = {
  codeValueId: 3109,
  codeGroupId: 310,
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

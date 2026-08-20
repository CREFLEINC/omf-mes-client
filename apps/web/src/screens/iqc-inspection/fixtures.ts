import type { InspectionRequestResponse, PageMetaResponse } from './types';

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

import type { components } from '@omf-mes/api-client';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 — 참조하면 예시 값이
 * 배포 번들에 들어간다.
 *
 * 전부 지어낸 합성값이다. 한눈에 예시임이 보이는 접두(`SAMPLE-`)와 「합성 …」만 쓴다.
 * 실 운영 코드·거래처명·품목코드·LOT 번호를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 표 어디에도 내부 번호가 렌더되지
 * 않는지 검사할 때 정상 숫자(수량)와 헷갈리지 않게 하기 위해서다.
 *
 * | 대역 | 무엇 |
 * | ---: | --- |
 * | 7100 | W/O |
 * | 7200 | 창고 |
 * | 7300 | 위치 |
 * | 7400 | 품목 |
 * | 7500 | 단위 |
 * | 7600 | BOM 구성요소 |
 * | 7700 | 자재 출고 요청 |
 */

type WorkOrderResponse = components['schemas']['WorkOrder'];
type ShortageLineResponse = components['schemas']['MaterialIssueShortageLine'];
type MaterialIssueRequestResponse = components['schemas']['MaterialIssueRequest'];
type MaterialIssueRequestDetailResponse =
  components['schemas']['MaterialIssueRequestDetailResponse'];

/**
 * W/O 셋.
 * - 7101: 기본 재공 위치가 있다(7301) — 창고·도착 위치가 자동으로 채워진다
 * - 7102: 기본 재공 위치가 **없다** — 사용자가 직접 고른다
 * - 7103: 유형 글자가 다르다 — 화면이 값으로 분기하지 않는지 보는 자리
 */
export const workOrderFixtures: WorkOrderResponse[] = [
  {
    workOrderId: 7101,
    workOrderNo: 'SAMPLE-WO-0001',
    productionPlanId: 7001,
    routingOperationId: 7011,
    itemId: 7401,
    orderQty: 120,
    uomId: 7501,
    workOrderTypeCode: 'SAMPLE_WO_T_A',
    priorityNo: 100,
    statusCode: 'SAMPLE_WO_S_A',
    defaultWipLocationId: 7301,
    routingOperationName: '합성 공정 가',
    itemCode: 'SAMPLE-ITEM-01',
  },
  {
    workOrderId: 7102,
    workOrderNo: 'SAMPLE-WO-0002',
    productionPlanId: 7002,
    routingOperationId: 7012,
    itemId: 7402,
    orderQty: 80,
    uomId: 7501,
    workOrderTypeCode: 'SAMPLE_WO_T_A',
    priorityNo: 100,
    statusCode: 'SAMPLE_WO_S_A',
    routingOperationName: '합성 공정 나',
    itemCode: 'SAMPLE-ITEM-02',
  },
  {
    workOrderId: 7103,
    workOrderNo: 'SAMPLE-WO-0003',
    productionPlanId: 7003,
    routingOperationId: 7013,
    itemId: 7403,
    orderQty: 40,
    uomId: 7501,
    workOrderTypeCode: 'SAMPLE_WO_T_B',
    priorityNo: 1,
    statusCode: 'SAMPLE_WO_S_B',
    defaultWipLocationId: 7302,
    routingOperationName: '합성 공정 다',
    itemCode: 'SAMPLE-ITEM-03',
  },
];

/**
 * 소요 세 줄.
 * - 7401: 부족이 있다(소요 200 · 기출고 120 · 부족 80)
 * - 7402: **부족이 0 이다** — 표에 남되 요청 수량 0 이라 본문에서 빠진다(스펙 §6)
 * - 7403: BOM 구성요소가 **없다** — BOM 밖 품목이 소요 목록에 실린 갈래
 */
export const shortageFixtures: ShortageLineResponse[] = [
  {
    itemId: 7401,
    bomComponentId: 7601,
    uomId: 7501,
    requiredQty: 200,
    issuedQty: 120,
    shortageQty: 80,
  },
  {
    itemId: 7402,
    bomComponentId: 7602,
    uomId: 7501,
    requiredQty: 50,
    issuedQty: 50,
    shortageQty: 0,
  },
  {
    itemId: 7403,
    uomId: 7502,
    requiredQty: 10,
    issuedQty: 0,
    shortageQty: 10,
  },
];

export const warehouseFixtures = [
  {
    warehouseId: 7201,
    plantId: 7000,
    businessUnitId: 7000,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 자재창고',
    warehouseTypeCode: 'SAMPLE_WH_T_A',
    managementLevelCode: 'SAMPLE_WH_L_A',
    isExternal: false,
    isDefect: false,
    isActive: true,
  },
];

export const locationFixtures = [
  {
    locationId: 7301,
    warehouseId: 7201,
    locationCode: 'SAMPLE-LOC-01',
    locationName: '합성 위치 가',
    locationTypeCode: 'SAMPLE_LOC_T_A',
    allowMixedItem: true,
    allowMixedLot: true,
    isActive: true,
  },
  {
    locationId: 7302,
    warehouseId: 7201,
    locationCode: 'SAMPLE-LOC-02',
    locationName: '합성 위치 나',
    locationTypeCode: 'SAMPLE_LOC_T_A',
    allowMixedItem: true,
    allowMixedLot: true,
    isActive: true,
  },
];

export const itemFixtures = [
  { itemId: 7401, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', baseUomId: 7501 },
  { itemId: 7402, itemCode: 'SAMPLE-ITEM-02', itemName: '합성 품목 나', baseUomId: 7501 },
  { itemId: 7403, itemCode: 'SAMPLE-ITEM-03', itemName: '합성 품목 다', baseUomId: 7502 },
];

export const uomFixtures = [
  { uomId: 7501, uomCode: 'SAMPLE-UOM-EA', uomName: '개', isActive: true },
  { uomId: 7502, uomCode: 'SAMPLE-UOM-KG', uomName: '킬로그램', isActive: true },
];

/**
 * 사유 코드값 넷. **문면을 알아보는 코드가 화면 어디에도 없다** — 값이 무엇이든 라디오가
 * 그대로 선다는 사실을 보이기 위해 뜻 없는 합성 코드를 쓴다.
 */
export const reasonCodeValueFixtures = [
  { codeValueId: 7801, code: 'SAMPLE_MIR_R_A', codeName: '합성 사유 가', displayOrder: 1 },
  { codeValueId: 7802, code: 'SAMPLE_MIR_R_B', codeName: '합성 사유 나', displayOrder: 2 },
  { codeValueId: 7803, code: 'SAMPLE_MIR_R_C', codeName: '합성 사유 다', displayOrder: 3 },
  { codeValueId: 7804, code: 'SAMPLE_MIR_R_D', codeName: '합성 사유 라', displayOrder: 4 },
];

/** 같은 W/O 앞으로 이미 발행된 요청 둘 — 중복 경고 배너가 쓰는 자료다. */
export const existingRequestFixtures: MaterialIssueRequestResponse[] = [
  {
    materialIssueRequestId: 7701,
    issueRequestNo: 'SAMPLE-MIR-0001',
    workOrderId: 7101,
    destinationLocationId: 7301,
    requiredAt: '2026-09-01T14:00:00+09:00',
    statusCode: 'SAMPLE_MIR_S_A',
  },
  {
    materialIssueRequestId: 7702,
    issueRequestNo: 'SAMPLE-MIR-0002',
    workOrderId: 7101,
    destinationLocationId: 7301,
    statusCode: 'SAMPLE_MIR_S_B',
  },
];

export const createdRequestFixture: MaterialIssueRequestDetailResponse = {
  materialIssueRequest: {
    materialIssueRequestId: 7703,
    issueRequestNo: 'SAMPLE-MIR-0003',
    workOrderId: 7101,
    destinationLocationId: 7301,
    statusCode: 'SAMPLE_MIR_S_A',
  },
  lines: [
    {
      materialIssueRequestLineId: 7901,
      materialIssueRequestId: 7703,
      lineNo: 1,
      bomComponentId: 7601,
      itemId: 7401,
      requestedQty: 80,
      issuedQty: 0,
      uomId: 7501,
    },
  ],
};

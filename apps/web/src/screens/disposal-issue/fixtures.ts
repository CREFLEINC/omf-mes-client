import type {
  ApprovalRequestDetailResponse,
  ApprovalStepResponse,
  BalanceResponse,
  IssueLineView,
  IssueView,
  ReceiptLineView,
  ReceiptView,
  WarehouseResponse,
} from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 입고번호·창고처럼 **실제로 보일 법한 값**을
 * 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 지어낸 번호 대역
 * (`GR-2026-9…`)만 쓴다. 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다.** 예시를 픽스처에 쓰면 나중에 「확정 값」으로 읽힌다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(입고 전표) · 9100대(공장) ·
 * 9200대(원천 문서) · 9300대(품목) · 9400대(입고 라인) · 9500대(**출고 전표·출고 라인·승인
 * 요청·사람·원장 라인·도착지**) · 9600대(자재 LOT) · 9700대(창고) · 9800대(단위) ·
 * 9900대(위치). 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때 수량 같은 정상 숫자와
 * 헷갈리지 않게 하기 위해서다. 업무 번호에 내부 번호가 **부분 문자열로 들어가지 않도록**
 * 대역을 갈라 두었다(`GI-2026-950001`이 담는 네 글자 토막은 `9500`·`5000`·`0001`뿐이다).
 */

const BASE_RECEIPT: ReceiptView = {
  goodsReceiptId: 9001,
  goodsReceiptNo: 'GR-2026-900001',
  receiptTypeCode: 'SAMPLE_GR_TYPE_A',
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇이 다른지 그 인자만 보고 읽히게 한다. */
const goodsReceipt = (overrides: Partial<ReceiptView> = {}): ReceiptView => ({
  ...BASE_RECEIPT,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 값이 전부 채워져 있다. 폐기 대상 창고(9701)에 들어왔다
 * - 9002 — **미사용 창고**로 들어왔고 유형·상태 코드가 9001과 다르다
 * - 9003 — **창고 번호가 참조 목록에 없다.** 「목록에 없음」 갈래를 실제 값으로 만든다
 */
export const goodsReceiptFixtures: ReceiptView[] = [
  goodsReceipt(),
  goodsReceipt({
    goodsReceiptId: 9002,
    goodsReceiptNo: 'GR-2026-900002',
    receiptTypeCode: 'SAMPLE_GR_TYPE_B',
    warehouseId: 9702,
    statusCode: 'SAMPLE_GR_STATUS_B',
  }),
  goodsReceipt({
    goodsReceiptId: 9003,
    goodsReceiptNo: 'GR-2026-900003',
    warehouseId: 9799,
    receiptDatetime: '2026-08-07T10:05:00+09:00',
  }),
];

/**
 * 목록 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 */
interface ReceiptResponseShape extends ReceiptView {
  plantId: number;
  sourceDocumentTypeCode: string;
  sourceDocumentId: number;
}

const toReceiptResponse = (view: ReceiptView): ReceiptResponseShape => ({
  ...view,
  plantId: 9101,
  sourceDocumentTypeCode: 'INBOUND_RECEIPT',
  sourceDocumentId: 9201,
});

export const goodsReceiptResponseFixtures = goodsReceiptFixtures.map(toReceiptResponse);

/**
 * 창고 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라 계약의
 * 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 행이 픽스처에 함께 있다(9003의 창고 9799) — 「목록에 없음」
 * 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 *
 * **유형 코드가 서로 다르다.** 창고 유형의 값 목록이 확정됐을 때 선택지가 실제로 좁혀지는지를
 * 재려면 좁힘에 걸리는 값과 걸리지 않는 값이 함께 있어야 한다.
 */
export const warehouseFixtures: Pick<
  WarehouseResponse,
  'warehouseId' | 'warehouseCode' | 'warehouseName' | 'warehouseTypeCode' | 'isActive'
>[] = [
  {
    warehouseId: 9701,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 폐기창고 가',
    warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
    isActive: true,
  },
  /*
   * **미사용 창고.** 선택지에서 빼지 않는다 — 지금은 쓰지 않는 창고로 들어온 과거 입고가
   * 있고, 빼면 그 입고를 조건으로 찾을 방법이 사라진다.
   */
  {
    warehouseId: 9702,
    warehouseCode: 'SAMPLE-WH-02',
    warehouseName: '합성 자재창고 나',
    warehouseTypeCode: 'SAMPLE_WH_TYPE_B',
    isActive: false,
  },
];

/** 폐기 대상 창고 유형이 확정됐다고 가정할 때 쓰는 합성 코드. **계약 예시값이 아니다.** */
export const SAMPLE_DEFECT_WAREHOUSE_TYPE = 'SAMPLE_WH_TYPE_A';

/**
 * 고른 전표(9001)의 라인 셋. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9401 — 값이 전부 채워져 있다. 품목 9301 · LOT 9601
 * - 9402 — **같은 품목(9301)의 다른 LOT.** 잔액을 **품목마다 한 번**만 부르는지 재는 줄이다
 * - 9403 — **다른 품목(9302)이고 단위도 다르다.** 단위가 섞인 합계와 LOT 조회 두 벌을 만든다
 */
export const receiptLineFixtures: ReceiptLineView[] = [
  {
    goodsReceiptLineId: 9401,
    itemId: 9301,
    lotId: 9601,
    receiptQty: 100,
    uomId: 9801,
    destinationLocationId: 9901,
  },
  {
    goodsReceiptLineId: 9402,
    itemId: 9301,
    lotId: 9602,
    receiptQty: 30,
    uomId: 9801,
    destinationLocationId: 9902,
  },
  {
    goodsReceiptLineId: 9403,
    itemId: 9302,
    lotId: 9603,
    receiptQty: 12,
    uomId: 9802,
    destinationLocationId: 9901,
  },
];

/**
 * 라인 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 *
 * 품질·재고 상태를 실어 두는 것이 특히 중요하다 — 화면이 그 값으로 줄을 가르지 **않는다**는
 * 사실은 값이 실제로 와 있을 때만 재진다.
 */
interface ReceiptLineResponseShape extends ReceiptLineView {
  goodsReceiptId: number;
  lineNo: number;
  qualityStatusCode: string;
  inventoryStatusCode: string;
  inventoryTransactionLineId: number | null;
}

export const receiptLineResponseFixtures: ReceiptLineResponseShape[] = receiptLineFixtures.map(
  (line, index) => ({
    ...line,
    goodsReceiptId: 9001,
    lineNo: index + 1,
    qualityStatusCode: 'SAMPLE_QUALITY_A',
    inventoryStatusCode: 'SAMPLE_INVENTORY_A',
    inventoryTransactionLineId: null,
  }),
);

/**
 * 라인 표가 이름을 푸는 참조 넷. **세 줄이 가리키는 번호를 전부 담는다** — 품목 둘·단위 둘·
 * LOT 셋·위치 둘이라 정상 갈래에서 이름이 다 풀린다.
 *
 * **「목록에 없음」 갈래를 픽스처에서 만들지 않는다.** 그 갈래는 부품 테스트가 `entries: []`로
 * 덮어써서 만든다(`gr-line-table.test.tsx`) — 픽스처를 비워 만들면 그 대역이 「없어야 하는
 * 번호」로 읽혀, 다음 사람이 자료를 고칠 때 정상 갈래까지 함께 무너진다.
 *
 * 미사용 값(9302 품목)은 **목록에 남기고 표식만 붙인다** — 빼면 그 품목을 참조하는 과거
 * 입고의 이름이 비어 보인다.
 */
export const itemFixtures = [
  { itemId: 9301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 자재 가', isActive: true },
  { itemId: 9302, itemCode: 'SAMPLE-ITEM-02', itemName: '합성 자재 나', isActive: false },
];

export const uomFixtures = [
  { uomId: 9801, uomCode: 'SAMPLE-UOM-EA', uomName: '합성 낱개', isActive: true },
  { uomId: 9802, uomCode: 'SAMPLE-UOM-BX', uomName: '합성 상자', isActive: true },
];

/**
 * 자재 LOT은 **품목마다** 받는다. 9301에 둘, 9302에 하나.
 *
 * **보류 표식**을 한 LOT에만 붙여 「보류인데도 고를 수 있다」를 실제 값으로 잰다 —
 * 폐기는 보류·차단된 자재를 덜어 내는 일이라 표식은 알리는 것이고 막는 것이 아니다.
 */
export const lotFixturesByItem: Record<number, { lotId: number; lotNo: string; held?: boolean }[]> =
  {
    9301: [
      { lotId: 9601, lotNo: 'SAMPLE-LOT-0001' },
      { lotId: 9602, lotNo: 'SAMPLE-LOT-0002', held: true },
    ],
    9302: [{ lotId: 9603, lotNo: 'SAMPLE-LOT-0003' }],
  };

export const locationFixtures = [
  { locationId: 9901, locationCode: 'SAMPLE-LOC-01', locationName: '합성 적치 가', isActive: true },
  { locationId: 9902, locationCode: 'SAMPLE-LOC-02', locationName: '합성 적치 나', isActive: true },
];

/**
 * 거래처 — **폐기 요청의 도착지**(변경 통지 #128). 번호는 도착지 대역(9500대)을 쓴다.
 *
 * **미사용 거래처를 한 건 둔다**(9562). 이 화면은 같은 리소스를 **두 가지로** 부르는데
 * (선택지는 좁혀 받고 미사용을 빼며, 이름 풀이는 좁히지 않고 미사용까지 받는다), 목록에
 * 미사용 값이 하나도 없으면 그 차이가 값으로 드러나지 않는다.
 *
 * **9563은 목록에 없다** — 이미 저장된 전표가 이 목록 밖 거래처를 가리키는 갈래를 만든다.
 * 그때 화면은 번호를 대신 내지 않고 「알 수 없음」이라 적는다(`omf-mes#44`·`#47`).
 */
export const partnerFixtures = [
  { partnerId: 9561, partnerCode: 'SAMPLE-PT-01', partnerName: '합성 폐기업체 가', isActive: true },
  {
    partnerId: 9562,
    partnerCode: 'SAMPLE-PT-02',
    partnerName: '합성 폐기업체 나',
    isActive: false,
  },
];

/** 폐기 거래처 선택지·도착지 표기에 쓰이는 라벨. **「코드 · 이름」**이고 번호가 없다. */
export const PARTNER_LABEL = 'SAMPLE-PT-01 · 합성 폐기업체 가';

/**
 * 역할 코드 자리표시가 채워졌다고 가정할 때 목이 내놓는 코드.
 *
 * **계약이 아는 값이되 실물 상수와 다른 값을 고른다**(계약 재동기화 #173). 계약이 이 코드를
 * 다섯으로 좁혀 합성값은 더 이상 실을 수 없다 — 그렇다고 실물과 **같은** 값을 쓰면 「목이 실제로
 * 갈아 끼워졌는가」와 「실물 상수를 그냥 읽었는가」가 질의 조건에서 구분되지 않는다.
 */
export const SAMPLE_PARTNER_ROLE = 'OTHER';

/**
 * 품목별 잔액 응답. **`onHandQty`와 `availableQty`가 다르다** — 상한이 어느 쪽을 쓰는지
 * 화면 수준에서 갈리게 하려면 두 값이 달라야 한다(감지기 M22).
 *
 * 9602는 **보유가 0**이다(`includeZero=true`가 데려오는 줄) — 「0이라 없다」와 「잘려서 없다」가
 * 갈리는지 재는 자리다.
 */
export const balanceResponseFixturesByItem: Record<number, BalanceResponse[]> = {
  9301: [
    {
      groupBy: 'LOT',
      itemId: 9301,
      lotId: 9601,
      warehouseId: 9701,
      ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
      onHandQty: 80,
      reservedQty: 10,
      pickedQty: 5,
      blockedQty: 25,
      availableQty: 40,
      uomId: 9801,
    },
    {
      groupBy: 'LOT',
      itemId: 9301,
      lotId: 9602,
      warehouseId: 9701,
      ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
      onHandQty: 0,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 0,
      availableQty: 0,
      uomId: 9801,
    },
  ] as BalanceResponse[],
  9302: [
    {
      groupBy: 'LOT',
      itemId: 9302,
      lotId: 9603,
      warehouseId: 9701,
      ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
      onHandQty: 12,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 6,
      availableQty: 6,
      uomId: 9802,
    },
  ] as BalanceResponse[],
};

/**
 * 「처리 이력」 탭이 쓰는 출고 전표(= 폐기 요청) 셋. 화면이 다뤄야 하는 까다로운 입력을 담는다.
 *
 * - 9501 — **상신됐다**(승인 요청 9521). 값이 전부 채워져 있고 **도착지가 목록에 있는 거래처**다
 * - 9502 — **미상신**이다(`approvalRequestId` 없음). 사유 코드도 없고 ERP 적재 값도 오지 않았으며
 *   **도착지 짝이 통째로 없다**(= 자체 폐기) — 네 「없음」 갈래를 한 건이 함께 만든다
 * - 9503 — 창고 번호가 **참조 목록에 없다.** 「목록에 없음」 갈래를 실제 값으로 만들고,
 *   **도착지 번호도 목록 밖**이라 이름을 풀지 못하는 갈래를 함께 만든다
 *
 * **도착지 셋이 서로 다른 갈래를 만든다**(변경 통지 #128) — 짝 있음·짝 없음·못 푼 이름.
 * ③ 구획이 그 셋을 각각 다른 글자로 말하는지가 이 대비의 값어치다.
 */
export const goodsIssueFixtures: IssueView[] = [
  {
    goodsIssueId: 9501,
    goodsIssueNo: 'GI-2026-950001',
    issueTypeCode: 'SAMPLE_GI_TYPE_A',
    sourceWarehouseId: 9701,
    issuedAt: '2026-08-08T14:20:00+09:00',
    statusCode: 'SAMPLE_GI_STATUS_A',
    reasonCode: 'SAMPLE_GI_REASON_A',
    destinationTypeCode: 'DISPOSAL_SITE',
    destinationId: 9561,
    approvalRequestId: 9521,
    erpMessageQueued: true,
  },
  {
    goodsIssueId: 9502,
    goodsIssueNo: 'GI-2026-950002',
    issueTypeCode: 'SAMPLE_GI_TYPE_A',
    sourceWarehouseId: 9702,
    issuedAt: '2026-08-09T10:05:00+09:00',
    statusCode: 'SAMPLE_GI_STATUS_B',
    reasonCode: null,
    /* 자체 폐기 — **짝이 통째로 없다.** 한쪽만 있는 전표는 서버가 만들지 않는다(#128 ⛔). */
    destinationTypeCode: null,
    destinationId: null,
    approvalRequestId: null,
    erpMessageQueued: null,
  },
  {
    goodsIssueId: 9503,
    goodsIssueNo: 'GI-2026-950003',
    issueTypeCode: 'SAMPLE_GI_TYPE_A',
    sourceWarehouseId: 9799,
    issuedAt: '2026-08-10T08:40:00+09:00',
    statusCode: 'SAMPLE_GI_STATUS_A',
    reasonCode: 'SAMPLE_GI_REASON_B',
    destinationTypeCode: 'DISPOSAL_SITE',
    destinationId: 9563,
    approvalRequestId: 9522,
    erpMessageQueued: false,
  },
];

/**
 * 목록 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 *
 * 「없음」인 다섯 필드는 **키 자체를 두지 않는다** — 계약이 선택으로 둔 필드는 널로도 오지만
 * 아예 오지 않기도 하고, 옮기기가 두 갈래를 다 없음으로 접는지 여기서 실제로 갈린다.
 * **도착지 짝도 그 규칙을 따른다**(변경 통지 #128 — 자체 폐기는 「둘 다 보내지 않는다」).
 */
export const goodsIssueResponseFixtures = goodsIssueFixtures.map((view) => ({
  ...view,
  sourceDocumentTypeCode: 'INBOUND_RECEIPT',
  sourceDocumentId: 9001,
  replacementExpected: false,
  ...(view.reasonCode === null ? { reasonCode: undefined } : {}),
  ...(view.destinationTypeCode === null
    ? { destinationTypeCode: undefined, destinationId: undefined }
    : {}),
  ...(view.approvalRequestId === null ? { approvalRequestId: undefined } : {}),
  ...(view.erpMessageQueued === null ? { erpMessageQueued: undefined } : {}),
}));

/**
 * 고른 품의(9501)의 라인 둘.
 *
 * - 9511 — **전기됐다**(원장 라인 9531). 「전기됨」 갈래를 실제 값으로 만든다
 * - 9512 — **전기 전이다.** 두 표식이 한 표에 함께 서는지 재는 줄이며, 품목·단위가 9511과
 *   달라 참조 두 벌과 단위 표기가 함께 검사된다
 */
export const goodsIssueLineFixtures: IssueLineView[] = [
  {
    goodsIssueLineId: 9511,
    itemId: 9301,
    lotId: 9601,
    issueQty: 40,
    uomId: 9801,
    sourceLocationId: 9901,
    inventoryTransactionLineId: 9531,
  },
  {
    goodsIssueLineId: 9512,
    itemId: 9302,
    lotId: 9603,
    issueQty: 5,
    uomId: 9802,
    sourceLocationId: 9902,
    inventoryTransactionLineId: null,
  },
];

export const goodsIssueLineResponseFixtures = goodsIssueLineFixtures.map((line, index) => ({
  ...line,
  goodsIssueId: 9501,
  lineNo: index + 1,
  pickingLineId: null,
}));

const approvalStep = (overrides: Partial<ApprovalStepResponse> = {}): ApprovalStepResponse => ({
  stepNo: 1,
  approverId: 9551,
  approverName: '합성 승인자 가',
  decisionCode: 'APPROVED',
  decisionAt: '2026-08-08T15:02:00+09:00',
  decisionComment: '합성 결재 의견',
  isMine: false,
  isCurrent: false,
  ...overrides,
});

/**
 * 승인 요청 상세 한 건.
 *
 * **목이 내려주는 예시를 그대로 쓰지 않는다**(계획 §5.4-23) — 목의 승인 요청 예시는 이 화면을
 * 그린 것이라 값을 베끼면 계약 예시값이 픽스처에 들어간다.
 *
 * - 사유가 **여러 줄**이다 — 전문의 줄바꿈이 유지되는지 재는 자리다
 * - 둘째 단계는 **결재 전이고 승인자 이름이 비어 있다** — 「번호를 대신 내지 않는다」가
 *   실제 값으로 걸린다
 * - **단계 번호가 비연속(1·4)이다** — 연속으로 두면 `stepNo`를 배열 인덱스+1로 다시 매기는
 *   결함이 **값이 같아 가려진다**(검증 t3 관찰 ①). 결재선의 단계가 지워지거나 건너뛴 요청이
 *   실재하므로 지어낸 자료도 아니다
 */
export const approvalRequestDetailFixture: ApprovalRequestDetailResponse = {
  request: {
    approvalRequestId: 9521,
    approvalRequestNo: 'AP-2026-800001',
    approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
    requestedBy: 9541,
    requestedByName: '합성 상신자 가',
    /* **출고 일시와 다른 시각이다** — 상신은 등록 뒤에 일어나고, 같으면 두 값을 가려 볼 수 없다. */
    requestedAt: '2026-08-08T14:35:00+09:00',
    statusCode: 'SAMPLE_AP_STATUS_A',
    reason: '합성 폐기 사유 첫 줄\n\n둘째 문단 — 근거를 적는 자리',
    target: {
      targetTypeCode: 'GOODS_ISSUE',
      targetId: 9501,
      displayName: '합성 대상 문서',
      openable: false,
    },
    currentStepNo: 4,
    totalStepNo: 4,
    isMyTurn: false,
  },
  steps: [
    approvalStep(),
    approvalStep({
      stepNo: 4,
      approverId: 9552,
      approverName: '',
      decisionCode: null,
      decisionAt: null,
      decisionComment: null,
      isCurrent: true,
    }),
  ],
};

/**
 * **서버 값과 배열 재계산이 어긋나는** 상세(목 실측 형태 · 감지기 M47).
 *
 * `currentStepNo`가 단계 수보다 크고, 그 하나뿐인 단계는 **결재됐는데 `isCurrent`가 참**이다.
 * 배열을 훑어 위치를 다시 매기는 구현은 여기서 서버 값과 갈린다.
 */
export const contradictoryApprovalDetailFixture: ApprovalRequestDetailResponse = {
  request: {
    ...approvalRequestDetailFixture.request,
    currentStepNo: 3,
    totalStepNo: 3,
  },
  steps: [approvalStep({ stepNo: 1, isCurrent: true })],
};

/** 반려 자리표시가 채워졌다고 가정할 때 쓰는 합성 코드. **계약 예시값이 아니다.** */
export const SAMPLE_REJECTION_DECISION = 'REJECTED';

/** 승인 완료 자리표시가 채워졌다고 가정할 때 쓰는 합성 코드. **계약 예시값이 아니다.** */
export const SAMPLE_APPROVED_STATUS = 'SAMPLE_AP_STATUS_A';

/** 화면 어디에도 나와서는 안 되는 내부 번호(FK). 업무 번호와 겹치지 않는 대역이다. */
export const INTERNAL_IDS = [
  '9001',
  '9002',
  '9003',
  '9101',
  '9201',
  '9301',
  '9302',
  '9401',
  '9402',
  '9403',
  '9501',
  '9502',
  '9503',
  '9504',
  '9511',
  '9512',
  '9513',
  '9521',
  '9522',
  '9531',
  '9541',
  '9551',
  '9552',
  '9561',
  '9562',
  '9563',
  '9601',
  '9602',
  '9603',
  '9701',
  '9702',
  '9799',
  '9801',
  '9802',
  '9901',
  '9902',
];

/**
 * 「승인 요청」이 만드는 전표. **목록 픽스처와 겹치지 않는 번호**(9504)를 쓴다 —
 * 이미 있는 전표와 같은 번호면 「방금 만든 것」과 「목록에 있던 것」이 구분되지 않는다.
 *
 * **승인 요청 전의 모양이다** — `approvalRequestId`가 오지 않는다. 전표 생성은 전기도 요청도 하지
 * 않으므로(`postImmediately: false`) 라인의 원장 라인도 비어 있다.
 */
export const createdIssueResponseFixture = {
  goodsIssueId: 9504,
  goodsIssueNo: 'GI-2026-950004',
  issueTypeCode: 'SAMPLE_GI_TYPE_A',
  sourceDocumentTypeCode: 'INBOUND_RECEIPT',
  sourceDocumentId: 9001,
  sourceWarehouseId: 9701,
  destinationTypeCode: 'DISPOSAL_SITE',
  destinationId: 9561,
  issuedAt: '2026-08-11T09:30:00+09:00',
  statusCode: 'SAMPLE_GI_STATUS_B',
  reasonCode: 'SAMPLE_GI_REASON_A',
  replacementExpected: false,
  erpMessageQueued: false,
};

/** 만들어진 전표의 라인 하나. **보낸 값이 아니라 서버가 되돌려 준 값이다.** */
export const createdIssueLineResponseFixtures = [
  {
    goodsIssueLineId: 9513,
    goodsIssueId: 9504,
    lineNo: 1,
    itemId: 9301,
    lotId: 9601,
    issueQty: 10,
    uomId: 9801,
    sourceLocationId: 9901,
    pickingLineId: null,
    inventoryTransactionLineId: null,
  },
];

/**
 * 값 목록이 확정됐다고 가정할 때 쓰는 **폐기 요청 정보 코드 셋**. 계약의 `@example` 값이 아니다.
 *
 * **폐기 계정·도착지 유형이 없다**(변경 통지 #124·#128) — 폼에 그 칸이 없어 고를 값도 없다.
 */
export const SAMPLE_FORM_CODES = {
  issueType: 'SAMPLE_GI_TYPE_A',
  sourceDocumentType: 'INBOUND_RECEIPT',
  reason: 'SAMPLE_GI_REASON_A',
};

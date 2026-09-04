/**
 * 상태 기반 목 서버의 씨앗 데이터.
 *
 * 값은 계약 정본의 example 을 그대로 쓴다 — 계약의 example 은 생성 타입으로 이 저장소에
 * 이미 들어와 있는 공개 면이라, 여기 적는다고 새로 드러나는 것이 없다. example 이 자리표시
 * (「값」·「문자열」)인 자리만 같은 결로 지어낸다.
 *
 * 날짜는 실행 시각을 기준으로 만든다. 박아 두면 다음 날 출하 목록이 비어 화면을 열 수 없다.
 */

const pad = (value) => String(value).padStart(2, '0');

export const dayOf = (date) =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const shift = (base, days) => {
  const moved = new Date(base);
  moved.setDate(moved.getDate() + days);
  return moved;
};

/** 공장 하나로 둔다. 여러 공장은 이 화면들이 가르지 않는다. */
const PLANT_ID = 1001;
const BUSINESS_UNIT_ID = 1001;

export const createSeed = (now = new Date()) => {
  const today = dayOf(now);
  const iso = (days, hours = 9) => {
    const at = shift(now, days);
    at.setHours(hours, 12, 0, 0);
    return at.toISOString();
  };

  const workers = [
    { workerId: 1001, workerNo: '100027', workerName: '홍길동' },
    { workerId: 1002, workerNo: '100028', workerName: '김영수' },
    { workerId: 1003, workerNo: '100029', workerName: '이수진' },
    { workerId: 1004, workerNo: '100030', workerName: '박지훈' },
  ].map((worker) => ({
    ...worker,
    nameKo: worker.workerName,
    nameVi: null,
    businessUnitId: BUSINESS_UNIT_ID,
    plantId: PLANT_ID,
    departmentId: 1001,
    appUserId: null,
    statusCode: 'ACTIVE',
    isActive: true,
  }));

  const uoms = [
    { uomId: 1001, uomCode: 'EA', uomName: '개', isActive: true },
    { uomId: 1002, uomCode: 'KG', uomName: '킬로그램', isActive: true },
  ];

  /*
   * `labelName` 은 **라벨에 찍는 영문명**이다(라벨 사양 §7 — 라벨용 영문명을 별도로 관리한다).
   * 라벨은 영문·숫자만 쓰므로 화면에 보이는 한글 품명을 그대로 찍을 수 없다.
   */
  const items = [
    {
      itemId: 2001,
      itemCode: 'RM-1001',
      itemName: '수지A',
      labelName: 'PC RESIN BLK',
      fifoPolicyCode: 'FEFO',
    },
    {
      itemId: 2002,
      itemCode: 'ABC-123',
      itemName: '하우징 커버 A',
      labelName: 'UPPER HSG BLK',
      fifoPolicyCode: 'FIFO',
    },
    {
      itemId: 2003,
      itemCode: 'FG-1001',
      itemName: '외장 커버',
      labelName: 'CHARGER ASSY',
      fifoPolicyCode: 'FEFO',
    },
  ].map((item) => ({
    ...item,
    plantId: PLANT_ID,
    baseUomId: 1001,
    itemTypeCode: item.itemId === 2003 ? 'PRODUCT' : 'MATERIAL',
    lotControlled: true,
    serialControlTypeCode: 'NONE',
    inspectionRequired: item.itemId !== 2003,
    negativeStockAllowed: false,
    isActive: true,
  }));

  const warehouses = [
    { warehouseId: 1001, warehouseCode: 'WH-01', warehouseName: '1공장 자재창고' },
    { warehouseId: 1002, warehouseCode: 'WH-02', warehouseName: '1공장 완제품창고' },
    /* 불량창고 — W-04-07 판정 대기 대상이 들어오는 자리. `GET /mdm/warehouses?isDefect=true` 가 준다. */
    { warehouseId: 1003, warehouseCode: 'WH-03', warehouseName: '1공장 불량창고', isDefect: true },
  ].map((warehouse) => ({
    isDefect: false,
    ...warehouse,
    plantId: PLANT_ID,
    /* 구역 수준이면 위치를 관리한다. 창고 수준이면 위치 스캔을 건너뛴다. */
    managementLevelCode: 'ZONE',
    isActive: true,
  }));

  const locations = [
    {
      locationId: 3001,
      warehouseId: 1001,
      locationCode: 'A-01-03',
      locationName: 'A구역 01열 03단',
    },
    {
      locationId: 3002,
      warehouseId: 1001,
      locationCode: 'A-01-04',
      locationName: 'A구역 01열 04단',
    },
    {
      locationId: 3003,
      warehouseId: 1001,
      locationCode: 'TMP-01',
      locationName: '하역장 임시자리',
    },
    {
      locationId: 3004,
      warehouseId: 1002,
      locationCode: 'FG-A-02-01',
      locationName: '완제품 A구역 02열 01단',
    },
    /* W-04-06 — 반품은 불량창고 위치로 들어간다. 상위 위치가 있어 선택칸이 1단 그룹으로 접힌다. */
    { locationId: 3005, warehouseId: 1003, locationCode: 'R-01', locationName: '반품 구역' },
    {
      locationId: 3006,
      warehouseId: 1003,
      parentLocationId: 3005,
      locationCode: 'R-01-02',
      locationName: '반품 구역 02',
    },
  ].map((location) => ({
    ...location,
    locationTypeCode: location.locationCode.startsWith('TMP') ? 'TEMPORARY' : 'RACK',
    allowMixedItem: !location.locationCode.endsWith('04'),
    allowMixedLot: true,
    capacityQty: 1000,
    isActive: true,
  }));

  const partners = [
    {
      partnerId: 4001,
      partnerCode: 'SUP-001',
      partnerName: '(주)대한부품',
      roleTypeCode: 'SUPPLIER',
      isActive: true,
    },
    /* W-04-06 — 원 출하 검색의 고객 축. 반품은 고객사에서 돌아온다. */
    {
      partnerId: 4002,
      partnerCode: 'CUS-001',
      partnerName: '합성 고객사 B',
      roleTypeCode: 'CUSTOMER',
      isActive: true,
    },
  ];

  const equipments = [
    { equipmentId: 5001, equipmentCode: 'PRS-01', equipmentName: '프레스 1호기' },
    { equipmentId: 5002, equipmentCode: 'EQ-03', equipmentName: '사출기 3호' },
  ].map((equipment) => ({
    ...equipment,
    plantId: PLANT_ID,
    equipmentTypeCode: 'MACHINE',
    productionLineId: 6001,
    statusCode: 'RUNNING',
    isActive: true,
  }));

  /* 측정 항목은 기준이 있어야 자동 판정이 선다. 육안 항목은 기준이 없다. */
  const inspectionItems = [
    {
      equipmentInspectionItemId: 7001,
      inspectionItemId: 7001,
      equipmentId: 5001,
      inspectionItemName: '유압 압력',
      judgmentMethodCode: 'MEASUREMENT',
      inspectionTypeCode: 'DAILY',
      lowerLimit: 12,
      upperLimit: 15,
      uomId: 1001,
      isRequired: false,
      displayOrder: 1,
    },
    {
      equipmentInspectionItemId: 7002,
      inspectionItemId: 7002,
      equipmentId: 5001,
      inspectionItemName: '벨트 장력',
      judgmentMethodCode: 'VISUAL',
      inspectionTypeCode: 'DAILY',
      lowerLimit: null,
      upperLimit: null,
      uomId: null,
      isRequired: false,
      displayOrder: 2,
    },
    {
      equipmentInspectionItemId: 7003,
      inspectionItemId: 7003,
      equipmentId: 5001,
      inspectionItemName: '안전커버 파손 여부',
      judgmentMethodCode: 'VISUAL',
      inspectionTypeCode: 'DAILY',
      lowerLimit: null,
      upperLimit: null,
      uomId: null,
      isRequired: true,
      displayOrder: 3,
    },
    {
      equipmentInspectionItemId: 7004,
      inspectionItemId: 7004,
      equipmentId: 5002,
      inspectionItemName: '유압 누유 확인',
      judgmentMethodCode: 'VISUAL',
      inspectionTypeCode: 'DAILY',
      lowerLimit: null,
      upperLimit: null,
      uomId: null,
      isRequired: true,
      displayOrder: 1,
    },
  ];

  /*
   * 값 목록이 확정된 그룹만 담는다. 미확정 그룹을 지어내 채우면 화면이 그럴듯하게 도는데
   * 실서버에서는 빈 목록을 받는다 - 그 차이를 시험 자리에서 감추지 않는다.
   */
  const codeValues = {
    /* W-04-07 — 심각도는 고객이 늘리는 값(시드 셋), 상태는 시스템 값(고객 편집 불가). */
    NONCONFORMANCE_SEVERITY: [
      ['CRITICAL', '중대'],
      ['MAJOR', '중'],
      ['MINOR', '경'],
    ],
    NONCONFORMANCE_STATUS: [
      ['NOT_REQUESTED', '의뢰 전'],
      ['PENDING_DECISION', '판정 대기'],
      ['DECIDED', '판정 완료'],
    ],
    /* W-04-06 — 입고 유형·사유는 고객이 늘리는 값(시드), 출하 상태는 시스템 값. */
    RECEIPT_TYPE: [
      ['MATERIAL', '자재 입고'],
      ['PRODUCT', '제품 입고'],
      ['RETURN', '반품 입고'],
      ['TRANSFER', '창고간 이동 입고'],
    ],
    GOODS_RECEIPT_REASON: [
      ['QUALITY_DEFECT', '품질 불량'],
      ['WRONG_DELIVERY', '오배송'],
      ['CUSTOMER_CANCEL', '고객 취소'],
    ],
    SHIPMENT_STATUS: [
      ['UNCONFIRMED', '미확정'],
      ['CONFIRMED', '확정'],
      ['CANCELLED', '취소'],
    ],
    LOT_TYPE: [
      ['MATERIAL', '자재'],
      ['PRODUCTION', '생산'],
      ['PRODUCT', '제품'],
    ],
    LOT_STATUS: [
      ['NORMAL', '정상'],
      ['DEFECTIVE', '불량'],
      ['INSPECTION_PENDING', '검사 대기'],
      ['SCRAPPED', '폐기'],
    ],
    ISSUE_TYPE: [
      ['PRODUCTION', '생산 투입'],
      ['RETURN', '공급사 반품'],
      ['DISPOSAL', '폐기'],
      ['TRANSFER', '이고 출고'],
    ],
    LOT_HOLD_REASON: [
      ['INSPECTION_PENDING', '수입검사 대기'],
      ['SUSPECT', '의심 자재'],
    ],
    PICKING_TYPE: [
      ['PRODUCTION', '생산 투입'],
      ['SHIPMENT', '출하'],
    ],
    RECEIPT_TYPE: [
      ['MATERIAL', '자재 입고'],
      ['PRODUCT', '제품 입고'],
      ['RETURN', '반품 입고'],
      ['TRANSFER', '이고 입고'],
    ],
    HANDLING_UNIT_TYPE: [
      ['CARTON', '카톤'],
      ['PALLET', '팔레트'],
    ],
    SUBSTITUTE_LOT_REASON: [
      ['NO_LABEL', '라벨 미부착'],
      ['LABEL_DAMAGED', '라벨 훼손'],
      ['UNREADABLE', '판독 불가'],
    ],
    INBOUND_VARIANCE_TYPE: [
      ['SHORTAGE', '수량 부족'],
      ['OVERAGE', '수량 초과'],
      ['DAMAGED', '파손'],
      ['WRONG_ITEM', '품목 상이'],
    ],
    PUTAWAY_TASK_TEMPORARY_REASON: [
      ['FULL', '정위치 포화'],
      ['INSPECTION', '검사 대기'],
      ['NO_LOCATION', '위치 미지정'],
      ['ETC', '기타'],
    ],
    WORK_ORDER_TYPE: [
      ['NORMAL', '양산'],
      ['EMERGENCY', '긴급'],
      ['REWORK', '재작업'],
    ],
    REISSUE_REASON: [
      ['DAMAGED', '라벨 훼손'],
      ['UNREADABLE', '라벨 판독 불가'],
      ['LOST', '라벨 분실'],
    ],
  };

  /* 34자리 전부 숫자 — 화면이 그 형식으로 스캔값을 거른다. */
  const MATERIAL_LOT_A = '0001234500000012002607310001230007';
  const MATERIAL_LOT_B = '0001234500000012002607310001230008';
  const MATERIAL_LOT_HELD = '0001234500000012002607310001230009';

  const lots = [
    {
      lotId: 8001,
      lotNo: MATERIAL_LOT_A,
      itemId: 2002,
      lotTypeCode: 'MATERIAL',
      initialQty: 500,
      uomId: 1001,
      manufacturedAt: iso(-20),
      expiryDate: dayOf(shift(now, 340)),
      sourceTypeCode: 'INBOUND_RECEIPT',
      sourceId: 9001,
      statusCode: 'NORMAL',
      completedAt: null,
      held: false,
    },
    {
      lotId: 8002,
      lotNo: MATERIAL_LOT_B,
      itemId: 2001,
      lotTypeCode: 'MATERIAL',
      initialQty: 300,
      uomId: 1001,
      manufacturedAt: iso(-15),
      expiryDate: dayOf(shift(now, 200)),
      sourceTypeCode: 'INBOUND_RECEIPT',
      sourceId: 9001,
      statusCode: 'NORMAL',
      completedAt: null,
      held: false,
    },
    {
      lotId: 8003,
      lotNo: MATERIAL_LOT_HELD,
      itemId: 2002,
      lotTypeCode: 'MATERIAL',
      initialQty: 120,
      uomId: 1001,
      manufacturedAt: iso(-3),
      expiryDate: dayOf(shift(now, 360)),
      sourceTypeCode: 'INBOUND_RECEIPT',
      sourceId: 9002,
      statusCode: 'INSPECTION_PENDING',
      completedAt: null,
      /* 검사 대기로 보류된 자재 — 위치 확인 화면의 보류 경고와 IQC 생략 요청 대상이다. */
      held: true,
    },
    {
      lotId: 8101,
      lotNo: 'PLOT-2026-0031',
      itemId: 2003,
      lotTypeCode: 'PRODUCTION',
      initialQty: 500,
      uomId: 1001,
      manufacturedAt: iso(-1),
      expiryDate: null,
      /* 이 LOT 의 원천이 출발 W/O 다. WIP 공정 이동이 이 값을 출발 W/O 로 쓴다. */
      sourceTypeCode: 'WORK_ORDER',
      sourceId: 11001,
      statusCode: 'NORMAL',
      completedAt: iso(-1, 17),
      held: false,
      progress: {
        goodQty: 480,
        defectQty: 20,
        achievementRate: 1,
        completionJudgmentCode: 'NORMAL',
      },
    },
    {
      lotId: 8102,
      lotNo: 'PLOT-2026-0032',
      itemId: 2003,
      lotTypeCode: 'PRODUCTION',
      initialQty: 200,
      uomId: 1001,
      manufacturedAt: iso(-1),
      expiryDate: null,
      sourceTypeCode: 'WORK_ORDER',
      sourceId: 11001,
      statusCode: 'DEFECTIVE',
      completedAt: iso(-1, 18),
      held: false,
      progress: {
        goodQty: 180,
        defectQty: 20,
        achievementRate: 1,
        completionJudgmentCode: 'NORMAL',
      },
    },
    {
      lotId: 8201,
      lotNo: 'FLOT-2026-0311',
      itemId: 2003,
      lotTypeCode: 'PRODUCT',
      initialQty: 500,
      uomId: 1001,
      manufacturedAt: iso(-2),
      expiryDate: dayOf(shift(now, 365)),
      sourceTypeCode: 'PRODUCTION_RESULT',
      sourceId: 12001,
      statusCode: 'NORMAL',
      completedAt: iso(-2, 17),
      held: false,
    },
    {
      lotId: 8202,
      lotNo: 'FLOT-2026-0305',
      itemId: 2003,
      lotTypeCode: 'PRODUCT',
      initialQty: 300,
      uomId: 1001,
      manufacturedAt: iso(-5),
      /* 유효기간이 더 이르다 — 선입선출 권장 순서가 이 LOT 을 앞에 둔다. */
      expiryDate: dayOf(shift(now, 120)),
      sourceTypeCode: 'PRODUCTION_RESULT',
      sourceId: 12002,
      statusCode: 'NORMAL',
      completedAt: iso(-5, 17),
      held: false,
    },
    /*
     * 아직 끝나지 않은 생산 LOT — **진행 중인 W/O(11002)의 실적 입력 대상이다.**
     * 다른 생산 LOT 은 모두 완료된 W/O(11001)에 매여 있어, 실적을 「넣어 볼」 대상이 없었다.
     */
    {
      lotId: 8103,
      lotNo: 'PLOT-2026-0033',
      itemId: 2003,
      lotTypeCode: 'PRODUCTION',
      initialQty: 500,
      uomId: 1001,
      manufacturedAt: iso(0),
      expiryDate: null,
      sourceTypeCode: 'WORK_ORDER',
      sourceId: 11002,
      statusCode: 'NORMAL',
      completedAt: null,
      held: false,
      progress: {
        goodQty: 120,
        defectQty: 0,
        achievementRate: 0.24,
        completionJudgmentCode: null,
      },
    },
  ].map((lot) => ({
    plantId: PLANT_ID,
    lifecycleStatusCode: null,
    parentLotId: null,
    bomSnapshot: null,
    remarks: null,
    receiptDispositionCode: null,
    ...lot,
  }));

  const holds = [
    {
      lotHoldId: 8501,
      lotId: 8003,
      reasonCode: 'INSPECTION_PENDING',
      holdQty: null,
      uomId: 1001,
      releaseCondition: '수입검사 합격',
      statusCode: 'OPEN',
      heldAt: iso(-3, 10),
      releasedAt: null,
    },
  ];

  const balances = [
    { lotId: 8001, itemId: 2002, warehouseId: 1001, locationId: 3001, onHandQty: 500 },
    { lotId: 8001, itemId: 2002, warehouseId: 1001, locationId: 3002, onHandQty: 120 },
    { lotId: 8002, itemId: 2001, warehouseId: 1001, locationId: 3001, onHandQty: 300 },
    { lotId: 8003, itemId: 2002, warehouseId: 1001, locationId: 3003, onHandQty: 120 },
    { lotId: 8201, itemId: 2003, warehouseId: 1002, locationId: 3004, onHandQty: 500 },
    { lotId: 8202, itemId: 2003, warehouseId: 1002, locationId: 3004, onHandQty: 300 },
  ].map((balance, index) => ({
    inventoryBalanceId: 8600 + index,
    ...balance,
    uomId: 1001,
    reservedQty: 0,
    pickedQty: 0,
    blockedQty: balance.lotId === 8003 ? balance.onHandQty : 0,
    availableQty: balance.lotId === 8003 ? 0 : balance.onHandQty,
    qualityStatusCode: balance.lotId === 8003 ? 'INSPECTION_PENDING' : 'NORMAL',
    inventoryStatusCode: 'AVAILABLE',
    ownershipTypeCode: 'OWNED',
    ownerPartnerId: null,
    lastTransactionAt: iso(-1, 14),
  }));

  const purchaseOrders = [
    {
      purchaseOrderId: 9101,
      purchaseOrderNo: 'PO-2026-000123',
      erpPurchaseOrderNo: 'ERP-PO-000123',
      supplierId: 4001,
      businessUnitId: BUSINESS_UNIT_ID,
      plantId: PLANT_ID,
      orderDate: dayOf(shift(now, -10)),
      expectedReceiptDate: today,
      statusCode: 'OPEN',
      approvalRequestId: null,
    },
    {
      purchaseOrderId: 9102,
      purchaseOrderNo: 'PO-2026-000124',
      erpPurchaseOrderNo: 'ERP-PO-000124',
      supplierId: 4001,
      businessUnitId: BUSINESS_UNIT_ID,
      plantId: PLANT_ID,
      orderDate: dayOf(shift(now, -5)),
      expectedReceiptDate: today,
      statusCode: 'OPEN',
      approvalRequestId: null,
    },
  ];

  /*
   * 첫 발주의 첫 줄은 누적 입하가 있다 — 분할 납품의 마지막 회차·누적 초과를 이 줄로 시험한다.
   * 남은 예정은 300 이다.
   */
  const purchaseOrderLines = [
    {
      purchaseOrderLineId: 9201,
      purchaseOrderId: 9101,
      lineNo: 1,
      itemId: 2002,
      orderedQty: 500,
      uomId: 1001,
      receivedQty: 200,
      toleranceOverQty: 10,
      toleranceUnderQty: 5,
    },
    {
      purchaseOrderLineId: 9202,
      purchaseOrderId: 9101,
      lineNo: 2,
      itemId: 2001,
      orderedQty: 300,
      uomId: 1001,
      receivedQty: 0,
      toleranceOverQty: 0,
      toleranceUnderQty: 0,
    },
    {
      purchaseOrderLineId: 9203,
      purchaseOrderId: 9102,
      lineNo: 1,
      itemId: 2001,
      orderedQty: 1000,
      uomId: 1001,
      receivedQty: 0,
      toleranceOverQty: 20,
      toleranceUnderQty: 20,
    },
  ];

  const inboundReceipts = [
    {
      inboundReceiptId: 9001,
      inboundReceiptNo: 'IR-2026-000210',
      supplierId: 4001,
      plantId: PLANT_ID,
      receiptDatetime: iso(-2, 10),
      deliveryNoteNo: 'DN-2026-000045',
      businessDate: dayOf(shift(now, -2)),
      statusCode: 'RECEIVED',
    },
    {
      inboundReceiptId: 9002,
      inboundReceiptNo: 'IR-2026-000211',
      supplierId: 4001,
      plantId: PLANT_ID,
      receiptDatetime: iso(-1, 11),
      deliveryNoteNo: 'DN-2026-000046',
      businessDate: dayOf(shift(now, -1)),
      statusCode: 'RECEIVED',
    },
  ];

  const inboundReceiptLines = [
    {
      inboundReceiptLineId: 9301,
      inboundReceiptId: 9001,
      lineNo: 1,
      purchaseOrderLineId: 9201,
      itemId: 2002,
      receivedQty: 200,
      uomId: 1001,
      packageCount: 4,
      supplierLotNo: MATERIAL_LOT_A,
      supplierLotMissing: false,
      substituteLotReasonCode: null,
      lotId: 8001,
      labelIssued: true,
    },
    {
      inboundReceiptLineId: 9302,
      inboundReceiptId: 9002,
      lineNo: 1,
      purchaseOrderLineId: 9202,
      itemId: 2002,
      receivedQty: 120,
      uomId: 1001,
      packageCount: 2,
      supplierLotNo: MATERIAL_LOT_HELD,
      supplierLotMissing: false,
      substituteLotReasonCode: null,
      lotId: 8003,
      labelIssued: true,
    },
  ];

  /* 적치 지시는 사번에 매인다 — 목록이 assignedWorkerId 로 걸린다. */
  const putawayTasks = [
    {
      putawayTaskId: 9401,
      putawayTaskNo: 'PT-2026-000512',
      goodsReceiptLineId: 9301,
      itemId: 2002,
      lotId: 8001,
      taskQty: 200,
      uomId: 1001,
      fromLocationId: 3003,
      recommendedLocationId: 3001,
      appliedPutawayRuleId: 9501,
      actualLocationId: null,
      warehouseId: 1001,
      warehouseManagementLevelCode: 'ZONE',
      priorityNo: 1,
      statusCode: 'ASSIGNED',
      assignedWorkerId: 1001,
      completedAt: null,
    },
    {
      putawayTaskId: 9402,
      putawayTaskNo: 'PT-2026-000513',
      goodsReceiptLineId: 9302,
      itemId: 2002,
      lotId: 8003,
      taskQty: 120,
      uomId: 1001,
      fromLocationId: 3003,
      /* 권장 위치가 없는 품목 — 확인 후 통과 갈래를 이 지시로 시험한다. */
      recommendedLocationId: null,
      appliedPutawayRuleId: null,
      actualLocationId: null,
      warehouseId: 1001,
      warehouseManagementLevelCode: 'ZONE',
      priorityNo: 2,
      statusCode: 'ASSIGNED',
      assignedWorkerId: 1001,
      completedAt: null,
    },
  ];

  /*
   * 피킹 지시. 라인마다 사람이 읽을 값을 함께 담는다 - 계약이 그렇게 내려주기로 했고,
   * 모바일은 오프라인에서 마스터를 갱신할 수 없어 되짚어 부르지 못한다.
   */
  const pickingOrders = [
    {
      pickingOrderId: 16001,
      pickingOrderNo: 'PK-2026-000077',
      pickingTypeCode: 'PRODUCTION',
      sourceDocumentTypeCode: 'MATERIAL_ISSUE_REQUEST',
      sourceDocumentId: 16101,
      warehouseId: 1001,
      statusCode: 'ASSIGNED',
      assignedWorkerId: 1001,
    },
  ];

  const pickingLines = [
    {
      pickingLineId: 16201,
      pickingOrderId: 16001,
      lineNo: 1,
      itemId: 2002,
      lotId: 8001,
      locationId: 3001,
      plannedQty: 200,
      pickedQty: 0,
      uomId: 1001,
      inventoryReservationId: 16301,
      statusCode: 'ASSIGNED',
      held: false,
      holdReasonCode: null,
      itemCode: 'ABC-123',
      itemName: '하우징 커버 A',
      lotNo: MATERIAL_LOT_A,
      locationCode: 'A-01-03',
      expiryDate: dayOf(shift(now, 340)),
      manufacturedAt: iso(-20),
      /* 선출 순위는 서버가 매긴다. 이 품목에 두 LOT 이 있어 순서가 갈린다. */
      pickSequenceRank: 2,
    },
    {
      pickingLineId: 16202,
      pickingOrderId: 16001,
      lineNo: 2,
      itemId: 2002,
      lotId: 8003,
      locationId: 3003,
      plannedQty: 120,
      pickedQty: 0,
      uomId: 1001,
      inventoryReservationId: null,
      statusCode: 'ASSIGNED',
      /* 보류는 서버가 표시해 내려준다. 화면은 이 값만 보고 라인을 비활성으로 둔다. */
      held: true,
      holdReasonCode: 'INSPECTION_PENDING',
      itemCode: 'ABC-123',
      itemName: '하우징 커버 A',
      lotNo: MATERIAL_LOT_HELD,
      locationCode: 'TMP-01',
      expiryDate: dayOf(shift(now, 360)),
      manufacturedAt: iso(-3),
      pickSequenceRank: 1,
    },
    {
      pickingLineId: 16203,
      pickingOrderId: 16001,
      lineNo: 3,
      itemId: 2001,
      lotId: 8002,
      locationId: 3001,
      plannedQty: 100,
      pickedQty: 0,
      uomId: 1001,
      inventoryReservationId: 16302,
      statusCode: 'ASSIGNED',
      held: false,
      holdReasonCode: null,
      itemCode: 'RM-1001',
      itemName: '수지A',
      lotNo: MATERIAL_LOT_B,
      locationCode: 'A-01-03',
      expiryDate: dayOf(shift(now, 200)),
      manufacturedAt: iso(-15),
      pickSequenceRank: 1,
    },
  ];

  const reservations = [
    {
      inventoryReservationId: 16301,
      lotId: 8001,
      itemId: 2002,
      warehouseId: 1001,
      locationId: 3001,
      reservedQty: 200,
      releasedQty: 0,
      consumedQty: 0,
      uomId: 1001,
    },
    {
      inventoryReservationId: 16302,
      lotId: 8002,
      itemId: 2001,
      warehouseId: 1001,
      locationId: 3001,
      reservedQty: 100,
      releasedQty: 0,
      consumedQty: 0,
      uomId: 1001,
    },
  ];

  /* 출하 요청은 오늘 날짜로 걸린다 — 박아 두면 다음 날 목록이 빈다. */
  const shipmentRequests = [
    {
      shipmentRequestId: 9601,
      shipmentRequestNo: 'SR-2026-0813-0108',
      salesOrderId: 9701,
      customerId: 4001,
      plantId: PLANT_ID,
      shipDate: today,
      statusCode: 'RELEASED',
      minimumShelfLifeDays: 90,
    },
    /* W-04-06 — 고객사 B 의 지시서. 확정된 출하 둘이 여기서 나갔다. */
    {
      shipmentRequestId: 9602,
      shipmentRequestNo: 'SR-2026-0820-0112',
      salesOrderId: 9702,
      customerId: 4002,
      plantId: PLANT_ID,
      shipDate: dayOf(shift(now, -7)),
      statusCode: 'COMPLETED',
      minimumShelfLifeDays: 90,
    },
  ];

  const shipmentRequestLines = [
    {
      shipmentRequestLineId: 9801,
      shipmentRequestId: 9601,
      lineNo: 1,
      itemId: 2003,
      allocatedQty: 300,
      pickedQty: 0,
      uomId: 1001,
      fifoPolicyCode: 'FEFO',
    },
  ];

  /*
   * W-04-06 — 반품이 돌아올 «원 출하». 확정된 출하 둘(라인·배분 포함)과 미확정 하나(W-04-12 몫).
   * 배분 번호가 반품 라인의 `originalShipmentLotAllocationId` 가 된다 — 한 LOT 이 여러 출하에 나뉘어
   * 나가므로 서버는 LOT 만으로 못 잇는다.
   */
  const shipmentAllocation = (allocation) => ({
    itemId: 2003,
    itemCode: 'FG-1001',
    warehouseId: 1002,
    uomId: 1001,
    oqcPassed: true,
    ...allocation,
    /* ⚠ 기본은 «아직 안 담았다»(0)다 — 전량 담긴 값으로 두면 P-04-01 이 늘 「잔여 없음」이 된다. */
    packedQty: allocation.packedQty ?? 0,
  });
  const shipments = [
    {
      shipmentId: 9901,
      shipmentNo: 'SH-2026-0455',
      shipmentRequestId: 9602,
      warehouseId: 1002,
      statusCode: 'CONFIRMED',
      shippedAt: iso(-6, 15),
      expedited: false,
      lines: [
        {
          shipmentLineId: 9911,
          lineNo: 1,
          shipmentRequestLineId: 9801,
          itemId: 2003,
          shippedQty: 300,
          uomId: 1001,
          allocations: [
            shipmentAllocation({
              shipmentLotAllocationId: 9921,
              shipmentId: 9901,
              shipmentLineId: 9911,
              lotId: 8201,
              lotNo: 'FLOT-2026-0311',
              allocatedQty: 180,
            }),
            shipmentAllocation({
              shipmentLotAllocationId: 9922,
              shipmentId: 9901,
              shipmentLineId: 9911,
              lotId: 8202,
              lotNo: 'FLOT-2026-0305',
              allocatedQty: 120,
              /* 일부만 담긴 배분 — 잔여 계산이 도는지 손으로 볼 수 있게 한 자리다. */
              packedQty: 60,
            }),
          ],
        },
      ],
      versionNo: 1,
    },
    {
      shipmentId: 9902,
      shipmentNo: 'SH-2026-0448',
      shipmentRequestId: 9602,
      warehouseId: 1002,
      statusCode: 'CONFIRMED',
      shippedAt: iso(-9, 11),
      expedited: false,
      lines: [
        {
          shipmentLineId: 9912,
          lineNo: 1,
          shipmentRequestLineId: 9801,
          itemId: 2003,
          shippedQty: 200,
          uomId: 1001,
          allocations: [
            shipmentAllocation({
              shipmentLotAllocationId: 9923,
              shipmentId: 9902,
              shipmentLineId: 9912,
              lotId: 8201,
              lotNo: 'FLOT-2026-0311',
              allocatedQty: 200,
            }),
          ],
        },
      ],
      versionNo: 1,
    },
    {
      shipmentId: 9903,
      shipmentNo: 'SH-2026-0461',
      shipmentRequestId: 9601,
      warehouseId: 1002,
      statusCode: 'UNCONFIRMED',
      shippedAt: iso(-1, 16),
      expedited: false,
      lines: [
        {
          shipmentLineId: 9913,
          lineNo: 1,
          shipmentRequestLineId: 9801,
          itemId: 2003,
          shippedQty: 100,
          uomId: 1001,
          allocations: [
            shipmentAllocation({
              shipmentLotAllocationId: 9924,
              shipmentId: 9903,
              shipmentLineId: 9913,
              lotId: 8201,
              lotNo: 'FLOT-2026-0311',
              allocatedQty: 100,
            }),
          ],
        },
      ],
      versionNo: 1,
    },
  ];

  const workOrders = [
    {
      workOrderId: 11001,
      workOrderNo: 'WO-2026-000210',
      routingOperationId: 12101,
      routingOperationName: '사출',
      itemId: 2003,
      orderQty: 500,
      predecessorOfWorkOrderId: null,
      releasedAt: iso(-3),
      completedAt: iso(-1, 17),
    },
    {
      workOrderId: 11002,
      workOrderNo: 'WO-2026-000227',
      routingOperationId: 12102,
      routingOperationName: '조립 2호',
      itemId: 2003,
      orderQty: 500,
      /* 11001 의 후속 — WIP 공정 이동의 「다음 공정」 후보로 나온다. */
      predecessorOfWorkOrderId: 11001,
      releasedAt: iso(-2),
      completedAt: null,
    },
    {
      workOrderId: 11003,
      workOrderNo: 'WO-2026-000228',
      routingOperationId: 12103,
      routingOperationName: '외주 도장',
      itemId: 2003,
      orderQty: 500,
      /* 후속이 둘이라 작업자가 고른다 — 외주 분기다. 아직 배포되지 않아 경고가 뜬다. */
      predecessorOfWorkOrderId: 11001,
      releasedAt: null,
      completedAt: null,
    },
  ].map((workOrder) => ({
    productionPlanId: 12001,
    productionOrderId: 12201,
    productionOrderNo: 'PO-2026-000123',
    uomId: 1001,
    workOrderTypeCode: 'NORMAL',
    priorityNo: 1,
    statusCode: workOrder.completedAt === null ? 'RELEASED' : 'COMPLETED',
    itemCode: 'FG-1001',
    closedAt: null,
    poMismatch: false,
    versionNo: 1,
    ...workOrder,
  }));

  const handlingUnits = [
    {
      handlingUnitId: 13001,
      handlingUnitNo: 'HU-2026-000058',
      handlingUnitTypeCode: 'CARTON',
      parentHandlingUnitId: null,
      warehouseId: 1002,
      locationId: 3004,
      statusCode: 'ACTIVE',
    },
    {
      handlingUnitId: 13002,
      handlingUnitNo: 'HU-2026-000059',
      handlingUnitTypeCode: 'CARTON',
      parentHandlingUnitId: null,
      warehouseId: 1002,
      locationId: 3004,
      statusCode: 'ACTIVE',
    },
  ];

  /* 두 포장에 같은 LOT 이 들어 있다 — 합병에서 합쳐지는 갈래를 이것으로 시험한다. */
  const handlingUnitContents = [
    {
      handlingUnitContentId: 13101,
      handlingUnitId: 13001,
      itemId: 2003,
      lotId: 8201,
      qty: 180,
      uomId: 1001,
    },
    {
      handlingUnitContentId: 13102,
      handlingUnitId: 13001,
      itemId: 2003,
      lotId: 8202,
      qty: 60,
      uomId: 1001,
    },
    {
      handlingUnitContentId: 13103,
      handlingUnitId: 13002,
      itemId: 2003,
      lotId: 8201,
      qty: 120,
      uomId: 1001,
    },
  ];

  const defectRecords = [
    {
      defectRecordId: 14001,
      lotId: 8102,
      itemId: 2003,
      workOrderId: 11001,
      defectQty: 20,
      uomId: 1001,
      defectTypeCode: 'SCRATCH',
      dispositionCode: 'REPAIR',
      occurredAt: iso(-1, 15),
      statusCode: 'OPEN',
    },
  ];

  /**
   * 검사 의뢰. **실적 입력의 선행 판정이 이 목록으로 갈린다** — 아직 끝나지 않은 PQC 가 있으면
   * 작업실적 등록(P-02-04)이 막히고 검사 화면으로 보낸다.
   *
   * 그래서 진행 중인 W/O 를 둘로 갈라 둔다 — **11002 는 남은 PQC 가 없어 실적을 넣을 수 있고,
   * 11003 은 남아 있어 막힌다.** 한쪽만 두면 둘 중 한 갈래를 화면에서 볼 수 없다.
   *
   * ⛔ **의뢰를 만드는 경로는 계약에 없다**(서버가 만든다). 여기서도 씨앗으로만 둔다.
   */
  const inspectionRequests = [
    {
      inspectionRequestId: 16001,
      inspectionRequestNo: 'IR-2026-0903-0001',
      inspectionTypeCode: 'PQC',
      inspectionPlanVersionId: 1001,
      targetTypeCode: 'LOT',
      targetId: 8103,
      itemId: 2003,
      lotId: 8103,
      workOrderId: 11003,
      productionResultId: null,
      targetQty: 120,
      uomId: 1001,
      coverageFromAt: iso(0, 8),
      coverageToAt: iso(0, 12),
      statusCode: 'REQUESTED',
      requestedAt: iso(0, 12),
      versionNo: 1,
    },
    /* 끝난 의뢰. `pendingOnly=true` 가 이것을 걸러 내는지 확인할 자리다. */
    {
      inspectionRequestId: 16002,
      inspectionRequestNo: 'IR-2026-0902-0007',
      inspectionTypeCode: 'PQC',
      inspectionPlanVersionId: 1001,
      targetTypeCode: 'LOT',
      targetId: 8101,
      itemId: 2003,
      lotId: 8101,
      workOrderId: 11002,
      productionResultId: null,
      targetQty: 480,
      uomId: 1001,
      coverageFromAt: iso(-1, 8),
      coverageToAt: iso(-1, 17),
      statusCode: 'COMPLETED',
      requestedAt: iso(-1, 17),
      versionNo: 1,
    },
  ];

  const approvalRequests = [
    {
      approvalRequestId: 15001,
      approvalTypeCode: 'IQC_SKIP',
      targetTypeCode: 'INBOUND_LOT',
      targetId: 8003,
      requestedByWorkerNo: '100027',
      requestedAt: iso(-1, 13),
      reason: '긴급 생산 투입 — 수입검사 대기 중',
      statusCode: 'PENDING',
      isMyTurn: false,
    },
  ];

  /*
   * W-04-07 판정 대기 대상 — 불량창고(1003)에 들어온 제품 LOT 둘. 반품 갈래 하나(부적합 아직 없음),
   * OQC 불합격 갈래 하나(이미 판정까지 끝나 ③ 결과 구획이 채워진다). 값은 전부 지어낸 것이다.
   */
  const dispositionCandidates = [
    {
      lotId: 8201,
      lotNo: 'FLOT-2026-0311',
      itemId: 2003,
      itemCode: 'FG-1001',
      itemName: '외장 커버',
      quantity: 200,
      uomId: 1001,
      warehouseId: 1003,
      warehouseName: '1공장 불량창고',
      sourceCode: 'RETURN',
      goodsReceiptId: 9601,
      receiptNo: 'RT-2026-0044',
      receivedAt: dayOf(shift(now, -2)),
      partnerName: '합성 거래처 B',
      inspectionResultId: null,
      nonconformanceId: null,
      nonconformanceNo: null,
      nonconformanceStatusCode: null,
    },
    {
      lotId: 8202,
      lotNo: 'FLOT-2026-0305',
      itemId: 2003,
      itemCode: 'FG-1001',
      itemName: '외장 커버',
      quantity: 300,
      uomId: 1001,
      warehouseId: 1003,
      warehouseName: '1공장 불량창고',
      sourceCode: 'PRODUCT',
      goodsReceiptId: null,
      receiptNo: null,
      receivedAt: dayOf(shift(now, -4)),
      partnerName: null,
      inspectionResultId: 5301,
      nonconformanceId: 7001,
      nonconformanceNo: 'NC-2026-0903-0001',
      nonconformanceStatusCode: 'DECIDED',
    },
  ];

  const nonconformances = [
    {
      nonconformanceId: 7001,
      nonconformanceNo: 'NC-2026-0903-0001',
      itemId: 2003,
      inspectionResultId: 5301,
      sourceCode: 'PRODUCT',
      severityCode: 'MAJOR',
      description: '외관 스크래치 · 상단 모서리 · 300개 중 60개 육안 확인',
      statusCode: 'DECIDED',
      openedAt: iso(-4, 11),
      affectedQtyTotal: 300,
      uomId: 1001,
      dispositionProgressCode: 'PARTIAL',
      lots: [
        {
          nonconformanceLotId: 7101,
          lotId: 8202,
          lotNo: 'FLOT-2026-0305',
          affectedQty: 300,
          uomId: 1001,
          qualityStatusBeforeCode: 'NORMAL',
          qualityStatusAfterCode: 'DEFECTIVE',
        },
      ],
      versionNo: 3,
    },
  ];

  const dispositionDecisions = [
    {
      dispositionDecisionId: 7201,
      nonconformanceId: 7001,
      nonconformanceNo: 'NC-2026-0903-0001',
      dispositionTypeCode: 'REWORK',
      decisionQty: 240,
      uomId: 1001,
      reason: '표면 손상만 있어 재작업으로 회복된다',
      decidedBy: 4001,
      decidedAt: iso(-1, 14),
      approvalRequestId: null,
      lotId: 8202,
      lotNo: 'FLOT-2026-0305',
      itemId: 2003,
      followUpStatusCode: 'NOT_STARTED',
      followUpQty: 0,
    },
    {
      dispositionDecisionId: 7202,
      nonconformanceId: 7001,
      nonconformanceNo: 'NC-2026-0903-0001',
      dispositionTypeCode: 'SCRAP',
      decisionQty: 60,
      uomId: 1001,
      reason: '균열이 있어 회복할 수 없다',
      decidedBy: 4001,
      decidedAt: iso(-1, 14),
      approvalRequestId: null,
      lotId: 8202,
      lotNo: 'FLOT-2026-0305',
      itemId: 2003,
      followUpStatusCode: 'NOT_STARTED',
      followUpQty: 0,
    },
  ];
  return {
    plantId: PLANT_ID,
    today,
    workers,
    uoms,
    items,
    warehouses,
    locations,
    partners,
    equipments,
    inspectionItems,
    codeValues,
    lots,
    holds,
    balances,
    purchaseOrders,
    purchaseOrderLines,
    inboundReceipts,
    inboundReceiptLines,
    inboundVariances: [],
    putawayTasks,
    pickingOrders,
    pickingLines,
    reservations,
    goodsIssues: [],
    shipmentRequests,
    shipmentRequestLines,
    shipments,
    goodsReceiptLines: [],
    workOrders,
    handlingUnits,
    handlingUnitContents,
    defectRecords,
    repairExecutions: [],
    inspectionRequests,
    inspections: [],
    breakdowns: [],
    operationHandovers: [],
    approvalRequests,
    goodsReceipts: [],
    productionResults: [],
    dispositionCandidates,
    nonconformances,
    dispositionDecisions,
    documentIssues: [],
    /** 개체(일련번호) — P-02-05 가 발번해 채운다. 씨앗은 비워 둔다(발번 전 상태가 기본이다). */
    serialNumbers: [],
    /** 스캔해 볼 값 — 시험 키트가 이 목록을 그대로 인쇄한다. */
    scannables: {
      workerNos: workers.map((worker) => worker.workerNo),
      materialLots: [MATERIAL_LOT_A, MATERIAL_LOT_B, MATERIAL_LOT_HELD],
      productionLots: ['PLOT-2026-0031', 'PLOT-2026-0032'],
      productLots: ['FLOT-2026-0311', 'FLOT-2026-0305'],
      locationCodes: ['A-01-03', 'A-01-04', 'TMP-01', 'FG-A-02-01'],
      equipmentCodes: ['PRS-01', 'EQ-03'],
      handlingUnitNos: ['HU-2026-000058', 'HU-2026-000059'],
    },
  };
};

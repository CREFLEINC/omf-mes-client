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

  const items = [
    { itemId: 2001, itemCode: 'RM-1001', itemName: '수지A', fifoPolicyCode: 'FEFO' },
    { itemId: 2002, itemCode: 'ABC-123', itemName: '하우징 커버 A', fifoPolicyCode: 'FIFO' },
    { itemId: 2003, itemCode: 'FG-1001', itemName: '외장 커버', fifoPolicyCode: 'FEFO' },
  ].map((item) => ({
    ...item,
    plantId: PLANT_ID,
    baseUomId: 1001,
    itemTypeCode: item.itemId === 2003 ? 'PRODUCT' : 'MATERIAL',
    isActive: true,
  }));

  const warehouses = [
    { warehouseId: 1001, warehouseCode: 'WH-01', warehouseName: '1공장 자재창고' },
    { warehouseId: 1002, warehouseCode: 'WH-02', warehouseName: '1공장 완제품창고' },
  ].map((warehouse) => ({
    ...warehouse,
    plantId: PLANT_ID,
    /* 구역 수준이면 위치를 관리한다. 창고 수준이면 위치 스캔을 건너뛴다. */
    managementLevelCode: 'ZONE',
    isActive: true,
  }));

  const locations = [
    { locationId: 3001, warehouseId: 1001, locationCode: 'A-01-03', locationName: 'A구역 01열 03단' },
    { locationId: 3002, warehouseId: 1001, locationCode: 'A-01-04', locationName: 'A구역 01열 04단' },
    { locationId: 3003, warehouseId: 1001, locationCode: 'TMP-01', locationName: '하역장 임시자리' },
    { locationId: 3004, warehouseId: 1002, locationCode: 'FG-A-02-01', locationName: '완제품 A구역 02열 01단' },
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
    RECEIPT_TYPE: [
      ['PURCHASE', '구매 입고'],
      ['PRODUCTION', '제품 입고'],
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
      progress: { goodQty: 480, defectQty: 20 },
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
      progress: { goodQty: 180, defectQty: 20 },
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
    { handlingUnitContentId: 13101, handlingUnitId: 13001, itemId: 2003, lotId: 8201, qty: 180, uomId: 1001 },
    { handlingUnitContentId: 13102, handlingUnitId: 13001, itemId: 2003, lotId: 8202, qty: 60, uomId: 1001 },
    { handlingUnitContentId: 13103, handlingUnitId: 13002, itemId: 2003, lotId: 8201, qty: 120, uomId: 1001 },
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
    shipmentRequests,
    shipmentRequestLines,
    workOrders,
    handlingUnits,
    handlingUnitContents,
    defectRecords,
    repairExecutions: [],
    inspections: [],
    breakdowns: [],
    operationHandovers: [],
    approvalRequests,
    goodsReceipts: [],
    productionResults: [],
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

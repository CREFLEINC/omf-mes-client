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
    /*
     * 같은 품목코드로 신재 행과 재생재 행이 함께 온다. 재생재 등록은 그 둘 중 재생재 행을
     * 골라 재고를 세우므로, 재생재 행이 없으면 그 화면은 늘 등록되지 않은 품목이라고만 말한다.
     */
    {
      itemId: 2004,
      itemCode: 'RM-1001',
      itemName: '수지A',
      labelName: 'PC RESIN BLK',
      fifoPolicyCode: 'FEFO',
      mesCategoryCode: 'RECYCLED',
    },
  ].map((item) => ({
    mesCategoryCode: 'NEW',
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

  /*
   * 금형 둘. **씨앗이 답하지 않으면 계약 예시가 답하고, 예시는 «무엇을 물어도» 금형을
   * 하나 돌려준다** — 자재 투입 화면은 칸이 하나라 자재LOT 을 스캔해도 금형으로 잡혀
   * 담은 자재가 계속 비었다(실측 2026-09-08 · 실기).
   */
  const molds = [
    {
      moldId: 6001,
      plantId: PLANT_ID,
      moldCode: 'MLD-0207',
      moldName: '하우징 프레스 금형',
      toolTypeCode: 'MOLD',
      cavityCount: 1,
      guaranteedShotCount: 500000,
      currentShotCount: 128400,
      availableShotCount: 371600,
      statusCode: 'IN_SERVICE',
      isActive: true,
      pmTriggerTypeCode: 'NONE',
      pmCycleInterval: 6,
      pmCycleUnitCode: 'MONTH',
      lastPmDate: dayOf(shift(now, -120)),
      nextPmDate: dayOf(shift(now, 60)),
      pmDue: false,
    },
    /* 적정 타수가 없는 금형 — 「남은 타수 산출 불가」를 재 볼 자리다. */
    {
      moldId: 6002,
      plantId: PLANT_ID,
      moldCode: 'MLD-0311',
      moldName: '커버 사출 금형',
      toolTypeCode: 'MOLD',
      cavityCount: 2,
      guaranteedShotCount: null,
      currentShotCount: 4200,
      availableShotCount: null,
      statusCode: 'IN_SERVICE',
      isActive: true,
      pmTriggerTypeCode: 'NONE',
      pmCycleInterval: null,
      pmCycleUnitCode: null,
      lastPmDate: null,
      nextPmDate: null,
      pmDue: false,
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
    /* W-CO-02 — 사용자 인사 상태. 고객이 추가할 수 있는 초기 시드이며 계정 사용 여부와 별개다. */
    APP_USER_STATUS: [
      ['EMPLOYED', '재직'],
      ['ON_LEAVE', '휴직'],
      ['RESIGNED', '퇴사'],
    ],
    /*
     * P-05-02 — 비가동 사유. **평면 1단**이고 아래 여섯은 계약이 적어 둔 초기 시드다
     * (`omf-mes#198` · 공유계약 G-32). 고객이 늘리는 목록이라(G-31) 이것이 전부가 아니다.
     */
    DOWNTIME_REASON: [
      ['EQUIPMENT_FAILURE', '설비 고장'],
      ['MOLD_CHANGE', '금형 교체'],
      ['MATERIAL_WAIT', '자재 대기'],
      ['LABOR_WAIT', '작업자 대기'],
      ['PREVENTIVE_MAINTENANCE', '예방 보전'],
      ['OTHER', '기타'],
    ],
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
    /* W-02-05 · W-02-08 — 작업지시 상태(시스템 값 · 8값 중 화면이 쓰는 넷)와 마감 변동 사유(고객 시드). */
    WORK_ORDER_STATUS: [
      ['RELEASED', '배포'],
      ['IN_PROGRESS', '진행 중'],
      ['COMPLETED', '생산 완료'],
      ['CLOSED', '마감'],
    ],
    WORK_ORDER_COMPLETION_VARIANCE_REASON: [
      ['MATERIAL_SHORTAGE', '자재 부족'],
      ['EQUIPMENT_FAILURE', '설비 고장'],
      ['PLAN_CHANGE', '계획 변경'],
    ],
    PRODUCTION_RESULT_CORRECT_REASON: [
      ['COUNT_ERROR', '집계 오류'],
      ['REINSPECTION', '검사 재판정'],
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
    /* W-03-02 — 해제 사유는 등록 사유와 대칭인 필수 축(고객 시드 4값). */
    LOT_HOLD_RELEASE_REASON: [
      ['RETEST_PASS', '재검사 합격'],
      ['RETEST_FAIL', '재검사 불합격'],
      ['INVESTIGATION_CLEARED', '조사 종결'],
      ['MANAGER_OVERRIDE', '관리자 판단'],
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
      ['FORMAT_UNRECOGNIZED', '형식 미인식'],
      ['BULK_UNLABELED', '벌크 미부착'],
      ['OTHER', '기타'],
    ],
    INBOUND_RECEIPT_EXCEPTION_TYPE: [
      ['CUSTOMER_SUPPLY', '고객 지급'],
      ['FREE_SAMPLE', '무상 샘플'],
      ['URGENT_RECEIPT', '긴급 입하'],
      ['OVER_DELIVERY', '초과 납품'],
    ],
    INBOUND_VARIANCE_TYPE: [
      ['SHORTAGE', '수량 부족'],
      ['OVERAGE', '수량 초과'],
      ['DAMAGED', '파손'],
      ['WRONG_ITEM', '품목 상이'],
    ],
    /* 적는 것은 선택이지만, 비어 있으면 고르는 칸이 빈 채로 열려 시험할 것이 없다. */
    INBOUND_VARIANCE_REASON: [
      ['TRANSPORT_DAMAGE', '운송 중 파손'],
      ['SUPPLIER_SHORTAGE', '공급사 결품'],
      ['PACKING_ERROR', '포장 오류'],
      ['ETC', '기타'],
    ],
    VARIANCE_REASON: [
      ['MISCOUNT', '계수 착오'],
      ['SPILLAGE', '운반 중 손실'],
      ['LEFT_BEHIND', '잔량 미인계'],
      ['ETC', '기타'],
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
      lifecycleStatusCode: 'ACTIVE',
      workOrderSequenceNo: 1,
      workOrderLotCount: 2,
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
      lifecycleStatusCode: 'ACTIVE',
      workOrderSequenceNo: 2,
      workOrderLotCount: 2,
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
      lifecycleStatusCode: 'ACTIVE',
      workOrderSequenceNo: 1,
      workOrderLotCount: 1,
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
    workOrderSequenceNo: null,
    workOrderLotCount: null,
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
  ].map((balance, index) => {
    /*
     * 사람이 읽는 값을 잔액 줄에 함께 싣는다. 계약이 「이 값이 있으므로 마스터를 다시 부르지
     * 않는다」로 못 박은 자리라, 여기가 비면 화면은 부를 곳도 없이 「알 수 없음」만 보인다.
     */
    const item = items.find((each) => each.itemId === balance.itemId);
    const warehouse = warehouses.find((each) => each.warehouseId === balance.warehouseId);
    const location = locations.find((each) => each.locationId === balance.locationId);
    const lot = lots.find((each) => each.lotId === balance.lotId);

    return {
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
      itemCode: item?.itemCode,
      itemName: item?.itemName,
      lotNo: lot?.lotNo ?? null,
      warehouseName: warehouse?.warehouseName ?? null,
      locationCode: location?.locationCode ?? null,
      locationName: location?.locationName ?? null,
    };
  });

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
    /*
     * 도착 때 라벨을 못 스캔한 사전부착 라인. 자재LOT 스캔·등록(M-01-02)이 이것을 골라 채운다.
     *
     * 부착인데 LOT 이 비어 있는 라인이 하나도 없으면 그 화면이 대상을 하나도 못 받아,
     * 대상을 고르는 자리부터 재 볼 수 없다.
     *
     * 두 입하 건에 나눠 여럿을 둔다. 하나만 두면 한 번 등록한 뒤 그 화면이 닫히고, 대상을
     * 고르는 칸에서 다른 입하 건을 골라 본 사람은 처음부터 빈 목록을 만난다.
     */
    {
      inboundReceiptLineId: 9303,
      inboundReceiptId: 9002,
      lineNo: 2,
      purchaseOrderLineId: null,
      itemId: 2001,
      receivedQty: 60,
      uomId: 1001,
      packageCount: 1,
      supplierLotNo: null,
      supplierLotMissing: false,
      substituteLotReasonCode: null,
      lotId: null,
      labelIssued: false,
    },
    /* main 이 더한 여벌 라인 셋 — 되돌릴 수 없는 화면을 다시 짚어 보게 한다(#906). */
    {
      inboundReceiptLineId: 9304,
      inboundReceiptId: 9002,
      lineNo: 3,
      purchaseOrderLineId: null,
      itemId: 2002,
      receivedQty: 100,
      uomId: 1001,
      packageCount: 2,
      supplierLotNo: null,
      supplierLotMissing: false,
      substituteLotReasonCode: null,
      lotId: null,
      labelIssued: false,
    },
    {
      inboundReceiptLineId: 9305,
      inboundReceiptId: 9001,
      lineNo: 2,
      purchaseOrderLineId: null,
      itemId: 2001,
      receivedQty: 80,
      uomId: 1001,
      packageCount: 2,
      supplierLotNo: null,
      supplierLotMissing: false,
      substituteLotReasonCode: null,
      lotId: null,
      labelIssued: false,
    },
    {
      inboundReceiptLineId: 9306,
      inboundReceiptId: 9001,
      lineNo: 3,
      purchaseOrderLineId: null,
      itemId: 2002,
      receivedQty: 40,
      uomId: 1001,
      packageCount: 1,
      supplierLotNo: null,
      supplierLotMissing: false,
      substituteLotReasonCode: null,
      lotId: null,
      labelIssued: false,
    },
    /*
     * 미부착 라인 — 공급사가 라벨을 붙이지 않고 보낸 것. 자재LOT 등록·라벨 발행(P-01-01)이
     * 이것을 받아 LOT 을 발번하고 라벨을 찍는다.
     *
     * ⚠ **이 줄이 없으면 그 화면이 목록부터 비어 뜬다**(실측 2026-09-08). 그 화면은
     * 「미부착이면서 아직 라벨을 찍지 않은」 라인만 서버에서 걸러 받는데, 씨앗의 라인은
     * 나머지가 전부 부착이거나 이미 발행된 것이라 조건에 걸리는 줄이 하나도 없었다.
     */
    {
      inboundReceiptLineId: 9307,
      inboundReceiptId: 9001,
      lineNo: 4,
      purchaseOrderLineId: null,
      itemId: 2001,
      receivedQty: 150,
      uomId: 1001,
      packageCount: 3,
      supplierLotNo: null,
      supplierLotMissing: true,
      substituteLotReasonCode: null,
      lotId: null,
      labelIssued: false,
    },
  ];

  /*
   * 오늘 친 일상 점검 한 건. **작업 전 점검 관문이 이걸 찾는다** — 주기 창(일상=오늘) 안에
   * 합격 기록이 있어야 작업 시작이 열린다. 없으면 「점검을 하고 시작하세요」로 막힌다.
   */
  const inspections = [
    {
      inspectionId: 7101,
      equipmentId: 5001,
      inspectionTypeCode: 'DAILY',
      overallResultCode: 'PASS',
      inspectedAt: iso(0, 7),
      inspectedBy: 1001,
      remarks: null,
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
    /*
     * 여벌 지시. 위 둘을 끝내면 목록이 비어 그 화면을 다시 열 수 없다 - 적치는 되돌릴 수
     * 없는 쓰기라 시험을 되풀이하려면 남은 지시가 있어야 한다.
     */
    {
      putawayTaskId: 9403,
      putawayTaskNo: 'PT-2026-000514',
      goodsReceiptLineId: 9301,
      itemId: 2001,
      lotId: 8002,
      taskQty: 300,
      uomId: 1001,
      fromLocationId: 3003,
      recommendedLocationId: 3002,
      appliedPutawayRuleId: 9501,
      actualLocationId: null,
      warehouseId: 1001,
      warehouseManagementLevelCode: 'ZONE',
      priorityNo: 3,
      statusCode: 'ASSIGNED',
      assignedWorkerId: 1001,
      completedAt: null,
    },
    {
      putawayTaskId: 9404,
      putawayTaskNo: 'PT-2026-000515',
      goodsReceiptLineId: 9302,
      itemId: 2002,
      lotId: 8001,
      taskQty: 120,
      uomId: 1001,
      fromLocationId: 3003,
      recommendedLocationId: 3001,
      appliedPutawayRuleId: 9501,
      actualLocationId: null,
      warehouseId: 1001,
      warehouseManagementLevelCode: 'ZONE',
      priorityNo: 4,
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
      /* 화면은 아직 출고할 수 있는 지시만 담는다 - 그 판정에 쓰는 값이 이것이다. */
      statusCode: 'REGISTERED',
      assignedWorkerId: 1001,
    },
    /* 여벌 지시. 앞 지시를 다 집고 출고까지 확정하면 목록이 비어 다시 열 수 없다. */
    {
      pickingOrderId: 16002,
      pickingOrderNo: 'PK-2026-000078',
      pickingTypeCode: 'PRODUCTION',
      sourceDocumentTypeCode: 'MATERIAL_ISSUE_REQUEST',
      sourceDocumentId: 16102,
      warehouseId: 1001,
      statusCode: 'REGISTERED',
      assignedWorkerId: 1001,
    },
  ];

  /*
   * 전기된 출고 전표 하나. 생산창고 입고(M-01-09)가 이것을 스캔해 받는다.
   *
   * 피킹 지시를 가리킨다 - 수령 전표가 필수로 요구하는 작업지시와 도착 위치가 출고 전표에
   * 없어, 화면이 피킹 지시를 거쳐 자재출고요청까지 따라가야 나온다. 가리키는 곳이 씨앗에
   * 없으면 그 사슬이 중간에 끊긴다.
   */
  const goodsIssues = [
    {
      goodsIssueId: 16401,
      goodsIssueNo: 'GI-2026-000401',
      issueTypeCode: 'PRODUCTION',
      sourceDocumentTypeCode: 'PICKING_ORDER',
      sourceDocumentId: 16001,
      sourceWarehouseId: 1001,
      destinationTypeCode: 'LOCATION',
      destinationId: 3001,
      issuedAt: iso(-2),
      statusCode: 'POSTED',
      reasonCode: null,
      replacementExpected: false,
      approvalRequestId: null,
      erpMessageQueued: false,
      remarks: null,
    },
    /* 여벌 전표. 앞 전표를 받고 나면 스캔할 것이 없어 그 화면을 다시 열 수 없다(#906). */
    {
      goodsIssueId: 16402,
      goodsIssueNo: 'GI-2026-000402',
      issueTypeCode: 'PRODUCTION',
      sourceDocumentTypeCode: 'PICKING_ORDER',
      sourceDocumentId: 16002,
      sourceWarehouseId: 1001,
      destinationTypeCode: 'LOCATION',
      destinationId: 3001,
      issuedAt: iso(-1),
      statusCode: 'POSTED',
      reasonCode: null,
      replacementExpected: false,
      approvalRequestId: null,
      erpMessageQueued: false,
      remarks: null,
    },
    /*
     * 세 번째 출고 전표. **번호가 15001 인 것에 뜻이 있다** — 화면 이동 메뉴가 한동안 이
     * 번호를 가리켰고, 그 설치본이 아직 현장에 남아 있다(실측 2026-09-08). 번호가 없으면
     * 그 화면이 통째로 비어 「데이터가 없다」로 보인다.
     */
    {
      goodsIssueId: 15001,
      goodsIssueNo: 'GI-2026-000403',
      issueTypeCode: 'PRODUCTION',
      sourceDocumentTypeCode: 'PICKING_ORDER',
      sourceDocumentId: 16001,
      sourceWarehouseId: 1001,
      destinationTypeCode: 'LOCATION',
      destinationId: 3001,
      issuedAt: iso(-1),
      statusCode: 'POSTED',
      reasonCode: null,
      replacementExpected: false,
      approvalRequestId: null,
      erpMessageQueued: false,
      remarks: null,
    },
  ];

  const goodsIssueLines = [
    {
      goodsIssueLineId: 16501,
      goodsIssueId: 16401,
      lineNo: 1,
      pickingLineId: 16201,
      itemId: 2002,
      lotId: 8001,
      issueQty: 200,
      uomId: 1001,
      sourceLocationId: 3001,
      inventoryTransactionLineId: null,
    },
    /* 둘째 라인이 있어야 「한 라인만 적고 확정」과 부족 수령을 함께 재 볼 수 있다. */
    {
      goodsIssueLineId: 16502,
      goodsIssueId: 16401,
      lineNo: 2,
      pickingLineId: 16203,
      itemId: 2001,
      lotId: 8002,
      issueQty: 80,
      uomId: 1001,
      sourceLocationId: 3001,
      inventoryTransactionLineId: null,
    },
    {
      goodsIssueLineId: 16503,
      goodsIssueId: 16402,
      lineNo: 1,
      pickingLineId: 16204,
      itemId: 2001,
      lotId: 8002,
      issueQty: 50,
      uomId: 1001,
      sourceLocationId: 3001,
      inventoryTransactionLineId: null,
    },
    {
      goodsIssueLineId: 16504,
      goodsIssueId: 16402,
      lineNo: 2,
      pickingLineId: 16205,
      itemId: 2002,
      lotId: 8001,
      issueQty: 60,
      uomId: 1001,
      sourceLocationId: 3002,
      inventoryTransactionLineId: null,
    },
    /* 15001 전표의 라인. 수량을 다른 전표와 다르게 두어 라벨의 수량을 눈으로 가른다. */
    {
      goodsIssueLineId: 15101,
      goodsIssueId: 15001,
      lineNo: 1,
      pickingLineId: 16201,
      itemId: 2002,
      lotId: 8001,
      issueQty: 120,
      uomId: 1001,
      sourceLocationId: 3001,
      inventoryTransactionLineId: null,
    },
    {
      goodsIssueLineId: 15102,
      goodsIssueId: 15001,
      lineNo: 2,
      pickingLineId: 16203,
      itemId: 2001,
      lotId: 8002,
      issueQty: 45,
      uomId: 1001,
      sourceLocationId: 3001,
      inventoryTransactionLineId: null,
    },
  ];

  /*
   * 돌고 있는 실사 하나. 실물 카운트(M-01-11)가 이것을 골라 위치를 스캔한다.
   *
   * 장부를 감추지 않는다 - 감춘 실사도 한 벌 두면 어느 쪽이 기본인지 흐려진다. 감춘 쪽은
   * blindCount 를 바꿔 재 본다.
   */
  const inventoryCounts = [
    {
      inventoryCountId: 5001,
      inventoryCountNo: 'IC-2026-000031',
      countTypeCode: 'PERIODIC',
      warehouseId: 1001,
      plannedDate: today,
      blindCount: false,
      statusCode: 'IN_PROGRESS',
    },
    /* 여벌 실사. 앞 실사의 위치를 끝내면 셀 것이 없어 그 화면을 다시 열 수 없다. */
    {
      inventoryCountId: 5002,
      inventoryCountNo: 'IC-2026-000032',
      countTypeCode: 'PERIODIC',
      warehouseId: 1001,
      plannedDate: today,
      blindCount: false,
      statusCode: 'IN_PROGRESS',
    },
  ];

  /*
   * 한 위치에 두 줄을 둔다. 한 줄만 적고 완료했을 때 나머지가 미실사로 남는지를 재려면
   * 안 적을 줄이 있어야 한다.
   */
  const inventoryCountLines = [
    {
      inventoryCountLineId: 5101,
      inventoryCountId: 5001,
      lineNo: 1,
      locationId: 3001,
      itemId: 2002,
      lotId: 8001,
      systemQty: 200,
      countedQty: 0,
      varianceQty: 0,
      uomId: 1001,
      varianceReasonCode: null,
      countedBy: null,
      countedAt: iso(0),
      counted: false,
    },
    {
      inventoryCountLineId: 5102,
      inventoryCountId: 5001,
      lineNo: 2,
      locationId: 3001,
      itemId: 2001,
      lotId: 8002,
      systemQty: 80,
      countedQty: 0,
      varianceQty: 0,
      uomId: 1001,
      varianceReasonCode: null,
      countedBy: null,
      countedAt: iso(0),
      counted: false,
    },
    {
      inventoryCountLineId: 5103,
      inventoryCountId: 5002,
      lineNo: 1,
      locationId: 3002,
      itemId: 2002,
      lotId: 8001,
      systemQty: 120,
      countedQty: 0,
      varianceQty: 0,
      uomId: 1001,
      varianceReasonCode: null,
      countedBy: null,
      countedAt: iso(0),
      counted: false,
    },
    {
      inventoryCountLineId: 5104,
      inventoryCountId: 5002,
      lineNo: 2,
      locationId: 3002,
      itemId: 2001,
      lotId: 8002,
      systemQty: 60,
      countedQty: 0,
      varianceQty: 0,
      uomId: 1001,
      varianceReasonCode: null,
      countedBy: null,
      countedAt: iso(0),
      counted: false,
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
      pickingLineId: 16204,
      pickingOrderId: 16002,
      lineNo: 1,
      itemId: 2001,
      lotId: 8002,
      locationId: 3001,
      plannedQty: 50,
      pickedQty: 0,
      uomId: 1001,
      inventoryReservationId: null,
      statusCode: 'ASSIGNED',
      held: false,
      holdReasonCode: null,
      itemCode: 'RM-1001',
      itemName: '수지A',
      lotNo: MATERIAL_LOT_B,
      locationCode: 'A-01-03',
      expiryDate: dayOf(shift(now, 200)),
      manufacturedAt: iso(-30),
      pickSequenceRank: 1,
    },
    {
      pickingLineId: 16205,
      pickingOrderId: 16002,
      lineNo: 2,
      itemId: 2002,
      lotId: 8001,
      locationId: 3002,
      plannedQty: 60,
      pickedQty: 0,
      uomId: 1001,
      inventoryReservationId: null,
      statusCode: 'ASSIGNED',
      held: false,
      holdReasonCode: null,
      itemCode: 'ABC-123',
      itemName: '하우징 커버 A',
      lotNo: MATERIAL_LOT_A,
      locationCode: 'A-01-04',
      expiryDate: dayOf(shift(now, 340)),
      manufacturedAt: iso(-20),
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
      requestedShipDate: today,
      statusCode: 'RELEASED',
      /* 서버 롤업 진행 상태(계약 필수) — 피킹이 끝나 출하 처리(W-04-04) 관문을 통과하는 갈래. */
      shipmentProgressCode: 'PICKED',
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
      requestedShipDate: dayOf(shift(now, -7)),
      statusCode: 'COMPLETED',
      shipmentProgressCode: 'SHIPPED',
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
    /*
     * 여벌 줄. 한 줄만 두면 배정만큼 집은 순간 오늘 출하분에 할 일이 없어져, 그 화면을 다시
     * 열어도 볼 것이 없다.
     */
    {
      shipmentRequestLineId: 9802,
      shipmentRequestId: 9601,
      lineNo: 2,
      itemId: 2003,
      allocatedQty: 200,
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
    /*
     * ⚠ **번호가 14001 인 것에 뜻이 있다** — 화면 이동 메뉴가 한동안 이 번호를 가리켰고,
     *   그 설치본이 현장에 남아 있다(실측 2026-09-08 · 출고 QR 과 같은 사정). 번호가 없으면
     *   납품·포장 라벨 화면이 「없는 자원」으로 비어 뜬다.
     */
    {
      shipmentId: 14001,
      shipmentNo: 'SH-2026-0461B',
      shipmentRequestId: 9602,
      warehouseId: 1002,
      statusCode: 'CONFIRMED',
      shippedAt: iso(0, 15),
      expedited: false,
      lines: [
        {
          shipmentLineId: 14011,
          lineNo: 1,
          shipmentRequestLineId: 9801,
          itemId: 2003,
          shippedQty: 200,
          uomId: 1001,
          allocations: [
            shipmentAllocation({
              shipmentLotAllocationId: 14021,
              shipmentId: 14001,
              shipmentLineId: 14011,
              lotId: 8201,
              lotNo: 'FLOT-2026-0311',
              allocatedQty: 120,
            }),
            shipmentAllocation({
              shipmentLotAllocationId: 14022,
              shipmentId: 14001,
              shipmentLineId: 14011,
              lotId: 8202,
              lotNo: 'FLOT-2026-0305',
              allocatedQty: 80,
              packedQty: 30,
            }),
          ],
        },
      ],
      versionNo: 1,
    },
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
              /*
               * ⭐ **포장 라벨의 대상은 이 값으로 정해진다** — 납품·포장 라벨 출력(P-04-02)이
               *    배분의 `handlingUnitId` 를 모아 그 수만큼 취급 단위를 부른다. 비어 있으면
               *    화면은 「이 출하에는 포장이 없습니다」로 서고 라벨을 한 장도 뽑을 수
               *    없다(실측 2026-09-08 · 실기).
               */
              handlingUnitId: 13001,
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
              handlingUnitId: 13002,
              /*
               * ⚠ **출하검사 미합격 한 건** — 납품 라벨은 합격한 배분만 뽑을 수 있어서,
               *    이 줄이 있어야 「⛔ 발행 불가」 갈래를 손으로 볼 수 있다. 전부 합격으로
               *    두면 화면의 잠금이 한 번도 서지 않는다.
               */
              oqcPassed: false,
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
    /*
     * 재작업 작업지시. **재작업 실적 등록(P-04-03)이 이 한 건으로 선다** — 원 LOT·근거
     * 부적합·처분을 그 화면이 이 지시에서 따라간다. 없으면 목록은 뜨는데 상세가 통째로
     * 비었다(실측 2026-09-08 · 실기).
     */
    {
      workOrderId: 11004,
      workOrderNo: 'WO-2026-000231',
      routingOperationId: 12104,
      routingOperationName: '재작업',
      itemId: 2003,
      orderQty: 160,
      predecessorOfWorkOrderId: null,
      releasedAt: iso(-1),
      completedAt: null,
      /* 재작업임을 가르는 값 — 화면이 이 유형으로 목록을 좁힌다. */
      workOrderTypeCode: 'REWORK',
      /* 근거 부적합과 원 LOT. 둘이 있어야 「원 LOT · 근거 · 처분」이 선다. */
      reworkSourceNonconformanceId: 7001,
      reworkSourceLotId: 8202,
    },
    /*
     * 긴급 작업지시 둘. **현장 긴급 W/O(P-02-12)가 이 둘로 선다** — 화면이
     * `workOrderTypeCode=EMERGENCY · open=true` 로 좁혀 묻기 때문에, 유형이 붙은 열린
     * 지시가 없으면 목록이 통째로 빈다(실측 2026-09-08 · 실기).
     *
     * ⭐ **배정 유무로 둘을 갈랐다** — 상세의 통제 우회 머리말이 4M 배정이 «전부» 비었을
     *    때와 하나라도 붙었을 때 다르게 서므로, 두 갈래를 손으로 보려면 둘이 필요하다.
     */
    {
      workOrderId: 11005,
      workOrderNo: 'WO-2026-000232E',
      routingOperationId: 12102,
      routingOperationName: '조립 2호',
      itemId: 2003,
      orderQty: 40,
      predecessorOfWorkOrderId: null,
      releasedAt: iso(0, 8),
      completedAt: null,
      workOrderTypeCode: 'EMERGENCY',
      priorityNo: 0,
    },
    {
      workOrderId: 11006,
      workOrderNo: 'WO-2026-000233E',
      routingOperationId: 12101,
      routingOperationName: '사출',
      itemId: 2003,
      orderQty: 120,
      predecessorOfWorkOrderId: null,
      releasedAt: iso(0, 10),
      completedAt: null,
      workOrderTypeCode: 'EMERGENCY',
      priorityNo: 0,
      /* 배정이 붙은 쪽 — 머리말이 「배정 없음」이 아닌 갈래로 선다. */
      plannedEquipmentId: 5002,
      plannedMoldId: 6002,
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

  /*
   * 계약이 필수로 둔 칸을 빠짐없이 싣는다. 화면은 필수 칸을 그대로 읽으므로 target 이 비면
   * 렌더가 죽어 요청 목록 자리가 통째로 열리지 않는다.
   */
  const approvalRequests = [
    {
      approvalRequestId: 15001,
      approvalRequestNo: 'AP-2026-000031',
      approvalTypeCode: 'IQC_SKIP',
      targetTypeCode: 'INBOUND_LOT',
      targetId: 8003,
      target: {
        targetTypeCode: 'INBOUND_LOT',
        targetId: 8003,
        displayName: '0001234500000012002607310001230009',
        openable: false,
      },
      requestedBy: 1001,
      requestedByName: '홍길동',
      requestedByWorkerNo: '100027',
      requestedAt: iso(-1, 13),
      reason: '긴급 생산 투입 — 수입검사 대기 중',
      statusCode: 'PENDING',
      currentStepNo: 1,
      totalStepNo: 2,
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
    inspections,
    molds,
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
    goodsIssues,
    goodsIssueLines,
    inventoryCounts,
    inventoryCountLines,
    /* 아직 아무것도 받지 않았다. 첫 수령이 서는지, 두 번째가 막히는지를 재는 자리다. */
    shopfloorReceipts: [],
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
    breakdowns: [],
    operationHandovers: [],
    /**
     * 작업 세션 — P-02-10 이 중단·재개를 거는 자리다.
     *
     * 진행 중인 것 하나만 둔다(W/O 11002). ⚠ **끝 시각을 비운다** — 화면은 「열려 있는가」를
     * 끝 시각의 부재로 판정하므로, 값이 있으면 세션이 없는 것으로 걸러진다.
     */
    workSessions: [
      {
        workSessionId: 9001,
        workOrderId: 11002,
        sessionNo: 1,
        shiftId: 1001,
        equipmentId: 5001,
        terminalId: 7001,
        startedAt: '2026-09-08T08:00:00+09:00',
        endedAt: null,
        statusCode: 'RUNNING',
        versionNo: 1,
      },
    ],
    /** 세션 사건 — 구간을 연 「시작」 하나로 둔다. 중단·재개는 화면이 쌓는다. */
    workSessionEvents: [
      {
        workSessionEventId: 9101,
        workSessionId: 9001,
        eventTypeCode: 'START',
        occurredAt: '2026-09-08T08:00:00+09:00',
        recordedAt: '2026-09-08T08:00:00+09:00',
        performedBy: 1001,
        terminalId: 7001,
      },
    ],
    approvalRequests,
    goodsReceipts: [],
    productionResults: [],
    dispositionCandidates,
    nonconformances,
    dispositionDecisions,
    documentIssues: [],
    /** 개체(일련번호) — P-02-04 인식표 영역이 발번해 채운다. 기본은 발번 전 상태다. */
    serialNumbers: [],
    /** 스캔해 볼 값 — 시험 키트가 이 목록을 그대로 인쇄한다. */
    scannables: {
      workerNos: workers.map((worker) => worker.workerNo),
      materialLots: [MATERIAL_LOT_A, MATERIAL_LOT_B, MATERIAL_LOT_HELD],
      productionLots: ['PLOT-2026-0031', 'PLOT-2026-0032', 'PLOT-2026-0033'],
      productLots: ['FLOT-2026-0311', 'FLOT-2026-0305'],
      locationCodes: ['A-01-03', 'A-01-04', 'TMP-01', 'FG-A-02-01'],
      equipmentCodes: ['PRS-01', 'EQ-03'],
      handlingUnitNos: ['HU-2026-000058', 'HU-2026-000059'],
    },
  };
};

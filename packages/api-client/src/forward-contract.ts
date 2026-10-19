import type { components, paths } from './generated/api';

/** P-7/P-10 선행 계약: 공식 설계 사본이 갱신될 때 동등성을 대조하고 제거한다. */
export type TerminalRegistrationStatusCode = 'UNREGISTERED' | 'REGISTERED';

/**
 * 생산라인(설비 그룹)의 기본 위치 셋 — 서버가 계약보다 먼저 연 칸이라 생성 타입에 없다. 계약 사본에
 * 실려 `gen:api` 가 만들면 이 타입과 덧댄 자리를 지운다. 본문에서 생략 = 유지, null = 비움.
 */
export interface LineDefaultLocations {
  defaultWipLocationId?: number | null;
  defaultFgLocationId?: number | null;
  defaultScrapLocationId?: number | null;
}

export interface TerminalRegistrationConfirmation {
  terminalId: number;
  tokenVersion: number;
  registrationStatusCode: 'REGISTERED';
  registrationConfirmedAt: string;
}

/** 서버 선행 P-38(omf-all-around#104) — 계정에 연결된 작업자. 연결이 없으면 세 칸이 모두 null. */
export interface AppUserWorker {
  workerId: number | null;
  workerNo: string | null;
  workerName: string | null;
}

/** 서버 선행 P-38 — `Session.worker`. 서버가 «언제나» 싣고 연결이 없으면 null 이다. */
export interface SessionWorker {
  workerId: number;
  workerNo: string;
  workerName: string;
}

interface AppUserWorkerPath {
  parameters: {
    query?: never;
    header?: never;
    path?: never;
    cookie?: never;
  };
  get: {
    parameters: {
      query?: never;
      header?: never;
      path: { appUserId: number };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: { [name: string]: unknown };
        content: { 'application/json': AppUserWorker };
      };
    };
  };
  put: {
    parameters: {
      query?: never;
      header: { 'Idempotency-Key': string };
      path: { appUserId: number };
      cookie?: never;
    };
    requestBody: { content: { 'application/json': { workerId: number | null } } };
    responses: {
      200: {
        headers: { [name: string]: unknown };
        content: { 'application/json': AppUserWorker };
      };
    };
  };
  post?: never;
  delete?: never;
  options?: never;
  head?: never;
  patch?: never;
  trace?: never;
}

/** 서버 선행 P-42(omf-all-around#106·#108) — 불량 기록 등록 본문. 공정 2칸은 `sourceCode=IQC` 이면 생략. */
export interface DefectRecordCreate {
  sourceCode: string;
  defectCodeId: number;
  defectQty: number;
  uomId: number;
  detectedAt: string;
  occurrenceProcessId?: number | null;
  detectionProcessId?: number | null;
  inspectionResultId?: number | null;
  productionResultId?: number | null;
  workOrderId?: number | null;
  lotId?: number | null;
  suspectedCauseCodeId?: number | null;
  defectDescription?: string | null;
  equipmentId?: number | null;
  moldId?: number | null;
  occurredAt?: string | null;
}

/** 서버 선행 P-52(omf-all-around#108) — 자재 LOT 이 투입된 작업지시의 생산 LOT(작업지시 기준 추정). */
export interface AffectedProductionLots {
  basis: 'WORK_ORDER_ESTIMATE';
  workOrders: { workOrderId: number; workOrderNo: string }[];
  items: {
    lotId: number;
    lotNo: string;
    itemId: number;
    statusCode: string;
    workOrderId: number;
    workOrderNo: string;
  }[];
}

/** 서버 선행 P-56(omf-all-around#108) — 입하 라인 LOT 에서 선별로 떼어 낸 자식 LOT(불량분). */
export interface InboundReceiptSplitLot {
  lotId: number;
  lotNo: string;
  statusCode: string;
  receivableQty: number;
}

/**
 * 서버 선행 P-56 — 입하 라인(`GET …/lines`)에 더해진 두 칸. 입고 가능 수량은 선별로 떼어 낸 불량분·이미 입고한 수량을 뺀
 * 값이고 서버 입고 상한과 같다. 옛 서버는 싣지 않는다(그때 화면은 입하 수량을 쓴다).
 */
export interface InboundReceiptLineForward {
  receivableQty?: number | null;
  splitLots?: InboundReceiptSplitLot[];
}

/** 서버 선행 P-53(omf-all-around#108) — 처분 «선별». 양품은 정상, 불량분은 자식 LOT·새 부적합. */
export type DispositionDecisionCreateForward = Omit<
  components['schemas']['DispositionDecisionCreate'],
  'dispositionTypeCode'
> & {
  dispositionTypeCode:
    components['schemas']['DispositionDecisionCreate']['dispositionTypeCode'] | 'SORT';
  acceptedQty?: number;
  rejectedQty?: number;
  businessDate?: string;
};

export interface DispositionSortResult {
  splitLotId: number;
  splitLotNo: string;
  splitNonconformanceId: number;
  splitNonconformanceNo: string;
}

type DecisionsPath = paths['/quality/nonconformances/{nonconformanceId}/disposition-decisions'];

/** 서버 선행 P-47(omf-all-around#121) — 확정 본문의 IQC 불합격 사유 한 줄. */
export interface InspectionDefectInput {
  defectCodeId: number;
  defectQty: number;
  defectDescription?: string | null;
  suspectedCauseCodeId?: number | null;
}

/** 서버 선행 P-47 — 사유를 실으면 서버가 확정과 한 트랜잭션에서 그 회차의 불량 기록을 이 값으로 갈아 끼운다. */
export type InspectionResultConfirmForward = components['schemas']['InspectionResultConfirm'] & {
  defects?: InspectionDefectInput[];
};

type InspectionConfirmPath = paths['/quality/inspection-results/{inspectionResultId}:confirm'];

/**
 * 서버 선행 P-42·P-48(omf-all-around#122) — 작성중 저장도 IQC 불합격 사유를 싣는다. 실으면 그 회차의 불량 기록을
 * 갈아 끼우고(빈 배열 = 지움), 생략하면 손대지 않는다.
 */
export type InspectionResultCreateForward = components['schemas']['InspectionResultCreate'] & {
  defects?: InspectionDefectInput[];
};
export type InspectionResultUpdateForward = components['schemas']['InspectionResultUpdate'] & {
  defects?: InspectionDefectInput[];
};

type InspectionResultsPath = paths['/quality/inspection-results'];
type InspectionResultPath = paths['/quality/inspection-results/{inspectionResultId}'];
type DefectRecordsGet = paths['/quality/defect-records']['get'];

/**
 * 서버 선행 P-42 — 검사 결과 하나로 좁히면(`inspectionResultId`) 기간이 필요 없다. 작성중 회차의 기록도 돌려준다(P-48).
 */
export type DefectRecordListQueryForward = Omit<
  DefectRecordsGet['parameters']['query'],
  'detectedFrom' | 'detectedTo'
> & { inspectionResultId?: number; detectedFrom?: string; detectedTo?: string };

/** 서버 선행 P-57(omf-all-around#58) — 첨부 대상에 검사 문서(LOT·검사 결과)를 더한다. */
export type AttachmentTargetType =
  'WAREHOUSE' | 'NOTICE' | 'BREAKDOWN' | 'LOT' | 'INSPECTION_RESULT';

type AttachmentsPath = paths['/app/attachments'];
type AttachmentsListQuery = NonNullable<AttachmentsPath['get']['parameters']['query']>;

/** 서버 선행 P-55(omf-all-around#61) — 검사 대상 이력. */
export interface InspectionHistoryEvent {
  occurredAt: string;
  eventTypeCode: 'REQUESTED' | 'RESULT_SAVED' | 'RESULT_CONFIRMED' | 'LOT_STATUS_CHANGED';
  actorName?: string;
  inspectionResultNo?: string;
  inspectionRound?: number;
  overallJudgmentCode?: string;
  acceptedQty?: number;
  rejectedQty?: number;
  heldQty?: number;
  previousStatusCode?: string;
  newStatusCode?: string;
  transitionCode?: string;
  lotNo?: string;
}

export interface InspectionHistory {
  inspectionRequestId: number;
  inspectionRequestNo: string;
  inspectionTypeCode: string;
  source: { targetTypeCode: string; targetId: number; documentNo?: string; lotNo?: string };
  events: InspectionHistoryEvent[];
}

/**
 * 대시보드 2차 응답 규격(omf-all-around#118 코멘트 「2차 응답 규격」 · 2026-10-16 확정, 같은 날 서버 대조로
 * 보정) — 설비(#111) · 출하(#114) · 품질(#113). 셋 다 `GET /app/dashboard-summary` 의 선택 섹션으로 온다
 * (품질 전용 경로는 두지 않는다). 공식 설계 사본이 갱신될 때 동등성을 대조하고 제거한다.
 *
 * MES DB에 없는 값은 서버가 만들지 않는다 — 구할 수 없으면 `null`이다.
 */
export type DashboardEquipmentStatusCode =
  'RUNNING' | 'STOPPED' | 'WAITING' | 'CHANGEOVER' | 'IDLE';

export interface DashboardEquipmentItem {
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeCode: string;
  /** 톤수 — 설비 유형 공통코드 이름(사용자 설정). */
  equipmentTypeName: string | null;
  productionLineId: number | null;
  productionLineName: string | null;
  statusCode: DashboardEquipmentStatusCode;
  statusSince: string | null;
  /** 설비 고장 정지면 `null`(이름에 고장 설명 앞부분이 온다). */
  statusReasonCode: string | null;
  statusReasonName: string | null;
  todayTotalQty: number;
  todayNgQty: number;
  /** NG ÷ 총생산(%) — 총생산이 0이면 `null`. */
  defectRate: number | null;
  standardCycleTimeSec: number | null;
  currentWorkOrderNo: string | null;
  currentItemCode: string | null;
  currentItemName: string | null;
}

export interface DashboardEquipment {
  asOf: string;
  statusCounts: Record<DashboardEquipmentStatusCode, number>;
  items: DashboardEquipmentItem[];
}

export interface DashboardNextShipment {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  customerName: string | null;
  requestedShipDate: string;
  /** 요청 수량이 아니라 **남은(미출하) 수량**이다. */
  requestedQty: number;
}

export interface DashboardShipment {
  todayShippedQty: number;
  todayShipmentCount: number;
  waitingRequestCount: number;
  nextShipment: DashboardNextShipment | null;
  overdueCount: number;
  /**
   * 대기 건수를 센 같은 요청 중 가장 이른 요청일(YYYY-MM-DD) — 대기 0건이면 `null`(2026-10-16 추가 · 서버 반영
   * 대기). 대시보드 「출하 대기」에서 출하 예정 목록을 대시보드 건수와 같은 범위로 열 때 쓴다.
   */
  oldestWaitingShipDate?: string | null;
}

export interface DashboardLotCounts {
  accepted: number;
  rejected: number;
  held: number;
}

export interface DashboardDefectPhenomenon {
  defectCodeId: number;
  defectCode: string;
  defectName: string;
  qty: number;
}

export type DashboardJudgmentCode = 'ACCEPTED' | 'REJECTED' | 'HELD';

export interface DashboardRecentLot {
  inspectionResultId: number;
  inspectedAt: string;
  /** IQC = 공급사, OQC = 고객, PQC = `null`. */
  counterpartName: string | null;
  /** PQC = 호기, 그 밖 `null`. */
  equipmentCode: string | null;
  itemCode: string;
  itemName: string;
  /** PQC · OQC 에서는 `null`. */
  lotNo: string | null;
  qty: number;
  judgmentCode: DashboardJudgmentCode;
}

export interface DashboardQualityTypeBlock {
  monthPassRate: number | null;
  prevMonthPassRate: number | null;
  dailyPassRates: { date: string; passRate: number | null }[];
  todayLots: DashboardLotCounts;
  monthLots: DashboardLotCounts;
  monthDefectQty: number;
  defectPhenomena: DashboardDefectPhenomenon[];
  recentLots: DashboardRecentLot[];
}

/** 고유 LOT 수(LOT 없는 기록 제외) · 기록 수(LOT 없는 것 포함) — 서버 장부 P-58/P-59(사용자 결정 2026-10-19). */
export interface DashboardLotRecordCount {
  lotCount: number;
  recordCount: number;
}

/** 「현재 현황」 상태별 LOT 수 · 건수. 키는 상태별 LOT 목록의 `status`. */
export interface DashboardQualityStatusCounts {
  INSPECTION_HELD: DashboardLotRecordCount & {
    byType: Record<'IQC' | 'PQC' | 'OQC', DashboardLotRecordCount>;
  };
  RECEIPT_HOLD: DashboardLotRecordCount;
  PQC_PENDING: DashboardLotRecordCount;
  NC_OPEN: DashboardLotRecordCount;
}

/** 미종결 부적합 목록의 한 줄. DB 에 없는 값은 `null`. */
export interface DashboardOpenNonconformance {
  nonconformanceId: number;
  nonconformanceNo: string;
  itemCode: string | null;
  itemName: string | null;
  severityCode: string | null;
  severityName: string | null;
  statusCode: string;
  statusName: string | null;
  openedAt: string;
}

/** 반복 부적합 품목의 한 줄. */
export interface DashboardRepeatedItem {
  itemId: number;
  itemCode: string;
  itemName: string;
  ncCount: number;
  lastOpenedAt: string;
}

export interface DashboardQuality {
  /** 없으면(이전 서버) 화면은 기존 숫자만 보인다. */
  statusCounts?: DashboardQualityStatusCounts;
  iqc: DashboardQualityTypeBlock & {
    vendorDefects: { partnerId: number; partnerName: string; rejectedQty: number }[];
    itemDefects: { itemId: number; itemCode: string; itemName: string; qty: number }[];
    /** IQC 재검사 회차의 투입(검사) · 합격 수량 합(사용자 결정 2026-10-19). 0건이면 0. */
    fullReinspect: { inputQty: number; restoredQty: number } | null;
    receiptHoldLotCount: number;
  };
  pqc: DashboardQualityTypeBlock & {
    pendingLotCount: number;
    reworkRequestCount: number;
    /** PQC 재검사 회차의 투입 · 합격 수량 합(사용자 지시 2026-10-19 · IQC 와 같은 정의). 없으면(이전 서버) 칸을 두지 않는다. */
    fullReinspect?: { inputQty: number; restoredQty: number } | null;
    /** 품목별 PQC 불량 수량(IQC `itemDefects` 와 같은 형태). */
    itemDefects?: { itemId: number; itemCode: string; itemName: string; qty: number }[];
    /** 검사 대기 중 가장 오래된 의뢰 시각(ISO). 대기가 없으면 `null`. */
    oldestPendingSince?: string | null;
    /** 재작업 의뢰 LOT 수 · 건수(`reworkRequestCount` 와 같은 조건 · 사용자 지시 2026-10-19). */
    reworkRequestCounts?: DashboardLotRecordCount;
    equipmentDefectRates: {
      equipmentId: number;
      equipmentCode: string;
      defectRate: number;
      ngQty: number;
    }[];
  };
  oqc: DashboardQualityTypeBlock & {
    /** 당월 고객 반품 입고 수량. */
    customerReturnQty: number;
    /** 당월 반품 구분별 수량 — 반품 입고 사유 + 공급사 반품 출고(사용자 지시 2026-10-19). */
    returnReasons?: { reasonCode: string | null; reasonName: string | null; qty: number }[];
    /** 공급사 반품 출고(반출) 일자별 수량 — 일별 합격률과 같은 날짜, 기록 없는 날 `null`. */
    dailyReturnOutQty?: { date: string; qty: number | null }[];
    /** 반품 입고 뒤 처분 판정 전인 LOT(지금 기준). */
    pendingReturnLotCount?: DashboardLotRecordCount;
    /** 고객별 OQC 불합격 수량(IQC `vendorDefects` 와 같은 형태). */
    customerDefects?: { customerId: number; customerName: string; rejectedQty: number }[];
  };
  nonconformance: {
    monthQty: number;
    phenomena: DashboardDefectPhenomenon[];
    causeGroups: { causeCodeId: number; causeName: string; qty: number }[];
    scrapQty: number;
    reworkReleasedQty: number;
    openCount: number;
    /** 지금은 늘 `null` — 조치 기한 데이터가 없다. */
    overdueCount: number | null;
    /** 미종결 부적합 — `openCount` 와 같은 조건, 발생 오래된 순 상위 5건(사용자 지시 2026-10-19 · 서버 장부 P-59). */
    openList?: DashboardOpenNonconformance[];
    /** 반복 부적합 품목 — 같은 기간 부적합 2건 이상 품목, 건수 → 최근 발생 순 상위 5(사용자 결정 2026-10-19). */
    repeatedItems?: DashboardRepeatedItem[];
    /** 조건에 드는 품목 수 전체(상위 5 밖 포함). */
    repeatedItemCount?: number;
  };
}

/**
 * 공장 단위 금일 생산 합계(2026-10-16 대시보드 재구성 때 추가 — 서버 반영 대기). KPI 띠의 종합 불량률 ·
 * 총 NG 원천이다 — 설비 합계로 대신 계산하지 않는다(설비 미지정 실적이 빠진다).
 */
export interface DashboardProduction {
  totalQty: number;
  goodQty: number;
  ngQty: number;
  holdQty: number;
  /** NG ÷ 총생산(%), 총생산이 0이면 `null`. */
  defectRate: number | null;
}

/** `GET /app/dashboard-summary` 에 더해지는 선택 섹션. */
/**
 * 생산 추이 점(사용자 결정 2026-10-19 · 서버 장부) — 생산 실적 기록이 아예 없는 날은 `value: null`(수량 0 과 구분).
 * 공식 설계 사본에 반영되면 대조하고 제거한다.
 */
export interface DashboardTrendPointForward {
  label: string;
  value: number | null;
}

export interface DashboardSummarySections {
  production?: DashboardProduction;
  equipment?: DashboardEquipment;
  shipment?: DashboardShipment;
  quality?: DashboardQuality;
}

/**
 * 대시보드 기간 조회(2026-10-16 사용자 확정 · 서버 36f06e5) — 요청 `dateFrom` · `dateTo`(YYYY-MM-DD, 둘 다 함께,
 * 양 끝 포함 최대 92일, `dateTo` ≤ 공장 오늘). `baseDate` 는 하루 조회용 하위 호환이며 기간과 함께 보내면 400.
 * 응답은 실제 적용 기간을 돌려주고 `baseDate` = `dateTo` 다. 공식 설계 사본이 갱신될 때 동등성을 대조하고 제거한다.
 */
export interface DashboardSummaryPeriodQuery {
  dateFrom?: string;
  dateTo?: string;
}

export interface DashboardSummaryPeriod {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * 카드 값을 낼 수 없는 이유(2026-10-16 사용자 결정 · 서버 bf6cf79) — `AVAILABILITY_RATE` 카드가 `NOT_YET` 일 때만
 * 싣는다. `CALENDAR_UNRESOLVED` = 조회 기간에 근무 일정이 등록되지 않은 날짜가 있다.
 */
export type DashboardCardNotYetReasonCode =
  'NO_SESSION' | 'CALENDAR_UNRESOLVED' | 'NO_PLANNED_TIME';

export interface DashboardCardForward {
  notYetReasonCode?: DashboardCardNotYetReasonCode | null;
}

/**
 * 품질 종합 「현재 현황」 상태별 LOT 목록(2026-10-19 사용자 결정 「서버 추가 + 팝업」 · 헤더 확정 연결 규격).
 * `totalCount` 는 dashboard-summary 의 해당 숫자와 같은 정의다. 목록은 오래된 것부터 최대 200건. DB에 없는 값은
 * `null`. 공식 설계 사본이 갱신될 때 동등성을 대조하고 제거한다.
 */
export type DashboardQualityLotStatus =
  'INSPECTION_HELD' | 'RECEIPT_HOLD' | 'PQC_PENDING' | 'NC_OPEN';

export interface DashboardQualityLotItem {
  key: string;
  lotNo: string | null;
  itemCode: string;
  itemName: string;
  qty: number | null;
  unitCode: string | null;
  /** 상태가 시작된 시각 — 판정 · 보류 시작 · 의뢰 · 부적합 발생. */
  occurredAt: string;
  refNo: string | null;
  inspectionType: 'IQC' | 'PQC' | 'OQC' | null;
  counterpartName: string | null;
  equipmentCode: string | null;
  detail: string | null;
}

export interface DashboardQualityLots {
  status: DashboardQualityLotStatus;
  asOf: string;
  totalCount: number;
  /** 같은 조건의 `statusCounts` 값과 같다(200줄 제한 전). 없으면(이전 서버) `totalCount` 만. */
  lotCount?: number;
  recordCount?: number;
  items: DashboardQualityLotItem[];
}

export interface DashboardQualityLotsQuery {
  status: DashboardQualityLotStatus;
  plantId?: number;
  baseDate?: string;
  dateFrom?: string;
  dateTo?: string;
  /** INSPECTION_HELD 만 — 그 검사 유형의 검사 보류만(IQC 탭 · 사용자 지시 2026-10-19). 다른 상태는 무시. */
  inspectionType?: 'IQC' | 'PQC' | 'OQC';
}

/** 생성 계약의 대시보드 요약 — forward 가 경로를 덮어쓰므로(`ApiPaths`) 생성 요청 · 응답에 기간 칸을 더해 다시 적는다. */
type DashboardSummaryGet = paths['/app/dashboard-summary']['get'];

/**
 * 서버 선행 — 품목–공정–설비–금형 매핑. 계획 확정 전개가 기본 매핑의 설비·금형을 W/O 에 배정하고
 * 4M 추천이 읽는다. 공정이 null 이면 품목 공통(설비·금형이 필요한 공정에만 쓰인다).
 */
export interface ItemResourceMap {
  itemResourceMapId: number;
  plantId: number;
  itemId: number;
  processId: number | null;
  processCode: string | null;
  processName: string | null;
  equipmentId: number | null;
  equipmentCode: string | null;
  equipmentName: string | null;
  productionLineId: number | null;
  moldId: number | null;
  moldCode: string | null;
  moldName: string | null;
  isDefault: boolean;
  priorityNo: number;
  isActive: boolean;
  remarks: string | null;
  /** 수정의 If-Match 값 — 목록 행마다 실린다. */
  versionNo: number;
}

export interface ItemResourceMapCreate {
  plantId: number;
  itemId: number;
  processId?: number | null;
  equipmentId?: number | null;
  moldId?: number | null;
  isDefault?: boolean;
  priorityNo?: number;
  remarks?: string | null;
}

/** 생략 = 유지, null = 비움. 공장·품목은 바꾸지 않는다. */
export interface ItemResourceMapUpdate {
  processId?: number | null;
  equipmentId?: number | null;
  moldId?: number | null;
  isDefault?: boolean;
  priorityNo?: number;
  isActive?: boolean;
  remarks?: string | null;
}

export interface ItemResourceMapListQuery {
  plantId?: number;
  itemId?: number;
  equipmentId?: number;
  moldId?: number;
  includeInactive?: boolean;
}

/** 서버 선행 — 4M 설비·금형 추천. 기본 매핑 → 그 밖의 매핑 → 같은 품목·공정의 최근 사용 순이다. */
export type ResourceRecommendationSource = 'DEFAULT' | 'MAPPED' | 'RECENT';

export interface EquipmentRecommendation {
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  productionLineId: number | null;
  source: ResourceRecommendationSource;
  inService: boolean;
  /** 같은 시간대의 다른 W/O 에 이미 배정됐다 — 4M 점검의 설비 중복 배정과 같은 판정. */
  busy: boolean;
}

export interface MoldRecommendation {
  moldId: number;
  moldCode: string;
  moldName: string;
  source: ResourceRecommendationSource;
  inService: boolean;
}

export interface ResourceRecommendations {
  equipments: EquipmentRecommendation[];
  molds: MoldRecommendation[];
}

interface NoParameters {
  query?: never;
  header?: never;
  path?: never;
  cookie?: never;
}

interface Unused {
  delete?: never;
  options?: never;
  head?: never;
  patch?: never;
  trace?: never;
}

export interface ForwardPaths {
  '/quality/nonconformances/{nonconformanceId}/disposition-decisions': Omit<
    DecisionsPath,
    'post'
  > & {
    post: Omit<DecisionsPath['post'], 'requestBody' | 'responses'> & {
      requestBody: { content: { 'application/json': DispositionDecisionCreateForward } };
      responses: Omit<DecisionsPath['post']['responses'], 201> & {
        201: {
          headers: { [name: string]: unknown };
          content: {
            'application/json': components['schemas']['DispositionDecision'] & {
              sortResult?: DispositionSortResult | null;
            };
          };
        };
      };
    };
  };
  '/trace/lots/{lotId}/affected-production-lots': {
    parameters: {
      query?: never;
      header?: never;
      path: { lotId: number };
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: { lotId: number };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': AffectedProductionLots };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/app/dashboard-quality-lots': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: DashboardQualityLotsQuery;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': DashboardQualityLots };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/app/dashboard-summary': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: NonNullable<DashboardSummaryGet['parameters']['query']> &
          DashboardSummaryPeriodQuery;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            'application/json': DashboardSummaryGet['responses'][200]['content']['application/json'] &
              DashboardSummaryPeriod;
          };
        };
        403: DashboardSummaryGet['responses'][403];
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  /** 확정 본문에 불합격 사유(`defects`)를 더한다 — 서버 선행 P-47. */
  '/quality/inspection-results/{inspectionResultId}:confirm': Omit<
    InspectionConfirmPath,
    'post'
  > & {
    post: Omit<InspectionConfirmPath['post'], 'requestBody'> & {
      requestBody: { content: { 'application/json': InspectionResultConfirmForward } };
    };
  };
  /** 작성중 저장 본문에 불합격 사유(`defects`)를 더한다 — 서버 선행 P-48. */
  '/quality/inspection-results': Omit<InspectionResultsPath, 'post'> & {
    post: Omit<InspectionResultsPath['post'], 'requestBody'> & {
      requestBody: { content: { 'application/json': InspectionResultCreateForward } };
    };
  };
  '/quality/inspection-results/{inspectionResultId}': Omit<InspectionResultPath, 'put'> & {
    put: Omit<InspectionResultPath['put'], 'requestBody'> & {
      requestBody: { content: { 'application/json': InspectionResultUpdateForward } };
    };
  };
  /** 기존 조회(GET)에 등록(POST)을 더한다 — 서버 선행 P-42. 조회는 `inspectionResultId` 질의를 더한다. */
  '/quality/defect-records': Omit<paths['/quality/defect-records'], 'get' | 'post'> & {
    get: Omit<DefectRecordsGet, 'parameters'> & {
      parameters: Omit<DefectRecordsGet['parameters'], 'query'> & {
        query: DefectRecordListQueryForward;
      };
    };
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path?: never;
        cookie?: never;
      };
      requestBody: { content: { 'application/json': DefectRecordCreate } };
      responses: {
        201: {
          headers: { [name: string]: unknown };
          content: { 'application/json': components['schemas']['DefectRecord'] };
        };
      };
    };
  };
  '/quality/inspection-requests/{inspectionRequestId}/history': {
    parameters: {
      query?: never;
      header?: never;
      path: { inspectionRequestId: number };
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: { inspectionRequestId: number };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': InspectionHistory };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/app/attachments': Omit<AttachmentsPath, 'get'> & {
    get: Omit<AttachmentsPath['get'], 'parameters'> & {
      parameters: Omit<AttachmentsPath['get']['parameters'], 'query'> & {
        query?: Omit<AttachmentsListQuery, 'targetTypeCode'> & {
          targetTypeCode?: AttachmentTargetType;
        };
      };
    };
  };
  '/app/users/{appUserId}/worker': AppUserWorkerPath;
  '/mdm/item-resource-maps': Unused & {
    parameters: NoParameters;
    get: {
      parameters: {
        query?: ItemResourceMapListQuery;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': { items: ItemResourceMap[] } };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path?: never;
        cookie?: never;
      };
      requestBody: { content: { 'application/json': ItemResourceMapCreate } };
      responses: {
        201: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ItemResourceMap };
        };
      };
    };
  };
  '/mdm/item-resource-maps/{itemResourceMapId}': Unused & {
    parameters: NoParameters;
    get?: never;
    put: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string; 'If-Match': string };
        path: { itemResourceMapId: number };
        cookie?: never;
      };
      requestBody: { content: { 'application/json': ItemResourceMapUpdate } };
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ItemResourceMap };
        };
      };
    };
    post?: never;
  };
  '/production/work-orders/{workOrderId}/resource-recommendations': Unused & {
    parameters: NoParameters;
    get: {
      parameters: { query?: never; header?: never; path: { workOrderId: number }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ResourceRecommendations };
        };
      };
    };
    put?: never;
    post?: never;
  };
  /** 서버 선행 P-36(omf-all-around#105) — 승인된 IQC 생략의 실행. 본문 없음 · 200 LOT 상세. */
  '/trace/lots/{lotId}:skip-iqc': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: { lotId: number };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': components['schemas']['LotDetailResponse'] };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/mdm/terminals/{terminalId}/accessible-screens': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: { terminalId: number };
        cookie?: never;
      };
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': { screenCodes: string[] } };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/mdm/terminals/{terminalId}:confirm-registration': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: { terminalId: number };
        cookie?: never;
      };
      requestBody: { content: { 'application/json': Record<string, never> } };
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': TerminalRegistrationConfirmation };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

/** 같은 경로를 forward 가 다시 적으면 그쪽이 이긴다 — 교집합이면 좁은 쪽 enum 이 남는다(omf-all-around#58 첨부 대상). */
export type ApiPaths = Omit<paths, keyof ForwardPaths> & ForwardPaths;

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
/**
 * 서버 선행 P-86(omf-all-around#63) — IQC 판정 때 자재 LOT 의 4M 변경품(변경 종류 = 공통코드 `FOUR_M_CHANGE_TYPE`).
 * 쓰기 본문에서 생략하면 그대로, `null` 이면 변경품 아님. 조회(의뢰·LOT 목록)는 변경품일 때만 키가 있다.
 */
export interface FourMChangeForward {
  changeTypeCode: string;
  remarks?: string;
}

/** 서버 선행 P-86(omf-all-around#63) — 의뢰 LOT 의 4M 변경품. */
export type InspectionRequestForward = components['schemas']['InspectionRequest'] & {
  fourMChange?: FourMChangeForward;
};

/** 서버 선행 P-86(omf-all-around#63) — LOT 목록·단건(`GET /trace/lots`(+`/{lotId}`))이 4M 변경품을 싣는다. */
export type LotForward = components['schemas']['Lot'] & {
  fourMChange?: FourMChangeForward;
};

/** 서버 선행 P-86(omf-all-around#63 2단계) — 자재 투입이 투입 LOT 의 4M 변경품을 싣는다. */
export type MaterialConsumptionForward = components['schemas']['MaterialConsumption'] & {
  fourMChange?: FourMChangeForward;
};

export type InspectionResultConfirmForward = components['schemas']['InspectionResultConfirm'] & {
  defects?: InspectionDefectInput[];
  /** 서버 선행 P-70(omf-all-around#125·#126) — IQC·OQC 판정이 합격판정개수 기준 자동 판정과 다르면 필수(maxLength 500). */
  judgmentChangeReason?: string;
  fourMChange?: FourMChangeForward | null;
};

type InspectionConfirmPath = paths['/quality/inspection-results/{inspectionResultId}:confirm'];

/**
 * 서버 선행 P-42·P-48(omf-all-around#122) — 작성중 저장도 IQC 불합격 사유를 싣는다. 실으면 그 회차의 불량 기록을
 * 갈아 끼우고(빈 배열 = 지움), 생략하면 손대지 않는다.
 */
export type InspectionResultCreateForward = components['schemas']['InspectionResultCreate'] & {
  defects?: InspectionDefectInput[];
  /** 서버 선행 P-70(omf-all-around#125·#126) — statusCode=CONFIRMED 저장의 판정 변경 사유(IQC·OQC). `:confirm` 과 같은 규칙. */
  judgmentChangeReason?: string;
  fourMChange?: FourMChangeForward | null;
  /** 서버 선행 P-101(omf-all-around#68) — 출하작업지시 OQC 확정 저장의 시리얼별 판정. 시리얼당 한 줄로 남는다. */
  serials?: OqcSerialJudgmentInput[];
};

/** 서버 선행 P-101(omf-all-around#68) — 시리얼 한 대의 출하검사 판정. */
export interface OqcSerialJudgmentInput {
  serialNumberId: number;
  judgmentCode: 'OK' | 'NG';
}

/**
 * 서버 선행 P-101 — 시리얼의 OQC 기록. ⚠ 시리얼당 한 줄이라 재검 회차가 덮는다: 1차는 처음 값, 최종과 마지막 회차만 바뀐다.
 */
export interface OqcSerialStep {
  firstJudgmentCode: 'OK' | 'NG';
  finalJudgmentCode: 'OK' | 'NG';
  inspectedAt: string;
  inspectorName?: string;
  inspectionResultId?: number;
  inspectionRound?: number;
}

/** 서버 선행 P-101 — `GET /quality/oqc-serials/{serialNo}` 스캔 한 번의 답. */
export interface OqcSerialScan {
  serialNumberId: number;
  serialNo: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  lotId: number;
  lotNo: string;
  producedAt?: string;
  workOrderId?: number;
  shipmentStep?: OqcSerialStep;
  /**
   * 이 시리얼의 LOT 을 피킹한 OQC 의뢰 — 대기·진행·완료(생략은 빠진다). 완료도 담는 것은 재검 회차가 같은 시리얼을
   * 다시 찍기 때문이다. 시리얼로 의뢰를 열 때는 대기·진행만 고른다.
   */
  pickedRequests: {
    inspectionRequestId: number;
    inspectionRequestNo: string;
    shipmentRequestId: number;
    /** `REQUESTED` · `IN_PROGRESS` · `COMPLETED`. */
    statusCode: string;
  }[];
}

/** 서버 선행 P-101 — 의뢰 하나의 시리얼 판정 한 줄. */
export type OqcSerialRecord = OqcSerialStep & {
  serialNumberId: number;
  serialNo: string;
  lotId: number;
  lotNo: string;
};
export type InspectionResultUpdateForward = components['schemas']['InspectionResultUpdate'] & {
  defects?: InspectionDefectInput[];
  fourMChange?: FourMChangeForward | null;
};

type InspectionResultsPath = paths['/quality/inspection-results'];
type InspectionResultPath = paths['/quality/inspection-results/{inspectionResultId}'];
type InspectionResultsGet = InspectionResultsPath['get'];

/** 서버 선행 P-76(omf-all-around#85) — 응답이 검사자(작업자) 이름을 함께 내린다. */
export type InspectionResultForward = components['schemas']['InspectionResult'] & {
  inspectorName?: string;
};

/** 서버 선행 P-76(omf-all-around#85) — LOT 하나로 좁히면(`lotId`) 기간이 필요 없다(그 LOT 의 전 이력). */
export type InspectionResultListQueryForward = NonNullable<
  InspectionResultsGet['parameters']['query']
> & { lotId?: number };
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

/** 공장의 사용 중인 교대. busy = 같은 설비에 같은 근무일 이 교대의 W/O 가 이미 있다. */
export interface ShiftRecommendation {
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  busy: boolean;
}

/** 작업자를 고른 근거 — 같은 설비·라인·공정에서 일한 이력이거나 자격 보유. */
export type WorkerRecommendationSource = 'EQUIPMENT' | 'LINE' | 'PROCESS' | 'QUALIFIED';

/** busy = 같은 근무일 같은 교대에 이미 담당자다. */
export interface WorkerRecommendation {
  workerId: number;
  workerNo: string;
  workerName: string;
  source: WorkerRecommendationSource;
  busy: boolean;
}

export interface ResourceRecommendations {
  equipments: EquipmentRecommendation[];
  molds: MoldRecommendation[];
  /** 서버 선행 — 교대·작업자 추천. 이를 싣지 않는 서버가 있어 선택으로 둔다(없으면 후보 없음). */
  shifts?: ShiftRecommendation[];
  workers?: WorkerRecommendation[];
}

/** 서버 선행 — 오더 수신 때 계획을 자동으로 만들지 못했거나 확정하지 못한 이유. */
export type AutoPlanReason =
  | 'BOM_MISSING'
  | 'ROUTING_MISSING'
  | 'ROUTING_AMBIGUOUS'
  | 'LINE_UNKNOWN'
  | 'PLAN_NOT_CONFIRMED'
  | 'QTY_REMAINING';

export type AutoPlanStatus = 'DONE' | 'NEEDS_REVIEW';

export interface ProductionOrderAutoPlan {
  status: AutoPlanStatus;
  reasons: AutoPlanReason[];
}

/**
 * 서버 선행 — P/O 에 자동 계획 결과를 싣는다. `null` 은 자동 계획을 한 번도 하지 않은 P/O 다
 * (기능 전에 받았거나, 받을 때 납기가 지났거나 수신 상태가 아니라 건너뛰었다) — 계획도 없다.
 */
export type ProductionOrderForward = components['schemas']['ProductionOrder'] & {
  autoPlan?: ProductionOrderAutoPlan | null;
};

export type ProductionOrderListQueryForward = NonNullable<
  ProductionOrdersGet['parameters']['query']
> & {
  autoPlanStatus?: AutoPlanStatus;
};

/** 서버 선행 — `POST /planning/production-orders/{id}:auto-plan` 의 결과. */
export interface ProductionOrderAutoPlanResult {
  productionOrderId: number;
  outcome: 'CONFIRMED' | 'DRAFT' | 'NOT_PLANNED';
  productionPlanId: number | null;
  reasons: AutoPlanReason[];
}

/**
 * 서버 선행 — W/O 가 자기 공정(라우팅 공정)을 싣는다. 단말 게이팅이 단말의 공정 대신 고른 W/O 의
 * 공정으로 판정한다. 싣지 않는 서버가 있어 선택으로 둔다.
 */
export type WorkOrderForward = components['schemas']['WorkOrder'] & {
  processId?: number;
  processCode?: string;
  processName?: string;
  /** 계획 설비의 코드·이름 — 설비 없는 단말이 W/O 의 설비로 점검·시작할 때 그 설비를 보인다. */
  plannedEquipmentCode?: string | null;
  plannedEquipmentName?: string | null;
  /** 서버 선행 P-104 — 미달 마감에서 고른 잔량 처분. 이월이어도 잔량 W/O 는 만들어지지 않는다. */
  closeDispositionCode?: 'CARRY_OVER' | 'WRITE_OFF';
  /** 서버 선행 P-104 — POP 에서 마감한 작업자. 관리웹 마감이면 없다. */
  closedWorkerId?: number;
  closedWorkerNo?: string;
  closedWorkerName?: string;
  /** 서버 선행 P-104 — 마감으로 폐번된 선발행 LOT 수. 상세의 마감된 W/O 에만 있다. */
  voidedLotCount?: number;
};

/** 서버 선행 P-104 — 마감을 막은 열린 작업 세션 한 건(중단 포함). 작업자는 그 세션의 주작업자다. */
export interface OpenWorkSession {
  workSessionId: number;
  terminalId: number;
  terminalCode: string;
  workerId?: number;
  workerNo?: string;
  workerName?: string;
  startedAt: string;
  /** RUNNING(진행) · STOPPED(중단) */
  statusCode: string;
}

/** 서버 선행 P-104 — 마감 409 OPEN_SESSION_EXISTS 가 열린 세션들을 싣는다. */
export type ProductionConflictResponseForward =
  components['schemas']['ProductionConflictResponse'] & {
    openSessions?: OpenWorkSession[];
  };

/** 서버 선행 P-104 — 세션 조회(목록·단건)가 단말 코드와 주작업자를 싣는다. */
export type WorkSessionForward = components['schemas']['WorkSession'] & {
  terminalCode?: string;
  workerId?: number;
  workerNo?: string;
  workerName?: string;
};

/**
 * 서버 선행 — 세션 참여자에 사번·이름·참여 분(서버 계산, 참여 구간마다)을 싣는다. 계약 사본에
 * 오르기 전 서버는 싣지 않을 수 있어 선택으로 둔다. 역할의 옛 값 `OPERATOR` 는 부로 읽는다.
 */
export type WorkSessionWorkerForward = components['schemas']['WorkSessionWorker'] & {
  workerNo?: string;
  workerName?: string;
  participatedMinutes?: number;
};

/** 서버 선행 — 실적을 참여자에게 나눈 몫. 배분이 없으면 빈 배열이다. */
export interface ProductionResultWorkerAllocation {
  workerId: number;
  workerNo: string;
  workerName: string;
  workerRoleCode: string;
  participatedMinutes: number;
  shareRatio: number;
  goodQty: number;
  defectQty: number;
  holdQty: number;
  scrapQty: number;
  reworkQty: number;
}

/** 서버 선행 — 실적과 함께 적는 불량 한 줄. 코드는 W/O 공정에 매핑된 상세 코드다. */
export interface ProductionResultDefectInput {
  defectCodeId: number;
  qty: number;
}

/**
 * 서버 선행 — 실적에 붙은 불량 기록. 이름은 불량 코드의 기본 이름이다. 대분류 칸은 상세 코드일
 * 때만 실린다(관리웹에서 대분류로 단 옛 기록에는 없다).
 */
export interface ProductionResultDefect {
  defectRecordId: number;
  defectCodeId: number;
  defectCode: string;
  defectName: string;
  nameKo?: string | null;
  nameVi?: string | null;
  parentDefectCodeId?: number | null;
  parentDefectCode?: string | null;
  parentDefectName?: string | null;
  parentNameKo?: string | null;
  parentNameVi?: string | null;
  qty: number;
}

/** 서버 선행 — `defects` 만 보내면 서버가 `defectQty` 를 그 합으로 채운다. 양품 0 도 받는다. */
export type ProductionResultCreateForward = components['schemas']['ProductionResultCreate'] & {
  defects?: ProductionResultDefectInput[];
};

/* `defects` 는 전달본 2026-10-21 에 실려(P-95) 생성 타입이 갖는다 — 덧대면 두 모양이 겹쳐 충돌한다. */
export type ProductionResultForward = components['schemas']['ProductionResult'] & {
  workerAllocations?: ProductionResultWorkerAllocation[];
};

type DefectCodesPath = paths['/quality/defect-codes'];
type DefectCodesGet = DefectCodesPath['get'];

type SessionWorkersPath = paths['/production/work-sessions/{workSessionId}/workers'];
type SessionWorkerLeavePath =
  paths['/production/work-sessions/{workSessionId}/workers/{workSessionWorkerId}:leave'];
type ProductionResultsPath = paths['/production/production-results'];
type ProductionResultsGet = ProductionResultsPath['get'];

type WorkOrdersPath = paths['/production/work-orders'];
type WorkOrdersGet = WorkOrdersPath['get'];
type WorkOrderPath = paths['/production/work-orders/{workOrderId}'];
type WorkOrderGet = WorkOrderPath['get'];

type ProductionOrdersGet = paths['/planning/production-orders']['get'];
type ProductionOrderGet = paths['/planning/production-orders/{productionOrderId}']['get'];

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

/** 서버 선행 P-79(omf-all-around#84) — 특채 요청 본문. */
export interface ConcessionCreate {
  nonconformanceId: number;
  lotId: number;
  approvedQty: number;
  uomId: number;
  validFrom: string;
  validTo?: string | null;
  allowedWorkOrderId?: number | null;
  allowedProcessId?: number | null;
  allowedCustomerId?: number | null;
  reason: string;
}

type ConcessionsPath = paths['/quality/concessions'];
type ConcessionResponse = {
  headers: { [name: string]: unknown };
  content: { 'application/json': components['schemas']['Concession'] };
};

/** 서버 선행 P-87(omf-all-around#64) — IQC 검사 수준. 무검사·수월·보통·엄격. */
export type InspectionLevelCode = 'NONE' | 'REDUCED' | 'NORMAL' | 'TIGHTENED';

/** 서버 선행 P-87 — 품목별 검사 수준과 자동 전환 상태. */
export interface ItemInspectionLevel {
  itemInspectionLevelId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  inspectionLevelCode: InspectionLevelCode;
  autoSwitchEnabled: boolean;
  /** 지금 수준에서의 연속 합격 LOT 수. */
  consecutiveAcceptCount: number;
  updatedAt: string;
  /** 수정의 If-Match 값 — 목록 행마다 실린다. */
  versionNo: number;
}

export interface ItemInspectionLevelCreate {
  itemId: number;
  inspectionLevelCode: InspectionLevelCode;
  autoSwitchEnabled?: boolean;
  /** 선택 — 비우면 이력의 사유가 null. */
  reason?: string;
}

/** 생략 = 유지. 수준이 바뀌면 사유 필수. */
export interface ItemInspectionLevelUpdate {
  inspectionLevelCode?: InspectionLevelCode;
  autoSwitchEnabled?: boolean;
  reason?: string;
}

export interface ItemInspectionLevelListQuery {
  itemId?: number;
  inspectionLevelCode?: InspectionLevelCode;
  q?: string;
  page?: number;
  size?: number;
}

/** 서버 선행 P-87 — 전환 이력. 자동은 연속 합격 수 또는 불합격 의뢰, 수동은 사유를 싣는다. */
export interface ItemInspectionLevelHistory {
  itemInspectionLevelHistoryId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  /** 최초 지정이면 null. */
  fromLevelCode: InspectionLevelCode | null;
  toLevelCode: InspectionLevelCode;
  changeTypeCode: 'AUTO' | 'MANUAL';
  consecutiveAcceptCount: number | null;
  inspectionRequestId: number | null;
  inspectionRequestNo: string | null;
  reason: string | null;
  changedAt: string;
  changedByName: string | null;
}

export interface ItemInspectionLevelHistoryQuery {
  itemId?: number;
  changeTypeCode?: 'AUTO' | 'MANUAL';
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

type PageMeta = components['schemas']['PageMeta'];

/** 서버 선행 P-102(omf-all-around#89) — OA 제품 검사표. 출력 양식 · 단계 · 판정. */
export type InspectionSheetLayoutCode = 'OP' | 'PP';
export type InspectionSheetStepCode =
  | 'PROCESS_1'
  | 'PROCESS_2'
  | 'PROCESS_3'
  | 'PROCESS_4'
  | 'PROCESS_5'
  | 'SHIPMENT'
  | 'CROSS_CHECK'
  | 'SAMPLING';
export type InspectionSheetJudgment = 'OK' | 'NG';
export type InspectionSheetMethodCode = 'FULL' | 'SAMPLE';
export type InspectionSheetLotSlot = 'PCB' | 'SD' | 'STAPLE';

export interface InspectionSheetTemplateItem {
  inspectionSheetTemplateItemId: number;
  sequenceNo: number;
  checkItemCode: string;
  nameKo: string;
  nameVi: string | null;
  methodCode: InspectionSheetMethodCode;
}

export interface InspectionSheetTemplateStep {
  stepCode: InspectionSheetStepCode;
  sequenceNo: number;
  nameKo: string;
  nameVi: string | null;
  signRequired: boolean;
  items: InspectionSheetTemplateItem[];
}

interface InspectionSheetTemplateContent {
  materialText?: string | null;
  structureText?: string | null;
  rohsFlag: boolean;
  productNameText?: string | null;
  powerText?: string | null;
  motorText?: string | null;
  remarks?: string | null;
}

/** 서버 선행 P-102 — 검사표 기준. 목록은 `lotSources`·`steps` 를 싣지 않는다. */
export interface InspectionSheetTemplate extends Required<InspectionSheetTemplateContent> {
  inspectionSheetTemplateId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  templateVersion: number;
  businessUnitId: number;
  formLayoutCode: InspectionSheetLayoutCode;
  statusCode: 'DRAFT' | 'CONFIRMED' | 'OBSOLETE';
  confirmedBy: number | null;
  confirmedAt: string | null;
  lotSources?: {
    slotCode: InspectionSheetLotSlot;
    itemId: number;
    itemCode: string;
    itemName: string;
  }[];
  steps?: InspectionSheetTemplateStep[];
}

/** 작성중 판만 고친다. 단계·항목·LOT 칸은 통째로 갈아 끼운다 — 배열 순서가 순번이다. */
export interface InspectionSheetTemplateUpdate extends InspectionSheetTemplateContent {
  lotSources: { slotCode: InspectionSheetLotSlot; itemId: number }[];
  steps: {
    stepCode: InspectionSheetStepCode;
    nameKo: string;
    nameVi?: string | null;
    signRequired: boolean;
    items: {
      checkItemCode: string;
      nameKo: string;
      nameVi?: string | null;
      methodCode: InspectionSheetMethodCode;
    }[];
  }[];
}

export interface InspectionSheetTemplateCreate extends InspectionSheetTemplateUpdate {
  itemId: number;
  businessUnitId: number;
  formLayoutCode: InspectionSheetLayoutCode;
}

export interface InspectionSheetTemplateListQuery {
  itemId?: number;
  statusCode?: InspectionSheetTemplate['statusCode'];
  page?: number;
  size?: number;
}

/** 서버 선행 P-102 — 머리 값. 보낸 값으로 통째로 바꾼다(생략 = 비움). */
export interface InspectionSheetHeaderUpdate {
  modelText?: string | null;
  specText?: string | null;
  destinationText?: string | null;
  pcbLotNo?: string | null;
  sdLotNo?: string | null;
  stapleLotNo?: string | null;
  fwProductionVersion?: string | null;
  fwQualityVersion?: string | null;
  materialText?: string | null;
  structureText?: string | null;
  rohsFlag: boolean;
  productNameText?: string | null;
  powerText?: string | null;
  motorText?: string | null;
  tempPackNote?: string | null;
  overallResultCode?: InspectionSheetJudgment | null;
}

export interface InspectionSheetNgWrite {
  foundDepartmentCode?: 'PRODUCTION' | 'QUALITY' | null;
  foundStepCode?: string | null;
  occurrenceProcessText?: string | null;
  standardNo?: string | null;
  checkItemCode?: string | null;
  ngContent: string;
  investigationText?: string | null;
  ngTypeCode?: 'WORK' | 'PART' | null;
  repairDepartmentCode?: 'PRODUCTION' | 'TECH' | null;
  repairWorkerNo?: string | null;
  repairedAt?: string | null;
  recheckResultCode?: InspectionSheetJudgment | null;
  recheckWorkerNo?: string | null;
  recheckedAt?: string | null;
}

export interface InspectionSheetNg extends Required<InspectionSheetNgWrite> {
  sequenceNo: number;
  repairWorkerName: string | null;
  recheckWorkerName: string | null;
}

export interface InspectionSheetStepResult {
  firstJudgmentCode: InspectionSheetJudgment;
  finalJudgmentCode: InspectionSheetJudgment;
  /** OQC = 시리얼 OQC(#68)가 쓴 출하검사 줄. */
  sourceCode: 'SHEET' | 'OQC';
  inspectedWorkerNo: string | null;
  inspectedWorkerName: string | null;
  inspectedAt: string;
  signedBy: number | null;
  signedByName: string | null;
  signedAt: string | null;
}

export interface InspectionSheetStep {
  stepCode: InspectionSheetStepCode;
  sequenceNo: number;
  nameKo: string;
  nameVi: string | null;
  signRequired: boolean;
  /** 아직 안 쓴 단계는 null. */
  result: InspectionSheetStepResult | null;
  items: (InspectionSheetTemplateItem & { judgmentCode: InspectionSheetJudgment | null })[];
}

/** 서버 선행 P-102 — 시리얼 1대의 제품 검사표. */
export interface InspectionSheet extends Required<InspectionSheetHeaderUpdate> {
  inspectionSheetId: number;
  serialNumberId: number;
  serialNo: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  lotId: number;
  lotNo: string;
  workOrderId: number | null;
  workOrderNo: string | null;
  inspectionSheetTemplateId: number;
  templateVersion: number;
  formLayoutCode: InspectionSheetLayoutCode;
  statusCode: 'IN_PROGRESS' | 'COMPLETED';
  /** W/O 투입 기록에서 찾은 칸별 자재 LOT 번호(W/O 단위). */
  lotCandidates: { pcb: string[]; sd: string[]; staple: string[] };
  /** 서버 선행 P-102 S4 — 이 W/O 에 투입된 4M 변경품 자재 LOT(W/O 단위 · 시리얼별 투입 기록 없음). */
  fourMChanges: {
    lotNo: string;
    itemCode: string;
    itemName: string;
    changeTypeCode: string;
    remarks: string | null;
  }[];
  writtenWorkerNo: string | null;
  writtenWorkerName: string | null;
  createdAt: string;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  checkedBy: number | null;
  checkedByName: string | null;
  checkedAt: string | null;
  steps: InspectionSheetStep[];
  ngs: InspectionSheetNg[];
  events: {
    /** APPROVAL_CLEARED = 승인·확인 중 하나만 된 검사표를 고쳐 그 승인·확인이 비워졌다. */
    eventCode: 'SIGN_STEP' | 'APPROVE' | 'CHECK' | 'REOPEN' | 'APPROVAL_CLEARED';
    stepCode: string | null;
    reason: string | null;
    /** POP 작업자가 고쳤으면 null — 이름은 작업자 이름이다. */
    actedBy: number | null;
    actedByName: string | null;
    actedAt: string;
  }[];
}

/** 1차·최종 판정을 함께 빼면 항목 판정만 임시 저장한다(서버 선행 P-102 · 판정이 기록된 단계는 400). */
export interface InspectionSheetStepWrite {
  firstJudgmentCode?: InspectionSheetJudgment;
  finalJudgmentCode?: InspectionSheetJudgment;
  items: { inspectionSheetTemplateItemId: number; judgmentCode: InspectionSheetJudgment }[];
}

/** 서버 선행 P-102 S3 — 제품 검사표 목록 한 줄. */
export interface InspectionSheetSummary {
  inspectionSheetId: number;
  serialNo: string;
  itemCode: string;
  itemName: string;
  lotNo: string;
  workOrderNo: string | null;
  statusCode: InspectionSheet['statusCode'];
  recordedStepCount: number;
  stepCount: number;
  /** 1차 판정이 NG 였던 단계 수. */
  ngStepCount: number;
  writtenWorkerName: string | null;
  approvedByName: string | null;
  checkedByName: string | null;
  createdAt: string;
}

export interface InspectionSheetListQuery {
  serialNo?: string;
  lotNo?: string;
  workOrderId?: number;
  itemId?: number;
  statusCode?: InspectionSheet['statusCode'];
  /** 작성 시각(UTC) — 이상. */
  createdFrom?: string;
  /** 작성 시각(UTC) — 미만. */
  createdTo?: string;
  page?: number;
  size?: number;
}

type Json<T> = { headers: { [name: string]: unknown }; content: { 'application/json': T } };
type Op<P, B, R> = { parameters: P; responses: R } & ([B] extends [never]
  ? { requestBody?: never }
  : { requestBody: B });
interface Params<Q, H, Path> {
  query?: Q;
  header: H;
  path: Path;
  cookie?: never;
}
type IdemHeader = { 'Idempotency-Key': string; 'X-Worker-No'?: string };
type LockHeader = IdemHeader & { 'If-Match': string };
type SheetId = { inspectionSheetId: number };
type TemplateId = { inspectionSheetTemplateId: number };
type SheetAction<Path, B = never> = Unused & {
  parameters: NoParameters;
  get?: never;
  put?: never;
  post: Op<
    Params<never, LockHeader, Path>,
    [B] extends [never] ? never : { content: { 'application/json': B } },
    { 200: Json<InspectionSheet> }
  >;
};
type SheetPut<Path, B> = Unused & {
  parameters: NoParameters;
  get?: never;
  post?: never;
  put: Op<
    Params<never, LockHeader, Path>,
    { content: { 'application/json': B } },
    { 200: Json<InspectionSheet> }
  >;
};

export interface ForwardPaths {
  /** 특채 조회(GET)에 요청(POST)을 더한다 — 서버 선행 P-79. */
  '/quality/concessions': Omit<ConcessionsPath, 'post'> & {
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path?: never;
        cookie?: never;
      };
      requestBody: { content: { 'application/json': ConcessionCreate } };
      responses: { 201: ConcessionResponse };
    };
  };
  /** 특채 적용 — 서버 선행 P-79. */
  '/quality/concessions/{concessionId}:apply': {
    parameters: { query?: never; header?: never; path: { concessionId: number }; cookie?: never };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: { concessionId: number };
        cookie?: never;
      };
      requestBody?: never;
      responses: { 200: ConcessionResponse };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
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
  /** 작성중 저장 본문에 불합격 사유(`defects`)를 더한다 — 서버 선행 P-48. 조회는 `lotId` 질의를 더한다 — P-76. */
  '/quality/inspection-results': Omit<InspectionResultsPath, 'get' | 'post'> & {
    get: Omit<InspectionResultsGet, 'parameters'> & {
      parameters: Omit<InspectionResultsGet['parameters'], 'query'> & {
        query?: InspectionResultListQueryForward;
      };
    };
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
  /** 시리얼 OQC 스캔 — 서버 선행 P-101. */
  '/quality/oqc-serials/{serialNo}': {
    parameters: { query?: never; header?: never; path: { serialNo: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { serialNo: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': OqcSerialScan };
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
  /** 의뢰의 시리얼 판정 — 서버 선행 P-101. */
  '/quality/inspection-requests/{inspectionRequestId}/oqc-serials': {
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
          content: { 'application/json': { items: OqcSerialRecord[] } };
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
  /** 서버 선행 P-83(omf-all-around#119) — OQC 생략 요청(결재 상신). 202 승인 요청 id. */
  '/logistics/shipment-requests/{shipmentRequestId}:request-oqc-skip': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: { shipmentRequestId: number };
        cookie?: never;
      };
      requestBody: { content: { 'application/json': { reason: string } } };
      responses: {
        202: {
          headers: { [name: string]: unknown };
          content: { 'application/json': { approvalRequestId: number } };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  /** 서버 선행 P-83(omf-all-around#119) — 승인된 OQC 생략의 실행. 본문 없음 · 200 출하작업지시 상세. */
  '/logistics/shipment-requests/{shipmentRequestId}:skip-oqc': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: { shipmentRequestId: number };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': components['schemas']['ShipmentRequest'] };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
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
  /** 참여·이탈에 현장 작업자 사번 헤더를 더한다. 단말 토큰으로 부르면 서버가 필수로 본다. */
  '/production/work-sessions/{workSessionId}/workers': Omit<SessionWorkersPath, 'get' | 'post'> & {
    get: Omit<SessionWorkersPath['get'], 'responses'> & {
      responses: Omit<SessionWorkersPath['get']['responses'], 200> & {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': WorkSessionWorkerForward[] };
        };
      };
    };
    post: Omit<SessionWorkersPath['post'], 'parameters' | 'responses'> & {
      parameters: Omit<SessionWorkersPath['post']['parameters'], 'header'> & {
        header: SessionWorkersPath['post']['parameters']['header'] & { 'X-Worker-No'?: string };
      };
      responses: Omit<SessionWorkersPath['post']['responses'], 201> & {
        201: {
          headers: { [name: string]: unknown };
          content: { 'application/json': WorkSessionWorkerForward };
        };
      };
    };
  };
  '/production/work-sessions/{workSessionId}/workers/{workSessionWorkerId}:leave': Omit<
    SessionWorkerLeavePath,
    'post'
  > & {
    post: Omit<SessionWorkerLeavePath['post'], 'parameters' | 'responses'> & {
      parameters: Omit<SessionWorkerLeavePath['post']['parameters'], 'header'> & {
        header: SessionWorkerLeavePath['post']['parameters']['header'] & { 'X-Worker-No'?: string };
      };
      responses: Omit<SessionWorkerLeavePath['post']['responses'], 200> & {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': WorkSessionWorkerForward };
        };
      };
    };
  };
  /** 공정에 매핑된 불량 코드만 받는 `processId` 를 더한다 — 서버 선행. */
  '/quality/defect-codes': Omit<DefectCodesPath, 'get'> & {
    get: Omit<DefectCodesGet, 'parameters'> & {
      parameters: Omit<DefectCodesGet['parameters'], 'query'> & {
        query?: NonNullable<DefectCodesGet['parameters']['query']> & { processId?: number };
      };
    };
  };
  '/production/production-results': Omit<ProductionResultsPath, 'get' | 'post'> & {
    post: Omit<ProductionResultsPath['post'], 'requestBody' | 'responses'> & {
      requestBody: { content: { 'application/json': ProductionResultCreateForward } };
      responses: Omit<ProductionResultsPath['post']['responses'], 201> & {
        201: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ProductionResultForward };
        };
      };
    };
    get: Omit<ProductionResultsGet, 'responses'> & {
      responses: Omit<ProductionResultsGet['responses'], 200> & {
        200: {
          headers: { [name: string]: unknown };
          content: {
            'application/json': {
              items: ProductionResultForward[];
              page: components['schemas']['PageMeta'];
            };
          };
        };
      };
    };
  };
  '/production/work-orders': Omit<WorkOrdersPath, 'get'> & {
    get: Omit<WorkOrdersGet, 'parameters' | 'responses'> & {
      /**
       * 서버 선행 — `includeUnplannedEquipment` 를 `plannedEquipmentId` 와 함께 보내면 「그 설비 또는
       * 설비 미지정」이다.
       */
      parameters: Omit<WorkOrdersGet['parameters'], 'query'> & {
        query?: NonNullable<WorkOrdersGet['parameters']['query']> & {
          includeUnplannedEquipment?: boolean;
        };
      };
      responses: Omit<WorkOrdersGet['responses'], 200> & {
        200: Omit<WorkOrdersGet['responses'][200], 'content'> & {
          content: {
            'application/json': Omit<
              WorkOrdersGet['responses'][200]['content']['application/json'],
              'items'
            > & { items: WorkOrderForward[] };
          };
        };
      };
    };
  };
  '/production/work-orders/{workOrderId}': Omit<WorkOrderPath, 'get'> & {
    get: Omit<WorkOrderGet, 'responses'> & {
      responses: Omit<WorkOrderGet['responses'], 200> & {
        200: Omit<WorkOrderGet['responses'][200], 'content'> & {
          content: { 'application/json': WorkOrderForward };
        };
      };
    };
  };
  '/planning/production-orders': Unused & {
    parameters: NoParameters;
    get: Omit<ProductionOrdersGet, 'parameters' | 'responses'> & {
      parameters: Omit<ProductionOrdersGet['parameters'], 'query'> & {
        query?: ProductionOrderListQueryForward;
      };
      responses: Omit<ProductionOrdersGet['responses'], 200> & {
        200: {
          headers: { [name: string]: unknown };
          content: {
            'application/json': {
              items: ProductionOrderForward[];
              page: components['schemas']['PageMeta'];
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
  };
  '/planning/production-orders/{productionOrderId}': Unused & {
    parameters: NoParameters;
    get: Omit<ProductionOrderGet, 'responses'> & {
      responses: Omit<ProductionOrderGet['responses'], 200> & {
        200: Omit<ProductionOrderGet['responses'][200], 'content'> & {
          content: { 'application/json': ProductionOrderForward };
        };
      };
    };
    put?: never;
    post?: never;
  };
  '/planning/production-orders/{productionOrderId}:auto-plan': Unused & {
    parameters: NoParameters;
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: { productionOrderId: number };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ProductionOrderAutoPlanResult };
        };
        409: {
          headers: { [name: string]: unknown };
          content: { 'application/json': components['schemas']['ProductionConflictResponse'] };
        };
      };
    };
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
  /** 서버 선행 P-87(omf-all-around#64) — 품목 검사 수준 목록·지정. */
  '/quality/item-inspection-levels': Unused & {
    parameters: NoParameters;
    get: {
      parameters: {
        query?: ItemInspectionLevelListQuery;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': { items: ItemInspectionLevel[]; page: PageMeta } };
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
      requestBody: { content: { 'application/json': ItemInspectionLevelCreate } };
      responses: {
        201: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ItemInspectionLevel };
        };
      };
    };
  };
  /** 서버 선행 P-87 — 수동 변경. */
  '/quality/item-inspection-levels/{itemInspectionLevelId}': Unused & {
    parameters: NoParameters;
    get?: never;
    put: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string; 'If-Match': string };
        path: { itemInspectionLevelId: number };
        cookie?: never;
      };
      requestBody: { content: { 'application/json': ItemInspectionLevelUpdate } };
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ItemInspectionLevel };
        };
      };
    };
    post?: never;
  };
  /** 서버 선행 P-87 — 전환 이력. */
  '/quality/item-inspection-level-histories': Unused & {
    parameters: NoParameters;
    get: {
      parameters: {
        query?: ItemInspectionLevelHistoryQuery;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': { items: ItemInspectionLevelHistory[]; page: PageMeta } };
        };
      };
    };
    put?: never;
    post?: never;
  };
  /** 서버 선행 P-102(omf-all-around#89) — 검사표 기준 목록·등록. */
  '/quality/inspection-sheet-templates': Unused & {
    parameters: NoParameters;
    put?: never;
    get: Op<
      { query?: InspectionSheetTemplateListQuery; header?: never; path?: never; cookie?: never },
      never,
      { 200: Json<{ items: InspectionSheetTemplate[]; page: PageMeta }> }
    >;
    post: Op<
      { query?: never; header: { 'Idempotency-Key': string }; path?: never; cookie?: never },
      { content: { 'application/json': InspectionSheetTemplateCreate } },
      { 201: Json<InspectionSheetTemplate> }
    >;
  };
  /** 서버 선행 P-102 — 검사표 기준 상세(ETag)·수정(작성중만). */
  '/quality/inspection-sheet-templates/{inspectionSheetTemplateId}': Unused & {
    parameters: NoParameters;
    post?: never;
    get: Op<
      { query?: never; header?: never; path: TemplateId; cookie?: never },
      never,
      { 200: Json<InspectionSheetTemplate> }
    >;
    put: Op<
      Params<never, LockHeader, TemplateId>,
      { content: { 'application/json': InspectionSheetTemplateUpdate } },
      { 200: Json<InspectionSheetTemplate> }
    >;
  };
  /** 서버 선행 P-102 — 검사표 기준 확정. */
  '/quality/inspection-sheet-templates/{inspectionSheetTemplateId}:confirm': Unused & {
    parameters: NoParameters;
    get?: never;
    put?: never;
    post: Op<Params<never, LockHeader, TemplateId>, never, { 200: Json<InspectionSheetTemplate> }>;
  };
  /** 서버 선행 P-102 — 시리얼로 검사표 열기(없으면 만든다). */
  '/quality/inspection-sheets:open-by-serial': Unused & {
    parameters: NoParameters;
    get?: never;
    put?: never;
    post: Op<
      { query?: never; header: IdemHeader; path?: never; cookie?: never },
      { content: { 'application/json': { serialNo: string } } },
      { 200: Json<InspectionSheet> }
    >;
  };
  /** 서버 선행 P-102 — 검사표 상세(ETag). */
  '/quality/inspection-sheets/{inspectionSheetId}': Unused & {
    parameters: NoParameters;
    put?: never;
    post?: never;
    get: Op<
      { query?: never; header?: { 'X-Worker-No'?: string }; path: SheetId; cookie?: never },
      never,
      { 200: Json<InspectionSheet> }
    >;
  };
  '/quality/inspection-sheets/{inspectionSheetId}/header': SheetPut<
    SheetId,
    InspectionSheetHeaderUpdate
  >;
  '/quality/inspection-sheets/{inspectionSheetId}/steps/{stepCode}': SheetPut<
    SheetId & { stepCode: InspectionSheetStepCode },
    InspectionSheetStepWrite
  >;
  '/quality/inspection-sheets/{inspectionSheetId}/ngs': SheetPut<
    SheetId,
    { ngs: InspectionSheetNgWrite[] }
  >;
  /** 서버 선행 P-102 S3 — 목록(LOT·시리얼·W/O). */
  '/quality/inspection-sheets': Unused & {
    parameters: NoParameters;
    put?: never;
    post?: never;
    get: Op<
      { query?: InspectionSheetListQuery; header?: never; path?: never; cookie?: never },
      never,
      { 200: Json<{ items: InspectionSheetSummary[]; page: PageMeta }> }
    >;
  };
  /** 서버 선행 P-102 S3 — 단계 서명 · 승인 · 확인 · 승인 취소(W-03-14). */
  '/quality/inspection-sheets/{inspectionSheetId}/steps/{stepCode}:sign': SheetAction<
    SheetId & { stepCode: InspectionSheetStepCode }
  >;
  '/quality/inspection-sheets/{inspectionSheetId}:approve': SheetAction<SheetId>;
  '/quality/inspection-sheets/{inspectionSheetId}:check': SheetAction<SheetId>;
  '/quality/inspection-sheets/{inspectionSheetId}:reopen': SheetAction<SheetId, { reason: string }>;
}

/** 같은 경로를 forward 가 다시 적으면 그쪽이 이긴다 — 교집합이면 좁은 쪽 enum 이 남는다(omf-all-around#58 첨부 대상). */
export type ApiPaths = Omit<paths, keyof ForwardPaths> & ForwardPaths;

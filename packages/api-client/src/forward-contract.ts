import type { components, paths } from './generated/api';

/** P-7/P-10 선행 계약: 공식 설계 사본이 갱신될 때 동등성을 대조하고 제거한다. */
export type TerminalRegistrationStatusCode = 'UNREGISTERED' | 'REGISTERED';

export interface TerminalRegistrationConfirmation {
  terminalId: number;
  tokenVersion: number;
  registrationStatusCode: 'REGISTERED';
  registrationConfirmedAt: string;
}

/** 서버 선행 P-38 — `Session.worker`. 서버가 «언제나» 싣고 연결이 없으면 null 이다. */
export interface SessionWorker {
  workerId: number;
  workerNo: string;
  workerName: string;
}

/**
 * 서버 선행 P-86(omf-all-around#63) — IQC 판정 때 자재 LOT 의 4M 변경품(변경 종류 = 공통코드 `FOUR_M_CHANGE_TYPE`).
 * 쓰기 본문에서 생략하면 그대로, `null` 이면 변경품 아님. 조회(의뢰·LOT 목록)는 변경품일 때만 키가 있다.
 *
 * 전달본 2026-10-29-2 는 검사 결과 쓰기 본문(`InspectionResultConfirm`·`Create`·`Update`)의 `fourMChange.remarks` 를
 * 필수로 적어 이 모양(둘 다 선택)과 다르다 — 맞춰질 때까지 `fourMChange` 만 덮는다. 불합격 사유(`defects`)·판정 변경
 * 사유(`judgmentChangeReason`)·시리얼 판정(`serials`)은 생성 타입이 갖는다.
 */
export interface FourMChangeForward {
  /** omf-all-around#133 — IQC 입력에서 변경 종류를 받지 않는다. 예전 기록에만 있다. */
  changeTypeCode?: string;
  remarks?: string;
}

export type InspectionResultConfirmForward = Omit<
  components['schemas']['InspectionResultConfirm'],
  'fourMChange'
> & {
  fourMChange?: FourMChangeForward | null;
};

type InspectionConfirmPath = paths['/quality/inspection-results/{inspectionResultId}:confirm'];

export type InspectionResultCreateForward = Omit<
  components['schemas']['InspectionResultCreate'],
  'fourMChange'
> & {
  fourMChange?: FourMChangeForward | null;
};

export type InspectionResultUpdateForward = Omit<
  components['schemas']['InspectionResultUpdate'],
  'fourMChange'
> & {
  fourMChange?: FourMChangeForward | null;
};

type InspectionResultsPath = paths['/quality/inspection-results'];
type InspectionResultPath = paths['/quality/inspection-results/{inspectionResultId}'];

type DefectRecordsGet = paths['/quality/defect-records']['get'];

/**
 * 서버 선행 P-42 — 검사 결과 하나로 좁히면(`inspectionResultId`) 기간이 필요 없다. 작성중 회차의 기록도 돌려준다(P-48).
 * `inspectionResultId` 는 생성 타입에 들어왔지만 기간(`detectedFrom`·`detectedTo`)은 아직 필수라 그 둘만 덮는다.
 */
export type DefectRecordListQueryForward = Omit<
  DefectRecordsGet['parameters']['query'],
  'detectedFrom' | 'detectedTo'
> & { detectedFrom?: string; detectedTo?: string };

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
 *
 * 전달본 2026-10-29-2 의 `ItemResourceMap` 은 이름 칸(공정·설비·금형 코드·이름, 라인, 비고)을 선택으로 적어 이
 * 모양(늘 싣고 없으면 null)과 다르다 — 맞춰질 때까지 응답만 덮는다. 등록·수정 본문은 생성 타입을 쓴다.
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

export interface ItemResourceMapListQuery {
  plantId?: number;
  itemId?: number;
  equipmentId?: number;
  moldId?: number;
  includeInactive?: boolean;
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
    /** omf-all-around#133 — IQC 에서 변경 종류를 받지 않게 된 뒤의 기록은 칸이 없다. */
    changeTypeCode?: string;
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
  /** 시리얼 투입 자재 — 서버 선행 P-107. */
  '/trace/serial-numbers/{serialNo}/input-materials': {
    parameters: { query?: never; header?: never; path: { serialNo: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { serialNo: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': components['schemas']['InputMaterials'] };
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
  /** 검사 결과 쓰기 셋은 본문의 `fourMChange` 만 덮는다 — `FourMChangeForward` 참고. */
  '/quality/inspection-results/{inspectionResultId}:confirm': Omit<
    InspectionConfirmPath,
    'post'
  > & {
    post: Omit<InspectionConfirmPath['post'], 'requestBody'> & {
      requestBody: { content: { 'application/json': InspectionResultConfirmForward } };
    };
  };
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
  /** 조회에 `inspectionResultId` 질의를 더하고 그때 기간을 생략할 수 있게 한다 — 서버 선행 P-42. */
  '/quality/defect-records': Omit<paths['/quality/defect-records'], 'get'> & {
    get: Omit<DefectRecordsGet, 'parameters'> & {
      parameters: Omit<DefectRecordsGet['parameters'], 'query'> & {
        query: DefectRecordListQueryForward;
      };
    };
  };
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
      requestBody: {
        content: { 'application/json': components['schemas']['ItemResourceMapCreate'] };
      };
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
      requestBody: {
        content: { 'application/json': components['schemas']['ItemResourceMapUpdate'] };
      };
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': ItemResourceMap };
        };
      };
    };
    post?: never;
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
  /** 서버 선행 P-102 S3 — 단계 서명 · 승인 · 확인 · 승인 취소(W-03-14). */
  '/quality/inspection-sheets/{inspectionSheetId}/steps/{stepCode}:sign': SheetAction<
    SheetId & { stepCode: InspectionSheetStepCode }
  >;
  '/quality/inspection-sheets/{inspectionSheetId}:approve': SheetAction<SheetId>;
  '/quality/inspection-sheets/{inspectionSheetId}:check': SheetAction<SheetId>;
  '/quality/inspection-sheets/{inspectionSheetId}:reopen': SheetAction<SheetId, { reason: string }>;
}

/** 같은 경로를 forward 가 다시 적으면 그쪽이 이긴다. */
export type ApiPaths = Omit<paths, keyof ForwardPaths> & ForwardPaths;

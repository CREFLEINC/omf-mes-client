/*
 * 피처 005(자재 관리 LOT · 입하 LOT) 생성 타입 이름표 — T111.
 *
 * 서버 PR #1021~#1037 병합 뒤 `gen:api` 로 다시 만든 생성 타입(`generated/api.d.ts`)을 그대로 가리킨다. 손으로 쓴 선행 계약은
 * 걷었고, 화면 코드가 이미 쓰던 이름만 남겼다 — 모양은 모두 생성 타입이 정한다. 여기에 칸을 덧대지 않는다.
 */
import type { components, paths } from './generated/api';

type Schemas = components['schemas'];
type QueryOf<P extends keyof paths> = NonNullable<
  NonNullable<paths[P]['get']>['parameters']['query']
>;

/* ── 자재 관리 LOT 발행 · 공급사·품목 기본 정보(계약 §1 · §9) ── */

export type MaterialPackage = Schemas['MaterialPackage'];
export type MaterialPackageInput = Schemas['MaterialPackageInput'];
export type MaterialLotSummary = Schemas['MaterialLotSummary'];
export type MaterialLotLifecycleCode = MaterialLotSummary['lifecycleStatusCode'];
export type WaitingMaterialLotGroup = Schemas['WaitingMaterialLotGroup'];
export type MaterialLotBatchCreate = Schemas['MaterialLotBatchCreate'];
export type MaterialLotBatchCreated = Schemas['MaterialLotBatchCreated'];
export type MaterialLotVoidResult = Schemas['MaterialLotVoidResult'];
export type SupplierItemDefault = Schemas['SupplierItemDefault'];
export type SupplierItemDefaultCreate = Schemas['SupplierItemDefaultCreate'];
export type SupplierItemDefaultUpdate = Schemas['SupplierItemDefaultUpdate'];

/* ── 입하 LOT(계약 §2 · §3) ── */

export type InboundLot = Schemas['InboundLot'];
export type InboundLotDetail = Schemas['InboundLotDetail'];
export type InboundLotMaterialLot = Schemas['InboundLotMaterialLot'];
export type InboundLotClosed = Schemas['InboundLotClosed'];
export type InboundLotListQuery = QueryOf<'/logistics/inbound-lots'>;
export type InboundLotReopenReasonCode = NonNullable<InboundLot['reopenReasonCode']>;
export type InboundLotPoAllocation = Schemas['InboundLotPoAllocation'];
export type InboundLotReceive = Schemas['InboundLotReceive'];
export type InboundLotReceiveResult = Schemas['InboundLotReceiveResult'];
export type InboundLotReceiveRejectionCode =
  Schemas['InboundLotReceiveRejection']['rejectedLots'][number]['reasonCode'];
export type InboundLotSplitPreview = Schemas['InboundLotSplitPreview'];
export type InboundLotSplitResult = Schemas['InboundLotSplitResult'];

/* ── 입하 LOT 실적 · 최종 마감(계약 §2 · W-01-16) ── */

export type InboundLotFinalizeBlocker = Schemas['InboundLotFinalizeBlocker'];
export type InboundLotFinalizeBlockerCode = InboundLotFinalizeBlocker['code'];
export type InboundLotAllocationCandidate = Schemas['InboundLotAllocationCandidate'];
export type InboundLotWorkRecordErrorDetails = NonNullable<
  Schemas['InboundLotWorkRecordError']['details']
>;

/* ── IQC 입하 LOT 단위(계약 §8) ── */

/** 대기열 · 상세 행 — 입하 LOT 단위 칸(`lots` · `results` · `lotJudgments` …)도 이 모양에 있다. */
export type InspectionRequestForward = Schemas['InspectionRequest'];
export type InspectionLotForward = Schemas['InspectionRequestLot'];
export type InspectionResultSummaryForward = Schemas['InspectionRequestResultSummary'];
export type InspectionLotJudgmentForward = Schemas['InspectionRequestLotJudgment'];
export type InspectionRequestEventForward = Schemas['InspectionRequestEvent'];
export type InspectionConfirmBlockerCode = Schemas['InspectionConfirmCancelBlocker']['code'];
export type InspectionAqlPlanForward = Schemas['InspectionAqlPlan'];

/** 새 흐름(대상 = 입하 LOT) IQC 의뢰인가 — 이전된 옛 요청(대상 LOT)은 지금 화면 경로 그대로(FR-051 · R18-1). */
export const isInboundLotInspection = (request: { targetTypeCode: string }): boolean =>
  request.targetTypeCode === 'INBOUND_LOT';

/* ── 처분 · 특채 · 재검 표시(계약 §8 · §10) ── */

export type InspectionResultForward005 = Schemas['InspectionResult'];
export type NonconformanceForward005 = Schemas['Nonconformance'];
export type NonconformanceLotForward005 = Schemas['NonconformanceLot'];
export type NonconformanceIqcResultRefForward005 = Schemas['NonconformanceIqcResultRef'];
export type DispositionDecisionCreateForward005 = Schemas['DispositionDecisionCreate'];
export type DispositionDecisionCreatedForward005 = Schemas['DispositionDecision'];
export type ConcessionCreateForward005 = Schemas['ConcessionCreate'];
export type ConcessionCreatedForward005 = Schemas['Concession'];

/* ── LOT · 결재 · IQC 생략(계약 §1 · §11) ── */

export type LotForward = Schemas['Lot'];
export type ApprovalTargetForward = Schemas['ApprovalTarget'];
export type ApprovalRequestDetailForward = Schemas['ApprovalRequestDetail'];
/** IQC 생략 실행 응답의 입하 LOT 칸(계약 §11). */
export type IqcSkipInboundLotForward = Pick<
  Schemas['IqcSkipExecuted'],
  'inboundLotNo' | 'lotCount'
>;

/* ── 입고 관리 · 재고 · LOT 현황의 입하 LOT 칸(계약 §12 · §13) ── */

export type ReceivingInboundLot = Schemas['ReceivingInboundLot'];
export type PurchaseOrderLineListItemForward = Schemas['PurchaseOrderLineListItem'];
export type InboundLotProgressForward = Schemas['InboundLotProgress'];
export type InventoryBalanceForward = Schemas['InventoryBalance'];
export type LotQualityStatusForward = Schemas['LotQualityStatus'];

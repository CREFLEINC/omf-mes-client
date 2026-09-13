/**
 * 베트남어 화면 문구. 모바일 화면이 쓰는 슬라이스와, 관리웹 **셸**·**설비/툴 13화면**이 쓰는
 * 슬라이스를 옮겼다.
 *
 * 옮기지 않은 슬라이스는 한국어를 그대로 쓴다 - 관리웹 화면 문구는 묶음별 후속 이슈 몫이고
 * POP 은 다른 팀 몫이라 여기서 건드리지 않는다. 용어는 GLOSSARY.md 에 묶어 두고 슬라이스마다
 * 같은 말을 쓴다.
 *
 * ⚠ **옮긴 슬라이스는 감지기의 대상 목록에도 더한다.** 모바일은
 * `apps/mobile/src/app/vi-messages.test.ts` 가 쓰는 슬라이스를 스스로 훑고, 관리웹은
 * `apps/web/src/app/vi-messages.test.ts` 의 `TRANSLATED` 가 그 목록이다 - 여기만 더하고
 * 저기를 빠뜨리면 반쯤 옮긴 슬라이스가 조용히 지나간다.
 */

import { ko, type Messages } from '../ko';

import type { Translated } from './translated';

import { alarmRecipientSettings } from './alarm-recipient-settings';
import { approvalInbox } from './approval-inbox';
import { approvalRoute } from './approval-route';
import { collectionChannel } from './collection-channel';
import { common } from './common';
import { commonCode } from './common-code';
import { conflict } from './conflict';
import { dashboard } from './dashboard';
import { defectCauseCode } from './defect-cause-code';
import { deviceRegistration } from './device-registration';
import { disposalIssue } from './disposal-issue';
import { dispositionDecision } from './disposition-decision';
import { dispositionRequest } from './disposition-request';
import { documentProgress } from './document-progress';
import { downtimeSummary } from './downtime-summary';
import { editability } from './editability';
import { emergencyWorkOrder } from './emergency-work-order';
import { equipmentFailure } from './equipment-failure';
import { equipmentFailureReport } from './equipment-failure-report';
import { equipmentInspection } from './equipment-inspection';
import { equipmentMaster } from './equipment-master';
import { expeditedShipment } from './expedited-shipment';
import { gaugeCalibration } from './gauge-calibration';
import { gaugeMaster } from './gauge-master';
import { goodsReceipt } from './goods-receipt';
import { httpError } from './http-error';
import { inboundReceipt } from './inbound-receipt';
import { inboundSchedule } from './inbound-schedule';
import { inboundVariance } from './inbound-variance';
import { inspectionResultInsights } from './inspection-result-insights';
import { inspectionStandard } from './inspection-standard';
import { integrationSync } from './integration-sync';
import { iqcInspection } from './iqc-inspection';
import { iqcSkipApproval } from './iqc-skip-approval';
import { iqcSkipRequest } from './iqc-skip-request';
import { itemExtendedAttrs } from './item-extended-attrs';
import { judgmentCode } from './judgment-code';
import { login } from './login';
import { lotStatusHistory } from './lot-status-history';
import { lotStatusTransition } from './lot-status-transition';
import { maintenanceOrder } from './maintenance-order';
import { maintenanceResult } from './maintenance-result';
import { masterChange } from './master-change';
import { materialIssueRequest } from './material-issue-request';
import { materialLocation } from './material-location';
import { materialLotScan } from './material-lot-scan';
import { materialPicking } from './material-picking';
import { notice } from './notice';
import { notificationCenter } from './notification-center';
import { oqcInspection } from './oqc-inspection';
import { outboxRejections } from './outbox-rejections';
import { overReceiptSplit } from './over-receipt-split';
import { packingRepack } from './packing-repack';
import { passwordChange } from './password-change';
import { pendingCode } from './pending-code';
import { physicalCount } from './physical-count';
import { poChangeReview } from './po-change-review';
import { poRegister } from './po-register';
import { productDisposalRequest } from './product-disposal-request';
import { productPicking } from './product-picking';
import { productReceipt } from './product-receipt';
import { productStockStatus } from './product-stock-status';
import { productionOrder } from './production-order';
import { productionPlan } from './production-plan';
import { putaway } from './putaway';
import { putawayRule } from './putaway-rule';
import { qualityApproval } from './quality-approval';
import { recycleEntry } from './recycle-entry';
import { repairRoundtrip } from './repair-roundtrip';
import { returnReceipt } from './return-receipt';
import { routing } from './routing';
import { save } from './save';
import { session } from './session';
import { shellHome } from './shell-home';
import { shellNav } from './shell-nav';
import { shipmentConfirm } from './shipment-confirm';
import { shipmentProcessing } from './shipment-processing';
import { shipmentRequestCreate } from './shipment-request-create';
import { shipmentSchedule } from './shipment-schedule';
import { shopfloorReceipt } from './shopfloor-receipt';
import { shotConversion } from './shot-conversion';
import { stateLocked } from './state-locked';
import { stockAdjust } from './stock-adjust';
import { stockReinstatement } from './stock-reinstatement';
import { stockStatus } from './stock-status';
import { stockTransfer } from './stock-transfer';
import { stocktaking } from './stocktaking';
import { supplierReturn } from './supplier-return';
import { suspiciousMaterialHold } from './suspicious-material-hold';
import { temporaryPutaway } from './temporary-putaway';
import { terminalProcessMap } from './terminal-process-map';
import { toolMaster } from './tool-master';
import { toolPmOrder } from './tool-pm-order';
import { toolPmResult } from './tool-pm-result';
import { usersRoles } from './users-roles';
import { warehouseLayout } from './warehouse-layout';
import { warehouseLocation } from './warehouse-location';
import { wipHandover } from './wip-handover';
import { workCalendar } from './work-calendar';
import { workOrder } from './work-order';
import { workOrderClose } from './work-order-close';
import { workOrderProgress } from './work-order-progress';
import { workOrderRelease } from './work-order-release';

export const vi: Translated<Messages> = {
  ...ko,
  alarmRecipientSettings,
  approvalInbox,
  approvalRoute,
  collectionChannel,
  common,
  commonCode,
  conflict,
  dashboard,
  defectCauseCode,
  deviceRegistration,
  disposalIssue,
  dispositionDecision,
  dispositionRequest,
  documentProgress,
  downtimeSummary,
  editability,
  emergencyWorkOrder,
  equipmentFailure,
  equipmentFailureReport,
  equipmentInspection,
  equipmentMaster,
  expeditedShipment,
  gaugeCalibration,
  gaugeMaster,
  goodsReceipt,
  httpError,
  inboundReceipt,
  inboundSchedule,
  inboundVariance,
  inspectionResultInsights,
  inspectionStandard,
  integrationSync,
  iqcInspection,
  iqcSkipApproval,
  iqcSkipRequest,
  itemExtendedAttrs,
  judgmentCode,
  login,
  lotStatusHistory,
  lotStatusTransition,
  maintenanceOrder,
  maintenanceResult,
  masterChange,
  materialIssueRequest,
  materialLocation,
  materialLotScan,
  materialPicking,
  notice,
  notificationCenter,
  oqcInspection,
  outboxRejections,
  overReceiptSplit,
  packingRepack,
  passwordChange,
  pendingCode,
  physicalCount,
  poChangeReview,
  poRegister,
  productDisposalRequest,
  productionOrder,
  productionPlan,
  productPicking,
  productReceipt,
  productStockStatus,
  putaway,
  putawayRule,
  qualityApproval,
  recycleEntry,
  repairRoundtrip,
  returnReceipt,
  routing,
  save,
  session,
  shellHome,
  shellNav,
  shipmentConfirm,
  shipmentProcessing,
  shipmentRequestCreate,
  shipmentSchedule,
  shopfloorReceipt,
  shotConversion,
  stateLocked,
  stockAdjust,
  stockReinstatement,
  stockStatus,
  stocktaking,
  stockTransfer,
  supplierReturn,
  suspiciousMaterialHold,
  temporaryPutaway,
  terminalProcessMap,
  toolMaster,
  toolPmOrder,
  toolPmResult,
  usersRoles,
  warehouseLayout,
  warehouseLocation,
  wipHandover,
  workCalendar,
  workOrder,
  workOrderClose,
  workOrderProgress,
  workOrderRelease,
};

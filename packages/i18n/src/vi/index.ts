/**
 * 베트남어 화면 문구. 모바일 화면이 쓰는 슬라이스와, 관리웹 **셸**·**설비/툴 13화면**이 쓰는
 * 슬라이스를 옮겼다.
 *
 * POP 현장 화면 슬라이스도 옮겼다 - POP 단말은 Windows 표시 언어를 따른다(`pop-locale.ts`).
 * 옮기지 않은 슬라이스는 한국어를 그대로 쓴다. 용어는 GLOSSARY.md 에 묶어 두고 슬라이스마다
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
import { downtimeRegister } from './downtime-register';
import { downtimeSummary } from './downtime-summary';
import { editability } from './editability';
import { emergencyWorkOrder } from './emergency-work-order';
import { emergencyWorkOrderField } from './emergency-work-order-field';
import { equipmentFailure } from './equipment-failure';
import { equipmentFailureReport } from './equipment-failure-report';
import { equipmentInspection } from './equipment-inspection';
import { equipmentMaster } from './equipment-master';
import { expeditedShipment } from './expedited-shipment';
import { gaugeCalibration } from './gauge-calibration';
import { gaugeMaster } from './gauge-master';
import { goodsIssueQr } from './goods-issue-qr';
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
import { materialInputScan } from './material-input-scan';
import { materialIssueRequest } from './material-issue-request';
import { materialLocation } from './material-location';
import { materialLotScan } from './material-lot-scan';
import { materialPicking } from './material-picking';
import { notice } from './notice';
import { notificationCenter } from './notification-center';
import { oqcInspection } from './oqc-inspection';
import { outboxRejections } from './outbox-rejections';
import { overReceiptSplit } from './over-receipt-split';
import { packingLabelReprint } from './packing-label-reprint';
import { packingRepack } from './packing-repack';
import { packingResult } from './packing-result';
import { packingWork } from './packing-work';
import { passwordChange } from './password-change';
import { pendingCode } from './pending-code';
import { physicalCount } from './physical-count';
import { poChangeReview } from './po-change-review';
import { poRegister } from './po-register';
import { popMaterialLotLabel } from './pop-material-lot-label';
import { popPageNav } from './pop-page-nav';
import { pqcInspection } from './pqc-inspection';
import { productDisposalRequest } from './product-disposal-request';
import { productPicking } from './product-picking';
import { productReceipt } from './product-receipt';
import { productStockStatus } from './product-stock-status';
import { productionOrder } from './production-order';
import { productionPlan } from './production-plan';
import { productionResult } from './production-result';
import { putaway } from './putaway';
import { putawayRule } from './putaway-rule';
import { qualityApproval } from './quality-approval';
import { recycleEntry } from './recycle-entry';
import { repackLabelIssue } from './repack-label-issue';
import { repairRoundtrip } from './repair-roundtrip';
import { returnReceipt } from './return-receipt';
import { reworkResultRegister } from './rework-result-register';
import { routing } from './routing';
import { runningChange } from './running-change';
import { save } from './save';
import { session } from './session';
import { shellHome } from './shell-home';
import { shellNav } from './shell-nav';
import { shipmentConfirm } from './shipment-confirm';
import { shipmentProcessing } from './shipment-processing';
import { shipmentRequestCreate } from './shipment-request-create';
import { shipmentSchedule } from './shipment-schedule';
import { shippingPackingLabel } from './shipping-packing-label';
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
import { toolUsage } from './tool-usage';
import { usersRoles } from './users-roles';
import { warehouseLayout } from './warehouse-layout';
import { warehouseLocation } from './warehouse-location';
import { wipHandover } from './wip-handover';
import { workCalendar } from './work-calendar';
import { workHoldRegister } from './work-hold-register';
import { workOrder } from './work-order';
import { workOrderClose } from './work-order-close';
import { workOrderProgress } from './work-order-progress';
import { workOrderRelease } from './work-order-release';
import { workPrecheckGate } from './work-precheck-gate';
import { workStart } from './work-start';
import { workerAssignment } from './worker-assignment';

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
  downtimeRegister,
  downtimeSummary,
  editability,
  emergencyWorkOrder,
  emergencyWorkOrderField,
  equipmentFailure,
  equipmentFailureReport,
  equipmentInspection,
  equipmentMaster,
  expeditedShipment,
  gaugeCalibration,
  gaugeMaster,
  goodsIssueQr,
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
  materialInputScan,
  materialIssueRequest,
  materialLocation,
  materialLotScan,
  materialPicking,
  notice,
  notificationCenter,
  oqcInspection,
  outboxRejections,
  overReceiptSplit,
  packingLabelReprint,
  packingRepack,
  packingResult,
  packingWork,
  passwordChange,
  pendingCode,
  physicalCount,
  poChangeReview,
  popMaterialLotLabel,
  popPageNav,
  poRegister,
  pqcInspection,
  productDisposalRequest,
  productionOrder,
  productionPlan,
  productionResult,
  productPicking,
  productReceipt,
  productStockStatus,
  putaway,
  putawayRule,
  qualityApproval,
  recycleEntry,
  repackLabelIssue,
  repairRoundtrip,
  returnReceipt,
  reworkResultRegister,
  routing,
  runningChange,
  save,
  session,
  shellHome,
  shellNav,
  shipmentConfirm,
  shipmentProcessing,
  shipmentRequestCreate,
  shipmentSchedule,
  shippingPackingLabel,
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
  toolUsage,
  usersRoles,
  warehouseLayout,
  warehouseLocation,
  wipHandover,
  workCalendar,
  workerAssignment,
  workHoldRegister,
  workOrder,
  workOrderClose,
  workOrderProgress,
  workOrderRelease,
  workPrecheckGate,
  workStart,
};

/**
 * 한국어 화면 문구. 화면에 보이는 텍스트의 정본이다.
 *
 * 작성 규칙
 * - 비활성 컨트롤의 사유는 「무엇이 막혔는지 + 어떻게 풀 수 있는지」를 함께 담는다. 감추지 않는다.
 * - 비활성 사유는 그 컨트롤의 이름으로 시작한다. 주어가 없으면 사유가 붙은 대상이
 *   시각적으로 끊겼을 때 복원할 단서가 없다. 여러 컨트롤이 공유하는 안내는 예외다.
 * - 구현 사정을 드러내는 말(내부 절차·기술 스택·시스템 구성)과 내부 이슈 번호를 넣지 않는다.
 *   사용자가 쓰지 않는 말은 화면에 내지 않는다.
 *
 * 파일 배치
 * - 문구는 화면마다 파일 하나다. 새 화면은 `ko/<화면>.ts`를 만들고 아래 목록에 한 줄을 더한다.
 * - 한 파일에 모아 두던 것을 쪼갠 이유는 팀이 여럿이어서다 — 모두가 같은 파일 끝에
 *   블록을 덧붙이면 서로 다른 화면을 만들면서도 매번 같은 자리에서 만난다.
 */

import { common } from './common';
import { conflict } from './conflict';
import { stateLocked } from './state-locked';
import { httpError } from './http-error';
import { save } from './save';
import { editability } from './editability';
import { pendingCode } from './pending-code';
import { warehouseLocation } from './warehouse-location';
import { routing } from './routing';
import { defectCauseCode } from './defect-cause-code';
import { integrationSync } from './integration-sync';
import { inspectionStandard } from './inspection-standard';
import { commonCode } from './common-code';
import { itemExtendedAttrs } from './item-extended-attrs';
import { masterChange } from './master-change';
import { judgmentCode } from './judgment-code';
import { usersRoles } from './users-roles';
import { inboundSchedule } from './inbound-schedule';
import { stockStatus } from './stock-status';
import { overReceiptSplit } from './over-receipt-split';
import { goodsReceipt } from './goods-receipt';
import { stocktaking } from './stocktaking';
import { supplierReturn } from './supplier-return';
import { disposalIssue } from './disposal-issue';
import { approvalRoute } from './approval-route';
import { approvalInbox } from './approval-inbox';
import { iqcSkipApproval } from './iqc-skip-approval';
import { poRegister } from './po-register';
import { login } from './login';
import { stockAdjust } from './stock-adjust';
import { passwordChange } from './password-change';
import { putawayRule } from './putaway-rule';
import { documentProgress } from './document-progress';
import { notificationCenter } from './notification-center';
import { iqcInspection } from './iqc-inspection';
import { pqcInspection } from './pqc-inspection';
import { productionResult } from './production-result';
import { equipmentMaster } from './equipment-master';
import { qualityApproval } from './quality-approval';
import { productionOrder } from './production-order';
import { gaugeMaster } from './gauge-master';
import { toolMaster } from './tool-master';
import { workCalendar } from './work-calendar';
import { collectionChannel } from './collection-channel';
import { shotConversion } from './shot-conversion';
import { lotStatusTransition } from './lot-status-transition';
import { workOrder } from './work-order';
import { workOrderClose } from './work-order-close';
import { workOrderRelease } from './work-order-release';
import { suspiciousMaterialHold } from './suspicious-material-hold';
import { shipmentSchedule } from './shipment-schedule';
import { materialInputScan } from './material-input-scan';
import { dispositionDecision } from './disposition-decision';
import { dispositionRequest } from './disposition-request';
import { emergencyWorkOrder } from './emergency-work-order';
import { emergencyWorkOrderField } from './emergency-work-order-field';
import { workStart } from './work-start';
import { workOrderProgress } from './work-order-progress';
import { materialLocation } from './material-location';
import { materialPicking } from './material-picking';
import { toolUsage } from './tool-usage';
import { productStockStatus } from './product-stock-status';
import { shipmentRequestCreate } from './shipment-request-create';
import { shipmentProcessing } from './shipment-processing';
import { dashboard } from './dashboard';
import { downtimeRegister } from './downtime-register';
import { downtimeSummary } from './downtime-summary';
import { gaugeCalibration } from './gauge-calibration';
import { equipmentFailure } from './equipment-failure';
import { maintenanceOrder } from './maintenance-order';
import { maintenanceResult } from './maintenance-result';
import { toolPmOrder } from './tool-pm-order';
import { notice } from './notice';
import { warehouseLayout } from './warehouse-layout';
import { terminalProcessMap } from './terminal-process-map';
import { toolPmResult } from './tool-pm-result';
import { materialIssueRequest } from './material-issue-request';
import { deviceRegistration } from './device-registration';
import { equipmentFailureReport } from './equipment-failure-report';
import { outboxRejections } from './outbox-rejections';
import { iqcSkipRequest } from './iqc-skip-request';
import { equipmentInspection } from './equipment-inspection';
import { oqcInspection } from './oqc-inspection';
import { expeditedShipment } from './expedited-shipment';
import { shipmentConfirm } from './shipment-confirm';
import { poChangeReview } from './po-change-review';
import { repairRoundtrip } from './repair-roundtrip';
import { productPicking } from './product-picking';
import { inboundReceipt } from './inbound-receipt';
import { packingRepack } from './packing-repack';
import { packingWork } from './packing-work';
import { putaway } from './putaway';
import { recycleEntry } from './recycle-entry';
import { inboundVariance } from './inbound-variance';
import { temporaryPutaway } from './temporary-putaway';
import { shellHome } from './shell-home';
import { wipHandover } from './wip-handover';
import { workerAssignment } from './worker-assignment';
import { popMaterialLotLabel } from './pop-material-lot-label';
import { identificationTagIssue } from './identification-tag-issue';
import { reworkResultRegister } from './rework-result-register';
import { packingLabelReprint } from './packing-label-reprint';
import { popLotLabelPrint } from './pop-lot-label-print';
import { shippingPackingLabel } from './shipping-packing-label';
import { repackLabelIssue } from './repack-label-issue';
import { runningChange } from './running-change';

export const ko = {
  common,
  conflict,
  stateLocked,
  httpError,
  save,
  editability,
  pendingCode,
  warehouseLocation,
  routing,
  defectCauseCode,
  integrationSync,
  inspectionStandard,
  commonCode,
  itemExtendedAttrs,
  masterChange,
  judgmentCode,
  usersRoles,
  inboundSchedule,
  stockStatus,
  overReceiptSplit,
  goodsReceipt,
  stocktaking,
  supplierReturn,
  disposalIssue,
  approvalRoute,
  approvalInbox,
  iqcSkipApproval,
  poRegister,
  login,
  stockAdjust,
  passwordChange,
  putawayRule,
  documentProgress,
  notificationCenter,
  iqcInspection,
  pqcInspection,
  productionResult,
  equipmentMaster,
  qualityApproval,
  productionOrder,
  gaugeMaster,
  toolMaster,
  workCalendar,
  collectionChannel,
  shotConversion,
  lotStatusTransition,
  workOrder,
  workOrderClose,
  workOrderRelease,
  suspiciousMaterialHold,
  shipmentSchedule,
  materialInputScan,
  dispositionDecision,
  dispositionRequest,
  emergencyWorkOrder,
  emergencyWorkOrderField,
  workOrderProgress,
  materialLocation,
  materialPicking,
  productStockStatus,
  shipmentRequestCreate,
  shipmentProcessing,
  dashboard,
  downtimeRegister,
  downtimeSummary,
  gaugeCalibration,
  equipmentFailure,
  maintenanceOrder,
  maintenanceResult,
  toolPmOrder,
  notice,
  warehouseLayout,
  terminalProcessMap,
  toolPmResult,
  materialIssueRequest,
  deviceRegistration,
  equipmentFailureReport,
  outboxRejections,
  iqcSkipRequest,
  equipmentInspection,
  oqcInspection,
  expeditedShipment,
  shipmentConfirm,
  toolUsage,
  repairRoundtrip,
  productPicking,
  inboundReceipt,
  packingRepack,
  packingWork,
  putaway,
  recycleEntry,
  inboundVariance,
  temporaryPutaway,
  poChangeReview,
  shellHome,
  wipHandover,
  workerAssignment,
  popMaterialLotLabel,
  identificationTagIssue,
  workStart,
  reworkResultRegister,
  packingLabelReprint,
  popLotLabelPrint,
  shippingPackingLabel,
  repackLabelIssue,
  runningChange,
} as const;

export type Messages = typeof ko;

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

import { collectionChannel } from './collection-channel';
import { common } from './common';
import { conflict } from './conflict';
import { dashboard } from './dashboard';
import { deviceRegistration } from './device-registration';
import { downtimeSummary } from './downtime-summary';
import { editability } from './editability';
import { equipmentFailure } from './equipment-failure';
import { equipmentFailureReport } from './equipment-failure-report';
import { equipmentInspection } from './equipment-inspection';
import { equipmentMaster } from './equipment-master';
import { gaugeCalibration } from './gauge-calibration';
import { gaugeMaster } from './gauge-master';
import { inboundReceipt } from './inbound-receipt';
import { inboundVariance } from './inbound-variance';
import { httpError } from './http-error';
import { iqcSkipRequest } from './iqc-skip-request';
import { login } from './login';
import { maintenanceOrder } from './maintenance-order';
import { maintenanceResult } from './maintenance-result';
import { materialLocation } from './material-location';
import { materialLotScan } from './material-lot-scan';
import { materialPicking } from './material-picking';
import { outboxRejections } from './outbox-rejections';
import { packingRepack } from './packing-repack';
import { pendingCode } from './pending-code';
import { physicalCount } from './physical-count';
import { productPicking } from './product-picking';
import { productReceipt } from './product-receipt';
import { putaway } from './putaway';
import { recycleEntry } from './recycle-entry';
import { repairRoundtrip } from './repair-roundtrip';
import { save } from './save';
import { session } from './session';
import { shellHome } from './shell-home';
import { shellNav } from './shell-nav';
import { shopfloorReceipt } from './shopfloor-receipt';
import { shotConversion } from './shot-conversion';
import { stateLocked } from './state-locked';
import { stockTransfer } from './stock-transfer';
import { temporaryPutaway } from './temporary-putaway';
import { toolMaster } from './tool-master';
import { toolPmOrder } from './tool-pm-order';
import { toolPmResult } from './tool-pm-result';
import { wipHandover } from './wip-handover';
import { workCalendar } from './work-calendar';

export const vi: Translated<Messages> = {
  ...ko,
  collectionChannel,
  common,
  conflict,
  dashboard,
  deviceRegistration,
  downtimeSummary,
  editability,
  equipmentFailure,
  equipmentFailureReport,
  equipmentInspection,
  equipmentMaster,
  gaugeCalibration,
  gaugeMaster,
  httpError,
  inboundReceipt,
  inboundVariance,
  iqcSkipRequest,
  login,
  maintenanceOrder,
  maintenanceResult,
  materialLocation,
  materialLotScan,
  materialPicking,
  outboxRejections,
  packingRepack,
  pendingCode,
  physicalCount,
  productPicking,
  productReceipt,
  putaway,
  recycleEntry,
  repairRoundtrip,
  save,
  session,
  shellHome,
  shellNav,
  shopfloorReceipt,
  shotConversion,
  stateLocked,
  stockTransfer,
  temporaryPutaway,
  toolMaster,
  toolPmOrder,
  toolPmResult,
  wipHandover,
  workCalendar,
};

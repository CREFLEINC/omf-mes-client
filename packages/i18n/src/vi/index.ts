/**
 * 베트남어 화면 문구. 모바일 화면이 쓰는 슬라이스와, 관리웹 **셸**이 쓰는 슬라이스를 옮겼다.
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

import { common } from './common';
import { commonCode } from './common-code';
import { conflict } from './conflict';
import { dashboard } from './dashboard';
import { defectCauseCode } from './defect-cause-code';
import { deviceRegistration } from './device-registration';
import { editability } from './editability';
import { equipmentFailureReport } from './equipment-failure-report';
import { equipmentInspection } from './equipment-inspection';
import { inboundReceipt } from './inbound-receipt';
import { inboundVariance } from './inbound-variance';
import { inspectionStandard } from './inspection-standard';
import { integrationSync } from './integration-sync';
import { httpError } from './http-error';
import { iqcSkipRequest } from './iqc-skip-request';
import { itemExtendedAttrs } from './item-extended-attrs';
import { judgmentCode } from './judgment-code';
import { login } from './login';
import { masterChange } from './master-change';
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
import { putawayRule } from './putaway-rule';
import { recycleEntry } from './recycle-entry';
import { repairRoundtrip } from './repair-roundtrip';
import { routing } from './routing';
import { save } from './save';
import { session } from './session';
import { shellHome } from './shell-home';
import { shellNav } from './shell-nav';
import { shopfloorReceipt } from './shopfloor-receipt';
import { stateLocked } from './state-locked';
import { stockTransfer } from './stock-transfer';
import { temporaryPutaway } from './temporary-putaway';
import { warehouseLayout } from './warehouse-layout';
import { warehouseLocation } from './warehouse-location';
import { wipHandover } from './wip-handover';

export const vi: Translated<Messages> = {
  ...ko,
  common,
  commonCode,
  conflict,
  dashboard,
  defectCauseCode,
  deviceRegistration,
  editability,
  equipmentFailureReport,
  equipmentInspection,
  httpError,
  inboundReceipt,
  inboundVariance,
  inspectionStandard,
  integrationSync,
  iqcSkipRequest,
  itemExtendedAttrs,
  judgmentCode,
  login,
  masterChange,
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
  putawayRule,
  recycleEntry,
  repairRoundtrip,
  routing,
  save,
  session,
  shellHome,
  shellNav,
  shopfloorReceipt,
  stateLocked,
  stockTransfer,
  temporaryPutaway,
  warehouseLayout,
  warehouseLocation,
  wipHandover,
};

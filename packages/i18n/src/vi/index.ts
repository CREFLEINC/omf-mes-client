/**
 * 베트남어 화면 문구. 모바일 화면이 쓰는 슬라이스만 옮겼다.
 *
 * 옮기지 않은 슬라이스는 한국어를 그대로 쓴다 - 웹과 POP 은 다른 팀 몫이라 여기서 건드리지
 * 않는다. 용어는 GLOSSARY.md 에 묶어 두고 슬라이스마다 같은 말을 쓴다.
 */

import { ko, type Messages } from '../ko';

import type { Translated } from './translated';

import { common } from './common';
import { deviceRegistration } from './device-registration';
import { equipmentFailureReport } from './equipment-failure-report';
import { equipmentInspection } from './equipment-inspection';
import { inboundReceipt } from './inbound-receipt';
import { inboundVariance } from './inbound-variance';
import { iqcSkipRequest } from './iqc-skip-request';
import { materialLocation } from './material-location';
import { materialLotScan } from './material-lot-scan';
import { materialPicking } from './material-picking';
import { outboxRejections } from './outbox-rejections';
import { packingRepack } from './packing-repack';
import { physicalCount } from './physical-count';
import { productPicking } from './product-picking';
import { productReceipt } from './product-receipt';
import { putaway } from './putaway';
import { recycleEntry } from './recycle-entry';
import { repairRoundtrip } from './repair-roundtrip';
import { shellHome } from './shell-home';
import { shopfloorReceipt } from './shopfloor-receipt';
import { stockTransfer } from './stock-transfer';
import { temporaryPutaway } from './temporary-putaway';
import { wipHandover } from './wip-handover';

export const vi: Translated<Messages> = {
  ...ko,
  common,
  deviceRegistration,
  equipmentFailureReport,
  equipmentInspection,
  inboundReceipt,
  inboundVariance,
  iqcSkipRequest,
  materialLocation,
  materialLotScan,
  materialPicking,
  outboxRejections,
  packingRepack,
  physicalCount,
  productPicking,
  productReceipt,
  putaway,
  recycleEntry,
  repairRoundtrip,
  shellHome,
  shopfloorReceipt,
  stockTransfer,
  temporaryPutaway,
  wipHandover,
};

import { messages } from '@omf-mes/i18n';

const t = messages.shellHome;

export interface HomeScreen {
  to: string;
  label: string;
  /** Material Symbols 이름. 글자를 다 읽기 전에 모양으로 먼저 찾는다. */
  icon: string;
}

export interface HomeGroup {
  label: string;
  screens: HomeScreen[];
}

/**
 * 작업 목록의 묶음과 타일.
 *
 * 묶음과 그 안의 차례는 설계 IA 의 타일을 그대로 따른다 - 우리가 다시 묶으면 화면이 늘 때
 * 어디에 넣을지가 매번 판단이 되고, 설계가 정한 자리와 조금씩 어긋난다.
 *
 * 아이콘은 일의 모양으로 고른다. 화면 이름이 비슷한 것끼리(입하·입고·적치) 글자로만 가르면
 * 끝까지 읽어야 구별된다.
 */
export const homeGroups: HomeGroup[] = [
  {
    label: t.tiles.inbound,
    screens: [
      { to: '/inbound-receipt', label: messages.inboundReceipt.title, icon: 'local_shipping' },
      { to: '/material-lot-scan', label: messages.materialLotScan.title, icon: 'qr_code_scanner' },
      { to: '/inbound-variance', label: messages.inboundVariance.title, icon: 'report' },
      { to: '/recycle-entry', label: messages.recycleEntry.title, icon: 'recycling' },
    ],
  },
  {
    label: t.tiles.putaway,
    screens: [
      { to: '/stock-transfer', label: messages.stockTransfer.title, icon: 'swap_horiz' },
      { to: '/material-location', label: messages.materialLocation.title, icon: 'pin_drop' },
      { to: '/putaway', label: messages.putaway.title, icon: 'shelves' },
      { to: '/temporary-putaway', label: messages.temporaryPutaway.title, icon: 'move_to_inbox' },
    ],
  },
  {
    label: t.tiles.picking,
    screens: [
      { to: '/material-picking', label: messages.materialPicking.title, icon: 'outbox' },
      { to: '/shopfloor-receipt', label: messages.shopfloorReceipt.title, icon: 'factory' },
    ],
  },
  {
    label: t.tiles.urgent,
    screens: [{ to: '/iqc-skip-request', label: messages.iqcSkipRequest.title, icon: 'bolt' }],
  },
  {
    label: t.tiles.stocktaking,
    screens: [{ to: '/physical-count', label: messages.physicalCount.title, icon: 'fact_check' }],
  },
  {
    label: t.tiles.productionMove,
    screens: [
      { to: '/wip-handover', label: messages.wipHandover.title, icon: 'sync_alt' },
      { to: '/repair-roundtrip', label: messages.repairRoundtrip.title, icon: 'build' },
    ],
  },
  {
    label: t.tiles.shipment,
    screens: [
      { to: '/product-receipt', label: messages.productReceipt.title, icon: 'warehouse' },
      { to: '/product-picking', label: messages.productPicking.title, icon: 'inventory' },
      { to: '/packing-repack', label: messages.packingRepack.title, icon: 'inventory_2' },
    ],
  },
  {
    label: t.tiles.equipment,
    screens: [
      { to: '/equipment-inspection', label: messages.equipmentInspection.title, icon: 'checklist' },
      { to: '/equipment-failure', label: messages.equipmentFailureReport.title, icon: 'warning' },
    ],
  },
  {
    label: t.shell,
    screens: [
      { to: '/outbox', label: messages.outboxPending.title, icon: 'schedule_send' },
      { to: '/rejections', label: messages.outboxRejections.title, icon: 'error' },
    ],
  },
];

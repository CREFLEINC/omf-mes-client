import { messages } from '@omf-mes/i18n';

const t = messages.shellHome;

export interface HomeScreen {
  to: string;
  label: string;
  /** Material Symbols 이름. 글자를 다 읽기 전에 모양으로 먼저 찾는다. */
  icon: string;
}

export interface HomeArea {
  /** 주소 조각. `/screens/<id>` 로 연다. */
  id: string;
  label: string;
  /** 무엇이 들어 있는지 한 줄. 업무 이름만으로는 어느 쪽인지 헷갈리는 작업이 있다. */
  summary: string;
  icon: string;
  screens: HomeScreen[];
}

/**
 * 작업 목록을 자재가 흐르는 차례대로 네 업무로 묶는다.
 *
 * 전에는 설계 IA 의 아홉 묶음 스물한 타일을 한 화면에 늘어놓아, 첫 화면에서 고를 것이 너무
 * 많았다(사용자 지시 2026-10-20). 현장은 「무슨 일을 하러 왔나」로 찾으므로 일이 일어나는 자리로
 * 묶는다 — 들어오는 자재(입고), 창고 안(창고), 라인·설비(생산 현장), 나가는 제품(제품 출하).
 *
 * 전송 기록 두 화면은 업무가 아니라 묶음에 두지 않는다. 앱바의 칩과 홈의 전송 현황이 그 길이다.
 *
 * 아이콘은 일의 모양으로 고른다. 화면 이름이 비슷한 것끼리(입하·입고·적치) 글자로만 가르면
 * 끝까지 읽어야 구별된다.
 */
export const homeAreas: HomeArea[] = [
  {
    id: 'inbound',
    label: t.areas.inbound.label,
    summary: t.areas.inbound.summary,
    icon: 'local_shipping',
    screens: [
      { to: '/inbound-receipt', label: messages.inboundReceipt.title, icon: 'local_shipping' },
      { to: '/material-lot-scan', label: messages.materialLotScan.title, icon: 'qr_code_scanner' },
      { to: '/inbound-variance', label: messages.inboundVariance.title, icon: 'report' },
      { to: '/recycle-entry', label: messages.recycleEntry.title, icon: 'recycling' },
      { to: '/iqc-skip-request', label: messages.iqcSkipRequest.title, icon: 'bolt' },
    ],
  },
  {
    id: 'warehouse',
    label: t.areas.warehouse.label,
    summary: t.areas.warehouse.summary,
    icon: 'warehouse',
    screens: [
      { to: '/putaway', label: messages.putaway.title, icon: 'shelves' },
      { to: '/temporary-putaway', label: messages.temporaryPutaway.title, icon: 'move_to_inbox' },
      { to: '/stock-transfer', label: messages.stockTransfer.title, icon: 'swap_horiz' },
      { to: '/material-picking', label: messages.materialPicking.title, icon: 'outbox' },
      { to: '/physical-count', label: messages.physicalCount.title, icon: 'fact_check' },
      { to: '/material-location', label: messages.materialLocation.title, icon: 'pin_drop' },
    ],
  },
  {
    id: 'shopfloor',
    label: t.areas.shopfloor.label,
    summary: t.areas.shopfloor.summary,
    icon: 'factory',
    screens: [
      { to: '/shopfloor-receipt', label: messages.shopfloorReceipt.title, icon: 'factory' },
      { to: '/wip-handover', label: messages.wipHandover.title, icon: 'sync_alt' },
      { to: '/repair-roundtrip', label: messages.repairRoundtrip.title, icon: 'build' },
      { to: '/equipment-inspection', label: messages.equipmentInspection.title, icon: 'checklist' },
      { to: '/equipment-failure', label: messages.equipmentFailureReport.title, icon: 'warning' },
    ],
  },
  {
    id: 'shipping',
    label: t.areas.shipping.label,
    summary: t.areas.shipping.summary,
    icon: 'inventory_2',
    screens: [
      { to: '/product-receipt', label: messages.productReceipt.title, icon: 'warehouse' },
      { to: '/product-picking', label: messages.productPicking.title, icon: 'inventory' },
      { to: '/packing-repack', label: messages.packingRepack.title, icon: 'inventory_2' },
    ],
  },
];

/** 모든 작업 화면. 주소로 찾는다. */
export const homeScreens: HomeScreen[] = homeAreas.flatMap((area) => area.screens);

export const screenOf = (path: string): HomeScreen | undefined =>
  homeScreens.find((screen) => screen.to === path);

export const areaOf = (id: string | undefined): HomeArea | undefined =>
  homeAreas.find((area) => area.id === id);

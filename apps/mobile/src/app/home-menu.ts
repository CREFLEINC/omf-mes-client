import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

type TerminalWorkCountKey = keyof components['schemas']['TerminalWorkCounts'];

const t = messages.shellHome;

export interface HomeScreen {
  to: string;
  label: string;
  /** Material Symbols 이름. 글자를 다 읽기 전에 모양으로 먼저 찾는다. */
  icon: string;
  /** 무엇을 하는 화면인지 한 줄. 업무 화면의 행에 이름 아래로 선다. */
  description: string;
  /** 남은 작업 수의 키(`/app/terminal-work-counts`, 피처 002). 인계 작업 화면만 갖는다. */
  countKey?: TerminalWorkCountKey;
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
 * 작업 목록을 자재가 흐르는 차례대로 업무로 묶는다(생산 현장은 감춤 — 아래 `hiddenScreens`).
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
      {
        to: '/inbound-receipt',
        label: messages.inboundReceipt.title,
        icon: 'local_shipping',
        description: t.screens.inboundReceipt,
      },
      /* M-01-03 입하 마감(005) — 입하 등록 다음(screens/M-01-03.md). */
      {
        to: '/inbound-close',
        label: messages.inboundClose.title,
        icon: 'inventory',
        description: t.screens.inboundClose,
      },
    ],
  },
  {
    id: 'warehouse',
    label: t.areas.warehouse.label,
    summary: t.areas.warehouse.summary,
    icon: 'warehouse',
    screens: [
      {
        to: '/putaway',
        countKey: 'putaway',
        label: messages.putaway.title,
        icon: 'shelves',
        description: t.screens.putaway,
      },
      {
        to: '/temporary-putaway',
        label: messages.temporaryPutaway.title,
        icon: 'move_to_inbox',
        description: t.screens.temporaryPutaway,
      },
      /* M-01-14 적치 기록(011) — 임시 위치 적재 다음. 남은 일이 아니라 지난 기록이라 배지를 두지 않는다. */
      {
        to: '/putaway-history',
        label: messages.putawayHistory.title,
        icon: 'history',
        description: t.screens.putawayHistory,
      },
      {
        to: '/stock-transfer',
        countKey: 'stockTransferArrival',
        label: messages.stockTransfer.title,
        icon: 'swap_horiz',
        description: t.screens.stockTransfer,
      },
      {
        to: '/material-picking',
        countKey: 'materialPicking',
        label: messages.materialPicking.title,
        icon: 'outbox',
        description: t.screens.materialPicking,
      },
      {
        to: '/physical-count',
        label: messages.physicalCount.title,
        icon: 'fact_check',
        description: t.screens.physicalCount,
      },
      {
        to: '/material-location',
        label: messages.materialLocation.title,
        icon: 'pin_drop',
        description: t.screens.materialLocation,
      },
    ],
  },
  {
    id: 'shipping',
    label: t.areas.shipping.label,
    summary: t.areas.shipping.summary,
    icon: 'inventory_2',
    screens: [
      {
        to: '/product-receipt',
        label: messages.productReceipt.title,
        icon: 'warehouse',
        description: t.screens.productReceipt,
      },
      {
        to: '/product-picking',
        countKey: 'shipmentPicking',
        label: messages.productPicking.title,
        icon: 'inventory',
        description: t.screens.productPicking,
      },
      /* M-04-05 LOT 분리 확인(피처 013) — POP 에서 나눈 두 라벨을 스캔해 확인한다. 남은 작업 수는 두지 않는다. */
      {
        to: '/product-lot-split-confirm',
        label: messages.productLotSplitConfirm.title,
        icon: 'call_split',
        description: t.screens.productLotSplitConfirm,
      },
    ],
  },
];

/**
 * 라우트는 남기되 업무 목록에서 **감춘** 작업 화면(피처 010 · omf-all-around#305).
 *
 * 출하는 PDA 피킹(LOT 통째) → OQC → POP 출하 완료로 끝나 포장·재포장을 쓰지 않는다. 화면을 지우지
 * 않는 이유는 배포 전 진행분이다 — 주소로는 열리고, 열리면 사번 확인은 다른 작업 화면과 같다
 * (`isWorkScreen`). 「자주 쓰는 작업」에는 서지 않는다(`screenOf` 는 목록만 찾는다).
 */
export const hiddenScreens: HomeScreen[] = [
  {
    to: '/packing-repack',
    label: messages.packingRepack.title,
    icon: 'inventory_2',
    description: t.screens.packingRepack,
  },
  /*
   * 아직 현장에서 쓰지 않는 작업 — 입하 오류 등록 · 재생재 등록 · 긴급 IQC 생략 요청과 생산 현장 업무 전체
   * (사용자 지시 2026-11-20 「숨김 처리해서 사용자가 접근 못하게」). 다시 열 때는 위 목록으로 옮긴다.
   */
  {
    to: '/inbound-variance',
    label: messages.inboundVariance.title,
    icon: 'report',
    description: t.screens.inboundVariance,
  },
  {
    to: '/recycle-entry',
    label: messages.recycleEntry.title,
    icon: 'recycling',
    description: t.screens.recycleEntry,
  },
  {
    to: '/iqc-skip-request',
    label: messages.iqcSkipRequest.title,
    icon: 'bolt',
    description: t.screens.iqcSkipRequest,
  },
  {
    to: '/shopfloor-receipt',
    label: messages.shopfloorReceipt.title,
    icon: 'factory',
    description: t.screens.shopfloorReceipt,
  },
  {
    to: '/wip-handover',
    label: messages.wipHandover.title,
    icon: 'sync_alt',
    description: t.screens.wipHandover,
  },
  {
    to: '/repair-roundtrip',
    label: messages.repairRoundtrip.title,
    icon: 'build',
    description: t.screens.repairRoundtrip,
  },
  {
    to: '/equipment-inspection',
    label: messages.equipmentInspection.title,
    icon: 'checklist',
    description: t.screens.equipmentInspection,
  },
  {
    to: '/equipment-failure',
    label: messages.equipmentFailureReport.title,
    icon: 'warning',
    description: t.screens.equipmentFailure,
  },
];

/** 모든 작업 화면. 주소로 찾는다. */
export const homeScreens: HomeScreen[] = homeAreas.flatMap((area) => area.screens);

export const screenOf = (path: string): HomeScreen | undefined =>
  homeScreens.find((screen) => screen.to === path);

/** 사번이 있어야 하는 작업 화면인가 — 목록의 화면과 감춘 화면 둘 다. */
export const isWorkScreen = (path: string): boolean =>
  screenOf(path) !== undefined || hiddenScreens.some((screen) => screen.to === path);

export const areaOf = (id: string | undefined): HomeArea | undefined =>
  homeAreas.find((area) => area.id === id);

/** 작업 화면이 걸린 업무. 작업 화면에서 그 업무의 작업 목록으로 돌아갈 때 쓴다. */
export const areaOfScreen = (path: string): HomeArea | undefined =>
  homeAreas.find((area) => area.screens.some((screen) => screen.to === path));

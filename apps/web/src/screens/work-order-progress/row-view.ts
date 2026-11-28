import { messages } from '@omf-mes/i18n';

import { type DelayState, resolveDelay } from './delay';
import type { WorkOrder } from './types';
import { formatPlantDateTime } from '../../patterns/plant-time';

/**
 * 목록 한 줄에 그릴 값.
 *
 * ⭐ **여기서 「없음」과 「0」을 가른다.** 계약의 수량 필드는 대부분 선택이라 안 올 수 있는데,
 * 안 온 것을 `0`으로 그리면 **「만든 적 없음」과 「0개 만듦」이 같은 화면**이 된다. 앞은
 * 「아직 모른다」이고 뒤는 「셌더니 0이다」라 뜻이 다르다.
 *
 * ⚠ **수량을 다섯 그대로 옮긴다.** 정본이 「양품/불량/손실」 셋으로 접으라 했지만 계약은
 * 다섯 칸이고 접는 규칙이 아직 없다(omf-mes#60) — 특히 **보류가 셋 어디에도 들어가지
 * 않는다.** 지어내 접으면 합계가 조용히 어긋나므로 받은 대로 둔다.
 */
export interface WorkOrderRow {
  workOrderId: number;
  workOrderNo: string;
  itemIdText: string;
  /** 라인 번호. 라인이 정해지지 않은 지시는 `null` — 이름은 화면이 라인 이름표로 푼다. */
  productionLineIdText: string | null;
  /** 공정명. 응답이 싣지 않았으면 「—」. */
  processText: string;
  orderQtyText: string;
  goodQtyText: string;
  defectQtyText: string;
  holdQtyText: string;
  scrapQtyText: string;
  reworkQtyText: string;
  /**
   * 값이 든 수량인가 — 보류 · 스크랩 · 재작업 열은 **이 쪽의 어느 줄에든 값이 있을 때만** 연다.
   * 「없음」과 「0」은 둘 다 열 까닭이 못 된다.
   */
  hasHoldQty: boolean;
  hasScrapQty: boolean;
  hasReworkQty: boolean;
  /** ⛔ 서버가 계산한 값이다 — 화면이 다시 나누지 않는다(L-2). */
  achievementRateText: string;
  /** 막대로 그릴 달성률(0~100). 받지 못했으면 `null` — 막대를 그리지 않는다. 100 을 넘으면 100 에서 멈춘다. */
  achievementPercent: number | null;
  statusCode: string;
  /** 일정 보기가 쓰는 계획 시작 · 종료의 원문. */
  plannedStartAt: string | undefined;
  plannedEndAt: string | undefined;
  plannedStartAtText: string;
  plannedEndAtText: string;
  /** 배포됐는가 — 일정 보기가 배포 전 막대를 달리 그린다. */
  isReleased: boolean;
  /** 완료했거나 마감했는가. */
  isFinished: boolean;
  delay: DelayState;
}

const t = messages.workOrderProgress.list;

const QTY_FORMAT = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });
const RATE_FORMAT = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/** 안 온 값은 「—」다. **0으로 떨어뜨리지 않는다.** */
const qtyText = (value: number | undefined): string =>
  value === undefined ? t.blank : QTY_FORMAT.format(value);

/**
 * 달성률.
 *
 * ⛔ **화면이 다시 계산하지 않는다**(L-2) — 서버가 준 값을 모양만 바꾼다. 지시 0인 W/O 의
 * 달성률을 화면마다 `0%`·`—`로 다르게 내면 같은 데이터가 다르게 읽힌다.
 */
const rateText = (value: number | undefined): string =>
  value === undefined || !Number.isFinite(value) ? t.blank : RATE_FORMAT.format(value);

const ratePercent = (value: number | undefined): number | null =>
  value === undefined || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, value * 100));

const hasQty = (value: number | undefined): boolean => value !== undefined && value !== 0;

const nameText = (value: string | undefined): string =>
  value === undefined || value.trim() === '' ? t.blank : value;

/** 계약이 주는 시각 문자열에서 사람이 읽는 부분만 꺼낸다. 못 읽으면 받은 대로 보인다. */
const dateTimeText = (value: string | undefined): string => {
  if (value === undefined || value === '') return t.blank;

  return formatPlantDateTime(value) ?? value;
};

/**
 * @param basisAt 화면이 보이고 있는 기준 시각. 지연 판정이 이것을 기준으로 돈다.
 */
export const toWorkOrderRow = (workOrder: WorkOrder, basisAt: Date): WorkOrderRow => {
  const progress = workOrder.progress;

  return {
    workOrderId: workOrder.workOrderId,
    workOrderNo: workOrder.workOrderNo,
    itemIdText: String(workOrder.itemId),
    productionLineIdText:
      workOrder.productionLineId === undefined ? null : String(workOrder.productionLineId),
    /* 공정 마스터의 이름이 먼저, 없으면 Routing 공정 이름. */
    processText: nameText(workOrder.processName ?? workOrder.routingOperationName),
    orderQtyText: qtyText(workOrder.orderQty),
    goodQtyText: qtyText(progress?.goodQty),
    defectQtyText: qtyText(progress?.defectQty),
    holdQtyText: qtyText(progress?.holdQty),
    scrapQtyText: qtyText(progress?.scrapQty),
    reworkQtyText: qtyText(progress?.reworkQty),
    hasHoldQty: hasQty(progress?.holdQty),
    hasScrapQty: hasQty(progress?.scrapQty),
    hasReworkQty: hasQty(progress?.reworkQty),
    achievementRateText: rateText(progress?.achievementRate),
    achievementPercent: ratePercent(progress?.achievementRate),
    statusCode: workOrder.statusCode,
    plannedStartAt: workOrder.plannedStartAt,
    plannedEndAt: workOrder.plannedEndAt,
    plannedStartAtText: dateTimeText(workOrder.plannedStartAt),
    plannedEndAtText: dateTimeText(workOrder.plannedEndAt),
    isReleased: workOrder.releasedAt !== undefined,
    isFinished: workOrder.completedAt !== undefined || workOrder.closedAt !== undefined,
    delay: resolveDelay(workOrder, basisAt),
  };
};

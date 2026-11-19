import { messages } from '@omf-mes/i18n';

import { usePopWorkOrder } from '../../patterns/pop-process-gate';
import { PuBand, type PuBandItem } from '../../patterns/pop-uniform';
import type { CurrentLotView } from './queries';

const t = messages.runningChange;

export interface WorkOrderBandProps {
  workOrderId: number;
  /** 이 W/O 의 공정 이름(판정에 쓰는 것과 같은 값). 모르면 `null`. */
  processName: string | null;
  lot: CurrentLotView | null;
}

/**
 * 본문 맨 위 작업지시 띠(POP 통일 시안 #295) — 「작업지시 (W/O) · 번호 · 공정 · 제품 · 현재 생산 LOT · 진행」.
 * 따로 있던 《현재 생산LOT》 구획을 이 띠로 옮겼다. **읽기 전용이고 교체 등록 본문에 담기지 않는다.**
 *
 * ⛔ **화면이 「지금 어느 LOT 인가」를 고르지 않는다.** 넘겨 주는 화면이 주소에 실어 준 것만 믿는다(스펙 §3).
 * ⚠ 진척을 못 받았으면 양품을 0 으로 적지 않는다 — 「목표 N · 진행 확인 불가」로 말한다.
 * ⭐ W/O 상세는 공정 판정과 같은 조회를 함께 쓴다(`usePopWorkOrder`) — 새로 읽지 않는다.
 */
export const WorkOrderBand = ({ workOrderId, processName, lot }: WorkOrderBandProps) => {
  const workOrder = usePopWorkOrder(workOrderId).data;
  const dash = '—';
  const items: PuBandItem[] = [
    { label: t.band.process, value: processName ?? workOrder?.processName ?? dash },
    { label: t.band.item, value: workOrder?.itemCode ?? dash },
    { label: t.band.currentLot, value: <span className="pu-mono">{lot?.lotNo ?? dash}</span> },
  ];

  if (lot !== null) {
    items.push({
      label: t.band.progress,
      value:
        lot.goodQty === null
          ? t.currentLot.progressUnknown(lot.targetQty)
          : t.band.progressValue(lot.goodQty, lot.targetQty),
    });
  }

  return (
    <PuBand
      title={t.band.title}
      label={t.band.title}
      no={workOrder?.workOrderNo ?? dash}
      items={items}
    />
  );
};

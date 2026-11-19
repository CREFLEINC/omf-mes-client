import { messages } from '@omf-mes/i18n';

import { PuEmpty, PuKv, PuNote, PuSection } from '../../patterns/pop-uniform';
import { dateTimeText, hasNoAssignment, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

export interface DetailPaneProps {
  workOrder: WorkOrder | null;
  uomLabel: (uomId: number | undefined) => string;
}

/**
 * 《작업지시 상세》(POP 통일 시안 #295) — 작업지시 · 품목 · 수량 · 발행, 가는 선 아래 「점검 통제 우회」 주의 줄.
 *
 * ⭐ 고른 작업지시 번호는 상세 첫 줄 「작업지시」로 선다. [자재 투입]·[실적 입력]은 아래 작업 줄이 갖는다.
 * ⛔ 자재 부족 안내는 상주하지 않는다 — 이 화면은 부족을 감지하지 못한다(§5-4).
 */
export const DetailPane = ({ workOrder, uomLabel }: DetailPaneProps) => {
  const t = messages.emergencyWorkOrderField.detail;

  return (
    <PuSection title={t.title}>
      {workOrder === null ? (
        <PuEmpty icon="list" title={t.notSelected} />
      ) : (
        <>
          <PuKv
            items={[
              {
                label: t.workOrder,
                value: <b className="pu-mono">{workOrder.workOrderNo}</b>,
              },
              { label: t.item, value: <span className="pu-mono">{itemText(workOrder)}</span> },
              {
                label: t.orderQty,
                value: `${qtyText(workOrder.orderQty)} ${uomLabel(workOrder.uomId)}`,
              },
              { label: t.releasedAt, value: dateTimeText(workOrder.releasedAt) },
            ]}
          />
          {/* 「지시가 무엇인가」와 「어떻게 진행되는가」의 경계(스펙 도면의 선). */}
          <hr className="pu-sep" />
          {/* 배정이 하나라도 있으면 「배정 없음」을 세우지 않는다 — 통제 우회 사실은 늘 알린다. */}
          <PuNote tone="warn">
            <b>{hasNoAssignment(workOrder) ? t.bypassTitle : t.bypassTitleAssigned}</b>
            <br />
            {t.bypassBody}
          </PuNote>
        </>
      )}
    </PuSection>
  );
};

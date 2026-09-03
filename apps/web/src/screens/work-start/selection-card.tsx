import { AlertBanner, Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { idText, isOtherEquipment, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

const t = messages.workStart.selection;

export interface SelectionCardProps {
  workOrder: WorkOrder | null;
  /** 이 단말이 붙어 있는 설비. 계획 설비와 견주는 기준이다. */
  equipmentId: number | null;
  equipmentCode: string | null;
}

/**
 * ③ 선택 확인 구획(스펙 §4 ③ · 160px).
 *
 * ⛔ **접지 않는다**(E-4). 작업 전 점검 통제 결과가 여기 나오므로, 접히면 못 본다.
 *
 * ⭐ **점검 통제는 이 화면이 판정하지 않는다**(§5-2 · F-5). 판정하고 막는 것은 「작업 전 점검
 * 이력 확인·통제」 화면이고 이 자리는 **그 결과를 받아 보이는 자리**다. 그 화면이 아직 서지
 * 않았으므로 지금은 「시작할 때 확인합니다」라고 말한다 — ⛔ 「합격」으로 그리지 않는다.
 * 모르는 것을 아는 것처럼 그리면 점검을 안 지난 작업이 지난 것으로 보인다.
 *
 * ⚠ **계획 설비가 다른 지시는 막지 않는다**(§6 · §8 미결 5) — 현장이 설비를 바꿔 돌릴 수
 * 있고, 실제 설비는 세션에 기록돼 사후 추적된다. 경고만 한다.
 */
export const SelectionCard = ({ workOrder, equipmentId, equipmentCode }: SelectionCardProps) => (
  <section className="pane work-start-selection" aria-label={t.title}>
    <h2 className="pane-title">{t.title}</h2>

    {workOrder === null ? (
      <p className="field-note">{t.notSelected}</p>
    ) : (
      <Card bordered surface="low">
        <Card.Body>
          <p>
            {workOrder.workOrderNo} · {itemText(workOrder)} · {qtyText(workOrder.orderQty)}
          </p>
          <p className="field-note">
            {`${t.equipment} ${equipmentCode ?? t.unknown} · ${t.mold} ${idText(
              workOrder.plannedMoldId,
            )}`}
          </p>

          {isOtherEquipment(workOrder, equipmentId) && (
            <div className="banner-slot">
              <AlertBanner variant="warning">
                {t.otherEquipment(idText(workOrder.plannedEquipmentId))}
              </AlertBanner>
            </div>
          )}

          <div className="banner-slot">
            <AlertBanner variant="info">{t.precheckPending}</AlertBanner>
          </div>
        </Card.Body>
      </Card>
    )}
  </section>
);

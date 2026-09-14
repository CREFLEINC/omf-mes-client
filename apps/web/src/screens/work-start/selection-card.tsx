import { AlertBanner, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { idText, isOtherEquipment, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';
import { isEmergency } from './work-order-type';

const t = messages.workStart.selection;

export interface SelectionCardProps {
  workOrder: WorkOrder | null;
  /** 이 단말이 붙어 있는 설비. 계획 설비와 견주는 기준이다. */
  equipmentId: number | null;
  equipmentCode: string | null;
  /** 단위 번호를 코드로 옮긴다. 못 옮기면 `null` — 수량만 낸다. */
  uomCodeOf: (uomId: number | undefined) => string | null;
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
export const SelectionCard = ({
  workOrder,
  equipmentId,
  equipmentCode,
  uomCodeOf,
}: SelectionCardProps) => (
  /*
   * ⭐ **제 내용만큼 선다**(`pop-fixed`) — 남는 높이는 위 목록이 가져간다. 몫을 나눠 받으면
   * 내용이 두 줄뿐일 때도 자리를 차지하고, 내용이 늘면 «받은 몫 안에서» 잘려 스크롤이 생겼다
   * (실측 19px). 접지 않는다는 규칙(E-4)은 「잘리지 않는다」는 뜻이다.
   */
  <section className="pane work-start-selection pop-fixed" aria-label={t.title}>
    <h2 className="pane-title">{t.title}</h2>

    {workOrder === null ? (
      <p className="field-note">{t.notSelected}</p>
    ) : (
      <Card bordered surface="low">
        <Card.Body>
          <p>
            {/*
             * 목록에서 본 긴급 표식을 고른 뒤에도 남긴다(스펙 §5-3 · #1147) — 확인하는 자리에서
             * 사라지면 긴급 지시를 고른 것인지 다시 목록을 봐야 한다.
             */}
            {isEmergency(workOrder) && (
              <>
                <Chip status="error" size="md">
                  {messages.workStart.list.emergencyBadge}
                </Chip>{' '}
              </>
            )}
            {workOrder.workOrderNo} · {itemText(workOrder)} ·{' '}
            {qtyText(workOrder.orderQty, uomCodeOf(workOrder.uomId))}
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

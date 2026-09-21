import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.workOrder.validationPane;

export interface WorkOrderValidationCheckScope {
  /** 이 W/O 에 배정된 자원. 배정이 없는 자원은 서버가 그 검사를 돌지 않는다. */
  hasEquipment: boolean;
  hasMold: boolean;
  hasWorker: boolean;
}

/**
 * 「무엇을 확인했는지」를 항목·결과 두 칸으로 보인다(사용자 지시 2026-09-20).
 *
 * ⛔ **검사 결과를 화면이 만들지 않는다.** 이 목록은 지적 사항이 0건일 때만 그려지므로 돈 검사는
 *    모두 이상이 없다. 배정이 없어 «돌지 않은» 검사는 이상 없음이라고 말하지 않고 「대상 없음」으로
 *    구분한다 — 통과와 같은 색을 쓰지 않는다(`idle` 칩). 그 까닭은 구획 제목 옆에서 한 번 말한다.
 */
export const WorkOrderValidationChecks = ({
  hasEquipment,
  hasMold,
  hasWorker,
}: WorkOrderValidationCheckScope) => {
  const rows = [
    { key: 'equipmentStatus', label: t.checks.equipmentStatus, ran: hasEquipment },
    { key: 'equipmentCalibration', label: t.checks.equipmentCalibration, ran: hasEquipment },
    { key: 'equipmentDoubleBooked', label: t.checks.equipmentDoubleBooked, ran: hasEquipment },
    { key: 'moldStatus', label: t.checks.moldStatus, ran: hasMold },
    { key: 'moldLife', label: t.checks.moldLife, ran: hasMold },
    { key: 'workerQualification', label: t.checks.workerQualification, ran: hasWorker },
  ];
  return (
    <div className="work-order-validation-checks">
      <dl className="work-order-validation-checks-list">
        <div className="work-order-validation-checks-row work-order-validation-checks-head">
          <dt>{t.checksTitle}</dt>
          <dd>{t.resultTitle}</dd>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="work-order-validation-checks-row">
            <dt>{row.label}</dt>
            <dd>
              <Chip variant="status" status={row.ran ? 'success' : 'idle'} size="sm">
                {row.ran ? t.checkState.checked : t.checkState.skipped}
              </Chip>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { EffectList } from '../../../patterns/process-page';

const t = messages.erpWorkOrderFlow.process.planConfirm;

export interface PlanConfirmDialogProps {
  /** 확정할 계획 이름(저장 전 새 계획은 「신규 계획 N」) */
  plans: string[];
  /** Routing 공정 이름(전개되는 W/O 하나에 공정 하나) */
  operations: string[];
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * C-9 중간 단계 확정 확인(T-W-C 중간 단계의 확정). 대상, 생기는 것과 수, 반영 사항, 되돌릴 수 없다는 안내.
 * 데이터 구조가 아니라 사용자가 보는 결과로 쓴다(C-13).
 */
export const PlanConfirmDialog = ({
  plans,
  operations,
  running,
  onCancel,
  onConfirm,
}: PlanConfirmDialogProps) => (
  <Dialog
    open
    title={t.title}
    closeOnBackdropClick={false}
    onClose={() => !running && onCancel()}
    footer={
      <>
        <Button variant="outlined" disabled={running} onClick={onCancel}>
          {messages.common.cancel}
        </Button>
        <Button loading={running} onClick={onConfirm}>
          {t.confirm}
        </Button>
      </>
    }
  >
    <div className="bulk-dialog-body">
      <p className="bulk-dialog-target">{t.target(plans.join(', '))}</p>
      <EffectList
        task={t.task}
        items={[
          { key: 'plans', label: t.effects.plans(plans.length) },
          {
            key: 'workOrders',
            label: t.effects.workOrders(plans.length * operations.length, operations.join(', ')),
          },
        ]}
      />
      <AlertBanner variant="info">{t.irreversible}</AlertBanner>
    </div>
  </Dialog>
);

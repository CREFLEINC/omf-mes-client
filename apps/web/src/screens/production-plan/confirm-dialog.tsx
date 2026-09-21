import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.productionPlan.confirmDialog;

interface ProductionPlanConfirmDialogProps {
  planNo: string;
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ProductionPlanConfirmDialog = ({
  planNo,
  banner,
  isSubmitting,
  onClose,
  onConfirm,
}: ProductionPlanConfirmDialogProps) => (
  <Dialog
    open
    /* 설명·주의 문장이 각각 한 줄에 들어가는 폭(사용자 지시 2026-09-21). */
    size="lg"
    /* 제목은 어느 계획인지 하나만 말한다 — 물음 문장은 두지 않는다(사용자 지시 2026-09-21). */
    title={`${t.planLabel} ${planNo}`}
    closeOnBackdropClick={false}
    showCloseButton={false}
    onClose={() => {
      if (!isSubmitting) onClose();
    }}
    footer={
      <>
        <Button variant="outlined" disabled={isSubmitting} onClick={onClose}>
          {t.cancel}
        </Button>
        <Button loading={isSubmitting} disabled={isSubmitting} onClick={onConfirm}>
          {t.confirm}
        </Button>
      </>
    }
  >
    <div className="production-plan-confirm-body">
      {banner}
      <p>{t.effect}</p>
      {/* 오류가 아니라 「누르기 전에 알아 둘 것」이다 — 작은 주의 상자로 둔다. */}
      <AlertBanner
        className="production-plan-confirm-warning"
        variant="warning"
        title={t.irreversible}
      />
    </div>
  </Dialog>
);

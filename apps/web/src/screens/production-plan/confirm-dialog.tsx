import { Button, Dialog } from '@crefle/web-ui';
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
    size="sm"
    title={t.title(planNo)}
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
    {banner}
    <p>{t.effect}</p>
    <p>{t.irreversible}</p>
  </Dialog>
);

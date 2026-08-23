import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

export interface WorkOrderCloseConfirmDialogProps {
  workOrderNo: string;
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const WorkOrderCloseConfirmDialog = ({
  workOrderNo,
  banner,
  isSubmitting,
  onClose,
  onConfirm,
}: WorkOrderCloseConfirmDialogProps) => {
  const t = messages.workOrderClose.confirm;

  return (
    <Dialog
      closeOnBackdropClick={false}
      footer={
        <>
          <Button disabled={isSubmitting} variant="outlined" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button loading={isSubmitting} variant="filled" onClick={onConfirm}>
            {t.confirm}
          </Button>
        </>
      }
      open
      showCloseButton={false}
      title={t.title(workOrderNo)}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      {banner === null || banner === undefined ? null : <div>{banner}</div>}
      <p>{t.target(workOrderNo)}</p>
      <p>{t.irreversible}</p>
      <p>{t.erp}</p>
    </Dialog>
  );
};

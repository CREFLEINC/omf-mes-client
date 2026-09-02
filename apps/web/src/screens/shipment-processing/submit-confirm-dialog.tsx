import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.shipmentProcessing.confirm;

export interface SubmitConfirmDialogProps {
  shipmentRequestNo: string;
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** `work-order-close/close-confirm-dialog.tsx`를 구조 원형으로 삼는다(계획서 결정). */
export const SubmitConfirmDialog = ({
  shipmentRequestNo,
  banner,
  isSubmitting,
  onClose,
  onConfirm,
}: SubmitConfirmDialogProps) => (
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
    title={t.title(shipmentRequestNo)}
    onClose={() => {
      if (!isSubmitting) onClose();
    }}
  >
    {banner === null || banner === undefined ? null : <div>{banner}</div>}
    <p>{t.target(shipmentRequestNo)}</p>
    <p>{t.irreversible}</p>
    <p>{t.unconfirmedNote}</p>
  </Dialog>
);

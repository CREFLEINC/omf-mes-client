import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

export interface ReinstatementSummary {
  lotNo: string;
  qty: number;
  uom: string;
  fromWarehouse: string;
  toWarehouse: string;
  toLocation: string | null;
}

export interface ConfirmDialogProps {
  open: boolean;
  summary: ReinstatementSummary;
  isSaving: boolean;
  error: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog = ({
  open,
  summary,
  isSaving,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) => {
  const t = messages.stockReinstatement;
  const qty = `${String(summary.qty)} ${summary.uom}`.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.confirm.title}
      closeOnBackdropClick={false}
      showCloseButton={false}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {t.actions.keepEditing}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
            {t.actions.submit}
          </Button>
        </>
      }
    >
      {error}
      <p>{t.confirm.lead}</p>
      <dl className="stock-reinstatement-confirm-summary">
        <div>
          <dt>{t.fields.lot}</dt>
          <dd>{summary.lotNo}</dd>
        </div>
        <div>
          <dt>{t.fields.qty}</dt>
          <dd>{qty}</dd>
        </div>
        <div>
          <dt>{t.fields.sourceWarehouse}</dt>
          <dd>{summary.fromWarehouse}</dd>
        </div>
        <div>
          <dt>{t.fields.targetWarehouse}</dt>
          <dd>{summary.toWarehouse}</dd>
        </div>
        {summary.toLocation !== null && (
          <div>
            <dt>{t.fields.targetLocation}</dt>
            <dd>{summary.toLocation}</dd>
          </div>
        )}
      </dl>
      <AlertBanner variant="warning" title={t.warning.title}>
        <p>{t.warning.transition}</p>
        <p>{t.warning.stock(summary.qty)}</p>
        <p>{t.warning.noUndo}</p>
      </AlertBanner>
    </Dialog>
  );
};

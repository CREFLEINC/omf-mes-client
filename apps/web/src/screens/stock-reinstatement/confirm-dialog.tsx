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
  /** 특채 재등록(#207) — LOT 은 이미 정상이라 상태 전이 줄이 없다. */
  concession: boolean;
  /** LOT 칸 이름 — LOT 종류로 화면이 정한다(#207). */
  lotLabel: string;
  isSaving: boolean;
  error: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog = ({
  open,
  summary,
  concession,
  lotLabel,
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
          <dt>{lotLabel}</dt>
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
      <AlertBanner
        variant="warning"
        title={concession ? t.warning.concessionTitle : t.warning.title}
      >
        {!concession && <p>{t.warning.transition}</p>}
        <p>{concession ? t.warning.concessionStock(summary.qty) : t.warning.stock(summary.qty)}</p>
        <p>{t.warning.noUndo}</p>
      </AlertBanner>
    </Dialog>
  );
};

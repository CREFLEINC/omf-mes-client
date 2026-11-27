import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { InfoFacts } from '../../patterns/info-facts';

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

/** 확인 팝업 시안(#360) — 사실 상자 · 질문 · 안내 줄(종전 경고 배너의 문장을 그대로 옮겼다). */
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
      <div className="users-roles-worker-dialog">
        <InfoFacts
          rows={[
            [{ label: lotLabel, value: summary.lotNo, isKey: true }],
            [
              { label: t.fields.qty, value: qty },
              { label: t.fields.sourceWarehouse, value: summary.fromWarehouse },
              { label: t.fields.targetWarehouse, value: summary.toWarehouse },
              ...(summary.toLocation !== null
                ? [{ label: t.fields.targetLocation, value: summary.toLocation }]
                : []),
            ],
          ]}
        />
        <p>{t.confirm.question}</p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
          {t.confirm.lead}
        </p>
        <ul>
          {!concession && <li>{t.warning.transition}</li>}
          <li>
            {concession ? t.warning.concessionStock(summary.qty) : t.warning.stock(summary.qty)}
          </li>
        </ul>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {concession ? t.warning.concessionTitle : t.warning.title}
        </p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {t.warning.noUndo}
        </p>
      </div>
    </Dialog>
  );
};

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
  /** LOT 칸 이름 — LOT 종류로 화면이 정한다(#207). */
  lotLabel: string;
  isSaving: boolean;
  error: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/** 확인 팝업 시안(#360) — 사실 상자 · 질문 · 되돌릴 수 없다는 한 줄. */
export const ConfirmDialog = ({
  open,
  summary,
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
        {/*
         * 사용자 개선안(#360) — 1행 LOT(넓게) · 수량, 2행 현재 창고, 3행 재등록 위치(창고 · 위치 한 묶음).
         * 제목이 묻는 말이라 본문 질문은 두지 않는다. 재등록 뒤 상태를 먼저 말하고, 되돌릴 수 없다는 경고는 노란 안내.
         */}
        <InfoFacts
          rows={[
            [
              { label: lotLabel, value: summary.lotNo, isKey: true },
              { label: t.fields.qty, value: qty },
            ],
            [{ label: t.fields.sourceWarehouse, value: summary.fromWarehouse }],
            [
              {
                label: t.confirm.targetPlace,
                value: (
                  <span className="info-fact-lines">
                    <span className="info-fact-line">{summary.toWarehouse}</span>
                    {summary.toLocation !== null && (
                      <span className="info-fact-line">{summary.toLocation}</span>
                    )}
                  </span>
                ),
              },
            ],
          ]}
        />
        <p>{t.confirm.after}</p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {t.confirm.irreversible}
        </p>
      </div>
    </Dialog>
  );
};

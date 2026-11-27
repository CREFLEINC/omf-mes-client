import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { InfoFacts } from '../../patterns/info-facts';

const t = messages.shipmentProcessing.confirm;
const fields = messages.shipmentProcessing.list.fields;

export interface SubmitConfirmDialogProps {
  shipmentRequestNo: string;
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * `work-order-close/close-confirm-dialog.tsx`를 구조 원형으로 삼는다(계획서 결정).
 * 확인 팝업 시안(#360) — 대상 상자 · 질문 · 안내 줄.
 */
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
    title={t.title}
    onClose={() => {
      if (!isSubmitting) onClose();
    }}
  >
    {banner === null || banner === undefined ? null : <div>{banner}</div>}
    <div className="users-roles-worker-dialog">
      <InfoFacts
        rows={[[{ label: fields.shipmentRequestNo, value: shipmentRequestNo, isKey: true }]]}
      />
      <p>{t.question}</p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
        <Icon name="warning" size={16} aria-hidden />
        {t.irreversible}
      </p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
        <Icon name="info" size={16} aria-hidden />
        {t.unconfirmedNote}
      </p>
    </div>
  </Dialog>
);

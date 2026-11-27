import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { InfoFacts } from '../../patterns/info-facts';

const t = messages.shipmentConfirm.executeDialog;
const what = messages.shipmentConfirm.cancelDialog;

export interface ExecuteCancelDialogProps {
  shipmentNo: string;
  /** 실행되면 일어나는 것 — 취소 요청 창과 같은 목록(POP 완료 출하만). */
  consequences: { qty: number | null; warehouses: string; shipmentRequestNo: string | null } | null;
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * 승인된 출하 취소의 실행 확인 창(Q13 · FR-023). 되돌릴 수 없어 이 창이 마지막 문이다.
 * 확인 팝업 시안(#360) — 대상 상자 · 질문 · 실행되면 일어나는 것 · 경고 줄.
 * ⛔ 진행 중에는 닫히지 않는다 — 닫고 다시 누르면 안 끝난 실행 위에 또 보낸다.
 */
export const ExecuteCancelDialog = ({
  shipmentNo,
  consequences,
  banner,
  isSubmitting,
  onClose,
  onSubmit,
}: ExecuteCancelDialogProps) => (
  <Dialog
    closeOnBackdropClick={false}
    footer={
      <>
        <Button disabled={isSubmitting} variant="outlined" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button loading={isSubmitting} variant="filled" onClick={onSubmit}>
          {t.submit}
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
    {banner}
    <div className="users-roles-worker-dialog">
      <InfoFacts rows={[[{ label: what.shipmentNo, value: shipmentNo, isKey: true }]]} />
      <p>{t.question}</p>
      {consequences !== null && (
        <section aria-label={what.whatTitle}>
          <h3 className="field-label">{what.whatTitle}</h3>
          <ul>
            {consequences.qty !== null && (
              <li>{what.what.stock(consequences.qty, consequences.warehouses)}</li>
            )}
            <li>{what.what.documents}</li>
            <li>{what.what.salesOrder}</li>
            {consequences.shipmentRequestNo !== null && (
              <li>{what.what.request(consequences.shipmentRequestNo)}</li>
            )}
          </ul>
        </section>
      )}
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
        <Icon name="warning" size={16} aria-hidden />
        {t.irreversible}
      </p>
    </div>
  </Dialog>
);

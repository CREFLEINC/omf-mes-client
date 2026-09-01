import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.expeditedShipment.confirm;

export interface SubmitConfirmDialogProps {
  lotNo: string;
  shipmentRequestNo: string;
  qty: string;
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 확정 확인 창 — **되돌리기가 없으므로 이 창이 마지막 문이다**(§5-7 · §6).
 *
 * ⛔ **진행 중에는 닫히지 않는다.** 배경 클릭·닫기 버튼을 막고 취소도 잠근다 — 창을 닫아 놓고
 * 다시 누르면 **새 멱등 키가 나가 전표가 두 벌 생긴다**(§5-6). 진행 표시는 확정 버튼이 든다.
 */
export const SubmitConfirmDialog = ({
  lotNo,
  shipmentRequestNo,
  qty,
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
    <p>{t.target(lotNo, shipmentRequestNo)}</p>
    <p>{t.qty(qty)}</p>
    <p>{t.irreversible}</p>
    <p>{t.unconfirmedNote}</p>
  </Dialog>
);

import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ShipmentRow } from './types';

const t = messages.shipmentConfirm.confirmDialog;

export interface ConfirmDialogProps {
  rows: readonly ShipmentRow[];
  isRunning: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 확정 확인 창 — **되돌리기가 없으므로 이 창이 마지막 문이다**(§5-3).
 *
 * ⭐ **무엇을 확정하는지 이름으로 늘어놓는다.** 「2건」만 보이면 무엇을 고른 줄 모른 채 누른다 —
 * 다건이고 되돌릴 수 없다.
 *
 * ⛔ 진행 중에는 닫히지 않는다. 창을 닫고 다시 누르면 **아직 안 끝난 확정 위에 또 보낸다.**
 */
export const ConfirmDialog = ({ rows, isRunning, onClose, onConfirm }: ConfirmDialogProps) => (
  <Dialog
    closeOnBackdropClick={false}
    footer={
      <>
        <Button disabled={isRunning} variant="outlined" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button loading={isRunning} variant="filled" onClick={onConfirm}>
          {t.confirm}
        </Button>
      </>
    }
    open
    showCloseButton={false}
    title={t.title}
    onClose={() => {
      if (!isRunning) onClose();
    }}
  >
    <p>{t.target(rows.length)}</p>
    <div className="dialog-scroll">
      <h3 className="field-label">{t.list}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.shipmentId}>{row.shipmentNo}</li>
        ))}
      </ul>
    </div>
    <p>{t.irreversible}</p>
    <p>{t.erpQueued}</p>
  </Dialog>
);

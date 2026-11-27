import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { InfoFacts } from '../../patterns/info-facts';

import type { ShipmentRow } from './shipment-types';

const t = messages.shipmentConfirm.confirmDialog;
const shipmentNoLabel = messages.shipmentConfirm.cancelDialog.shipmentNo;

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
 * 확인 팝업 시안(#360) — 한 건이면 대상 상자, 여러 건이면 번호 목록. 그 아래 질문 · 안내 줄.
 *
 * ⛔ 진행 중에는 닫히지 않는다. 창을 닫고 다시 누르면 **아직 안 끝난 확정 위에 또 보낸다.**
 */
export const ConfirmDialog = ({ rows, isRunning, onClose, onConfirm }: ConfirmDialogProps) => {
  const single = rows.length === 1 ? rows[0] : undefined;

  return (
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
      <div className="users-roles-worker-dialog">
        {single !== undefined ? (
          <InfoFacts rows={[[{ label: shipmentNoLabel, value: single.shipmentNo, isKey: true }]]} />
        ) : (
          <div className="dialog-scroll">
            <h3 className="field-label">{t.list}</h3>
            <ul>
              {rows.map((row) => (
                <li key={row.shipmentId}>{row.shipmentNo}</li>
              ))}
            </ul>
          </div>
        )}
        <p>{t.question(rows.length)}</p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {t.irreversible}
        </p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
          {t.erpQueued}
        </p>
      </div>
    </Dialog>
  );
};

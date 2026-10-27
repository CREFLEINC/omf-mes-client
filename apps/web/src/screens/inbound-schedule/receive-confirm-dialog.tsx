import { Button, Dialog } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { SaveErrorBanner } from '../../patterns/master';
import { formatQty } from './receipt-status';
import { splitReceiveQty, type ReceivePick } from './receive-entry';

const t = messages.inboundSchedule;

export interface ReceiveConfirmDialogProps {
  purchaseOrderNo: string;
  supplierName: string;
  picks: readonly ReceivePick[];
  isSaving: boolean;
  /** 보낸 뒤 막힌 사유(검증 400 등). 창은 열린 채 배너로 낸다. */
  error: ApiError | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 입하 등록 확인 — **되돌릴 수 없는 쓰기 앞의 마지막 자리**(사용자 결정 2026-10-24 「확인 창 한 번」). 몇 건이 어느 품목으로
 * 얼마나 들어가는지, 초과분이 있는지, 라벨 미부착으로 들어간다는 것을 한 창에서 읽고 누른다.
 * 모양은 옛 입하 등록 창의 확인과 같다(`ors-confirm*`).
 */
export const ReceiveConfirmDialog = ({
  purchaseOrderNo,
  supplierName,
  picks,
  isSaving,
  error,
  onConfirm,
  onClose,
}: ReceiveConfirmDialogProps) => (
  <Dialog
    open
    onClose={isSaving ? () => undefined : onClose}
    size="md"
    closeOnBackdropClick={false}
    /* 닫기(X)는 「돌아가기」와 같은 동작이라 두지 않는다. Esc 로도 닫힌다. */
    showCloseButton={false}
    title={t.receive.confirm.title}
    footer={
      <>
        <Button variant="outlined" autoFocus disabled={isSaving} onClick={onClose}>
          {t.receive.confirm.back}
        </Button>
        <Button loading={isSaving} onClick={onConfirm}>
          {t.receive.confirm.register}
        </Button>
      </>
    }
  >
    <div className="ors-confirm">
      <p className="ors-confirm-target">
        <strong>{purchaseOrderNo}</strong> · {supplierName}
      </p>
      <p className="ors-confirm-lead">{t.receive.confirm.lead(picks.length)}</p>
      <ul className="ors-confirm-lines" aria-label={t.receive.confirm.qty}>
        {picks.map(({ line, qty }) => {
          const { excessQty } = splitReceiveQty(line, qty);

          return (
            <li key={line.purchaseOrderLineId} className="ors-confirm-line">
              <span className="ors-confirm-line-head">
                <span className="ors-confirm-line-no">{line.lineNo}</span>
                <span className="ors-confirm-line-item">{`${line.itemCode} · ${line.itemName}`}</span>
              </span>
              <span className="ors-confirm-line-qty">
                <span>
                  {t.receive.confirm.qty} <strong>{formatQty(qty)}</strong> {line.uomCode}
                </span>
                {excessQty > 0 && (
                  <span className="ors-confirm-excess">
                    {t.receive.confirm.excess(formatQty(excessQty))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="field-note">{t.receive.confirm.labelNote}</p>
      <p className="field-note">{t.receive.confirm.irreversible}</p>
      <SaveErrorBanner error={error} />
    </div>
  </Dialog>
);

import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import type { LotDraft } from './line-draft';
import type { SplitLineView } from './split-calc';
import type { HeaderDraft } from './types';
import type { SplitCounts } from './validation';

const t = messages.overReceiptSplit;

export interface RegisterConfirmDialogProps {
  /** 실릴 줄 수와 그중 초과 몫을 가진 줄 수. */
  counts: SplitCounts;
  purchaseOrderNo: string;
  supplierName: string;
  header: HeaderDraft;
  lotReasonLabel: (code: string) => string;
  /** 수량이 든 줄만. */
  rows: readonly SplitLineView[];
  itemLabelOf: (itemId: number) => string;
  uomLabelOf: (uomId: number) => string;
  onConfirm: () => void;
  onClose: () => void;
}

const formatQty = (value: number): string => value.toLocaleString();

const orEmpty = (value: string): string => (value.trim() === '' ? t.values.empty : value);

/**
 * 등록 확인 — **되돌릴 수 없는 쓰기 앞의 마지막 자리.** 전표 한 건에 어느 줄이 얼마나 실리고, 그중 얼마가
 * P/O 에 들어가며 얼마가 추가 P/O 를 기다리는지, LOT 은 무엇인지 한 창에서 읽고 누른다.
 *
 * 고를 것이 없다 — 전표는 늘 한 건이다(서버 장부 P-100). 초과 몫은 같은 줄에 실리고 나중에 추가 발주에 연결한다.
 */
export const RegisterConfirmDialog = ({
  counts,
  purchaseOrderNo,
  supplierName,
  header,
  lotReasonLabel,
  rows,
  itemLabelOf,
  uomLabelOf,
  onConfirm,
  onClose,
}: RegisterConfirmDialogProps) => {
  const lotText = (lot: LotDraft): string => {
    const lotNo = lot.lotNo.trim();

    return lotNo === ''
      ? t.dialog.lotMissingOf(lotReasonLabel(lot.reasonCode))
      : t.dialog.lotOf(lotNo);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      closeOnBackdropClick={false}
      /* 닫기(X)는 「돌아가기」와 같은 동작이라 두지 않는다. Esc 로도 닫힌다. */
      showCloseButton={false}
      title={t.dialog.registerTitle}
      footer={
        <>
          <Button variant="outlined" autoFocus onClick={onClose}>
            {t.actions.backToEdit}
          </Button>
          <Button onClick={onConfirm}>{t.actions.confirmRegister}</Button>
        </>
      }
    >
      <div className="ors-confirm">
        <p className="ors-confirm-target">
          <strong>{purchaseOrderNo}</strong> · {supplierName}
        </p>
        <p className="ors-confirm-lead">
          {t.dialog.registerLead(counts.lines, counts.excessLines)}
        </p>

        <section className="ors-confirm-group" aria-label={t.dialog.registerGroupLines}>
          <h3 className="ors-confirm-group-title">{t.dialog.registerGroupLines}</h3>
          <ul className="ors-confirm-lines">
            {rows.map((row) => {
              const split = row.split;
              if (split === null) return null;
              const uom = uomLabelOf(row.line.uomId);

              return (
                <li key={row.line.purchaseOrderLineId} className="ors-confirm-line">
                  <span className="ors-confirm-line-head">
                    <span className="ors-confirm-line-no">{row.line.lineNo}</span>
                    <span className="ors-confirm-line-item">{itemLabelOf(row.line.itemId)}</span>
                  </span>
                  <span className="ors-confirm-line-qty">
                    <span>
                      {t.lineTable.arrivedQty} <strong>{formatQty(split.arrivedQty)}</strong> {uom}
                    </span>
                    {split.excessQty > 0 && (
                      <span className="ors-confirm-excess">
                        {t.dialog.excessOf(formatQty(split.normalQty), formatQty(split.excessQty))}
                      </span>
                    )}
                  </span>
                  <span className="ors-confirm-line-lots">
                    <span>{lotText(row.lot)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="ors-confirm-group" aria-label={t.dialog.registerGroupHeader}>
          <h3 className="ors-confirm-group-title">{t.dialog.registerGroupHeader}</h3>
          <dl className="ors-confirm-grid">
            <div>
              <dt>{t.fields.receiptDatetime}</dt>
              <dd>
                {formatPlantDateTime(header.receiptDatetime) ?? orEmpty(header.receiptDatetime)}
              </dd>
            </div>
            <div>
              <dt>{t.fields.deliveryNoteNo}</dt>
              <dd>{orEmpty(header.deliveryNoteNo)}</dd>
            </div>
            <div className="ors-confirm-wide">
              <dt>{t.fields.remarks}</dt>
              <dd>{orEmpty(header.remarks)}</dd>
            </div>
          </dl>
        </section>

        <div className="ors-confirm-warning">
          <p>
            <Icon name="warning" size={18} />
            <strong>{t.dialog.registerIrreversible}</strong>
          </p>
          <p className="ors-confirm-effects">{t.dialog.registerEffects}</p>
        </div>
      </div>
    </Dialog>
  );
};

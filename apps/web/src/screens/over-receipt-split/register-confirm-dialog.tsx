import { Button, Checkbox, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import type { LotDraft, LotPart } from './line-draft';
import type { SplitLineView } from './split-calc';
import type { HeaderDraft, SplitMode } from './types';
import { defaultSelection, modeFor, type SplitCounts } from './validation';

const t = messages.overReceiptSplit;

export interface RegisterConfirmDialogProps {
  /** 실릴 줄 수 — 만들어지는 전표를 여기서 정한다. */
  counts: SplitCounts;
  purchaseOrderNo: string;
  supplierName: string;
  header: HeaderDraft;
  /** 코드 → 이름. 창 안에 코드를 그대로 두지 않는다. */
  exceptionTypeLabel: string;
  lotReasonLabel: (code: string) => string;
  /** 수량이 든 줄만. */
  rows: readonly SplitLineView[];
  itemLabelOf: (itemId: number) => string;
  uomLabelOf: (uomId: number) => string;
  /** 고른 전표로 정해진 갈래를 넘긴다. */
  onConfirm: (mode: SplitMode) => void;
  onClose: () => void;
}

const formatQty = (value: number): string => value.toLocaleString();

const orEmpty = (value: string): string => (value.trim() === '' ? t.values.empty : value);

/**
 * 등록 확인 — **되돌릴 수 없는 쓰기 앞의 마지막 자리.** 무엇이 몇 건 만들어지는지, 어느 줄이 어느
 * 전표에 얼마나 실리는지, LOT 은 무엇인지 한 창에서 읽고 누른다.
 *
 * **만들어지는 전표는 여기서 고른다.** 수량이 있는 전표는 모두 켜진 채로 열리고, 만들지 않을 것만 끈다 —
 * 계약의 세 갈래를 사람이 고르는 대신 「무엇을 만들까」에 답한다. 둘 다 끄면 등록할 수 없다.
 */
export const RegisterConfirmDialog = ({
  counts,
  purchaseOrderNo,
  supplierName,
  header,
  exceptionTypeLabel,
  lotReasonLabel,
  rows,
  itemLabelOf,
  uomLabelOf,
  onConfirm,
  onClose,
}: RegisterConfirmDialogProps) => {
  const [selection, setSelection] = useState(() => defaultSelection(counts));
  const mode = modeFor(selection);
  const hasBoth = counts.normalLines > 0 && counts.excessLines > 0;
  const sendsNormal = selection.normal;
  const sendsExcess = selection.excess;

  const lotText = (part: LotPart, lot: LotDraft): string => {
    const lotNo = lot.lotNo.trim();

    return lotNo === ''
      ? t.dialog.lotMissingOf(part, lotReasonLabel(lot.reasonCode))
      : t.dialog.lotOf(part, lotNo);
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
          <Button
            disabled={mode === null}
            onClick={() => {
              if (mode !== null) onConfirm(mode);
            }}
          >
            {t.actions.confirmRegister}
          </Button>
        </>
      }
    >
      <div className="ors-confirm">
        <p className="ors-confirm-target">
          <strong>{purchaseOrderNo}</strong> · {supplierName}
        </p>
        {mode !== null && <p className="ors-confirm-lead">{t.dialog.registerLead(mode)}</p>}

        <section className="ors-confirm-group" aria-label={t.dialog.registerGroupReceipts}>
          <h3 className="ors-confirm-group-title">{t.dialog.registerGroupReceipts}</h3>
          <ul className="ors-confirm-receipts">
            {counts.normalLines > 0 && (
              <li>
                {hasBoth ? (
                  <Checkbox
                    checked={selection.normal}
                    onChange={(event) => {
                      setSelection((prev) => ({ ...prev, normal: event.target.checked }));
                    }}
                  >
                    {t.dialog.registerReceiptNormal(counts.normalLines)}
                  </Checkbox>
                ) : (
                  <span>{t.dialog.registerReceiptNormal(counts.normalLines)}</span>
                )}
              </li>
            )}
            {counts.excessLines > 0 && (
              <li>
                {hasBoth ? (
                  <Checkbox
                    checked={selection.excess}
                    onChange={(event) => {
                      setSelection((prev) => ({ ...prev, excess: event.target.checked }));
                    }}
                  >
                    {t.dialog.registerReceiptExcess(counts.excessLines)}
                  </Checkbox>
                ) : (
                  <span>{t.dialog.registerReceiptExcess(counts.excessLines)}</span>
                )}
              </li>
            )}
          </ul>
          {hasBoth && <p className="ors-confirm-hint">{t.dialog.registerReceiptHint}</p>}
        </section>

        <section className="ors-confirm-group" aria-label={t.dialog.registerGroupLines}>
          <h3 className="ors-confirm-group-title">{t.dialog.registerGroupLines}</h3>
          <ul className="ors-confirm-lines">
            {rows.map((row) => {
              const split = row.split;
              if (split === null) return null;
              const uom = uomLabelOf(row.line.uomId);
              const showNormal = sendsNormal && split.normalQty > 0;
              const showExcess = sendsExcess && split.excessQty > 0;
              if (!showNormal && !showExcess) return null;

              return (
                <li key={row.line.purchaseOrderLineId} className="ors-confirm-line">
                  <span className="ors-confirm-line-head">
                    <span className="ors-confirm-line-no">{row.line.lineNo}</span>
                    <span className="ors-confirm-line-item">{itemLabelOf(row.line.itemId)}</span>
                  </span>
                  <span className="ors-confirm-line-qty">
                    {showNormal && (
                      <span>
                        {t.lineTable.normal} <strong>{formatQty(split.normalQty)}</strong> {uom}
                      </span>
                    )}
                    {showExcess && (
                      <span className="ors-confirm-excess">
                        {t.lineTable.excess} <strong>{formatQty(split.excessQty)}</strong> {uom}
                      </span>
                    )}
                  </span>
                  <span className="ors-confirm-line-lots">
                    {showNormal && <span>{lotText('normal', row.lot)}</span>}
                    {showExcess && <span>{lotText('excess', row.excessLot)}</span>}
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
            {sendsExcess && (
              <>
                <div>
                  <dt>{t.fields.exceptionType}</dt>
                  <dd>{orEmpty(exceptionTypeLabel)}</dd>
                </div>
                <div>
                  <dt>{t.fields.exceptionReason}</dt>
                  <dd>{orEmpty(header.exceptionReason)}</dd>
                </div>
              </>
            )}
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

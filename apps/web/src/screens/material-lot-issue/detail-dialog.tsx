import { Button, Checkbox, Chip, Dialog, EmptyState } from '@crefle/web-ui';
import type { MaterialLotVoidResult } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { DetailDrawer } from '../../patterns/detail-drawer';
import { SaveErrorBanner } from '../../patterns/master';
import { useItemStorageUnit, type UomOption } from '../../patterns/material-lot-batch';
import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { DefaultsText, storageText } from './defaults-text';
import { useVoidLots } from './mutations';
import { detailLots, formatAt, waitingOf, type Defaults, type Group, type Lot } from './types';

const t = messages.materialLotIssue;
const td = t.detail;

const STATUS_CHIP = { WAITING: 'warning', VOIDED: 'error', ACTIVE: 'success' } as const;

export interface DetailDialogProps {
  group: Group;
  defaults: Defaults | undefined;
  uoms: readonly UomOption[] | undefined;
  onClose: () => void;
  onIssue: () => void;
  onVoided: (result: MaterialLotVoidResult) => void;
}

/**
 * 공급사·품목 상세 창(오른쪽 덮개 · screens/W-01-14.md 「상세 창」) — 대기 자재 관리 LOT 보기 · 폐기 · 발행.
 * ⛔ 라벨 단추는 없다 — 라벨은 POP 에서만 찍는다.
 */
export const DetailDialog = ({
  group,
  defaults,
  uoms,
  onClose,
  onIssue,
  onVoided,
}: DetailDialogProps) => {
  const reasonId = useId();
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const storage = useItemStorageUnit(group.itemId);
  const waiting = waitingOf(group);
  const rows = detailLots(group);
  /* 고른 것 중 아직 대기인 것만 — 다시 불러온 뒤 폐기된 LOT 이 남지 않게. */
  const picked = waiting.filter((lot) => selected.has(lot.lotId));
  const printedCount = picked.filter((lot) => lot.lastLabelIssue !== null).length;

  const voidLots = useVoidLots((result) => {
    setConfirming(false);
    setSelected(new Set());
    onVoided(result);
  });

  const toggle = (lotId: number): void => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  const storageLabel = storageText(storage.data, uoms, group.uomCode);

  const labelCell = (lot: Lot): string =>
    lot.lastLabelIssue === null ? td.unprinted : td.printed(lot.lastLabelIssue.issueSeq);

  return (
    <>
      <DetailDrawer
        title={`${group.itemCode} ${group.itemName}`}
        summary={`${group.supplierName} ${group.supplierCode}`}
        onClose={onClose}
        className="mlot-issue-detail"
      >
        <dl className="mlot-issue-facts">
          <dt>{td.baseUom}</dt>
          <dd>{group.uomCode}</dd>
          <dt>{td.storageUom}</dt>
          <dd>{storageLabel ?? td.storageNone}</dd>
          <dt>{td.defaults}</dt>
          <dd>
            <DefaultsText group={group} defaults={defaults} uoms={uoms} />
          </dd>
        </dl>

        <div className="mlot-issue-section-head">
          <h3>
            {td.waitingTitle} <span className="field-note">{td.waitingCount(waiting.length)}</span>
          </h3>
          <span className="mlot-issue-actions">
            <Button
              variant="outlined"
              disabled={picked.length === 0}
              aria-describedby={reasonId}
              onClick={() => {
                voidLots.reset();
                setConfirming(true);
              }}
            >
              {td.void(picked.length)}
            </Button>
            <Button onClick={onIssue}>{td.issue}</Button>
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState size="sm" title={td.empty} />
        ) : (
          <div className="mlot-issue-table-scroll">
            <table className="mlot-issue-table" aria-label={td.waitingTitle}>
              <thead>
                <tr>
                  <th scope="col" aria-label={td.columns.lotNo} />
                  <th scope="col">{td.columns.lotNo}</th>
                  <th scope="col" className="is-number">
                    {td.columns.qty}
                  </th>
                  <th scope="col">{td.columns.package}</th>
                  <th scope="col">{td.columns.supplierLot}</th>
                  <th scope="col">{td.columns.status}</th>
                  <th scope="col">{td.columns.label}</th>
                  <th scope="col">{td.columns.createdBy}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lot) => {
                  const canPick = lot.lifecycleStatusCode === 'WAITING';
                  return (
                    <tr
                      key={lot.lotId}
                      className={lot.lifecycleStatusCode === 'VOIDED' ? 'is-void' : undefined}
                      aria-selected={selected.has(lot.lotId) ? true : undefined}
                    >
                      <td>
                        {canPick && (
                          <Checkbox
                            aria-label={td.pick(lot.lotNo)}
                            checked={selected.has(lot.lotId)}
                            onChange={() => toggle(lot.lotId)}
                          />
                        )}
                      </td>
                      <td className="mlot-issue-lot-no">{lot.lotNo}</td>
                      <td className="is-number">{formatBaseQty(lot.lotQty, group.uomCode)}</td>
                      <td>{formatPackage(lot.package) ?? '—'}</td>
                      <td>{lot.supplierLotNo ?? '—'}</td>
                      <td>
                        <Chip size="sm" status={STATUS_CHIP[lot.lifecycleStatusCode]}>
                          {td.status[lot.lifecycleStatusCode]}
                        </Chip>
                      </td>
                      <td>{labelCell(lot)}</td>
                      <td className="field-note">
                        {`${td.channel[lot.createdChannelCode]} ${formatAt(lot.createdAt) ?? ''}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p id={reasonId} className="field-note">
          {td.help}
        </p>
        <div className="mlot-issue-detail-foot">
          <Button variant="outlined" onClick={onClose}>
            {td.close}
          </Button>
        </div>
      </DetailDrawer>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.void.title(picked.length)}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setConfirming(false)}>
              {t.void.cancel}
            </Button>
            <Button
              loading={voidLots.isSaving}
              onClick={() => voidLots.write(picked.map((lot) => lot.lotId))}
            >
              {t.void.confirm(picked.length)}
            </Button>
          </>
        }
      >
        <ul className="mlot-issue-void-list">
          {picked.map((lot) => (
            <li key={lot.lotId}>{lot.lotNo}</li>
          ))}
        </ul>
        <p className="dialog-text">{t.void.body}</p>
        {printedCount > 0 && (
          <p className="dialog-text mlot-issue-bad">{t.void.printed(printedCount)}</p>
        )}
        {voidLots.error !== null && <SaveErrorBanner error={voidLots.error} />}
      </Dialog>
    </>
  );
};

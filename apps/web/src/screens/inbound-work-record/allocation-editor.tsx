import { AlertBanner, Button, Chip, Skeleton, TextField, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import type { Candidate, WorkRecordDetail } from './forward-contract';
import { classifyFailure, saveAllocations } from './mutations';
import { useAllocationCandidates, workRecordKeys } from './queries';
import {
  checkAllocations,
  excessOf,
  formatQty,
  lineLabel,
  overLimitText,
  parseQty,
  previousOf,
  shortDate,
  type EditorError,
} from './types';

const t = messages.inboundWorkRecord;
const td = t.detail;
const te = t.editor;

type Banner = { text: string; reload: boolean } | null;

/** 표에 세울 라인 — 최종 마감이면 이 입하 LOT 에 매칭된 라인만, 아니면 후보 전부(screens/W-01-16.md). */
const shownLines = (detail: WorkRecordDetail, candidates: readonly Candidate[]): Candidate[] =>
  detail.statusCode === 'FINALIZED'
    ? candidates.filter((candidate) => candidate.thisLotQty > 0)
    : [...candidates];

/**
 * 상세의 「P/O 매칭」 구획과 [매칭 수정](screens/W-01-16.md 「매칭 수정」). 입하 완료(`RECEIVED`)면 「마감 승인 대기」가
 * 아니어도 고칠 수 있고, 입하 중 · 최종 마감이면 단추가 없다. 「P/O 없음」은 입력이 아니라 입하 수량 − 매칭 합이다.
 */
export const AllocationSection = ({
  detail,
  onEditingChange,
}: {
  detail: WorkRecordDetail;
  onEditingChange: (editing: boolean) => void;
}) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const saveNoteId = useId();
  const receiving = detail.statusCode === 'RECEIVING';
  const candidates = useAllocationCandidates(detail.inboundLotId, !receiving);
  const [values, setValues] = useState<Record<number, string> | null>(null);
  const [serverErrors, setServerErrors] = useState<EditorError[]>([]);
  const [banner, setBanner] = useState<Banner>(null);
  const [saving, setSaving] = useState(false);

  const editable = detail.statusCode === 'RECEIVED';
  const uom = detail.uomCode;

  const setEditing = (next: Record<number, string> | null): void => {
    setValues(next);
    setServerErrors([]);
    setBanner(null);
    onEditingChange(next !== null);
  };

  const reload = (): void => {
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: workRecordKeys.detail(detail.inboundLotId) });
    void queryClient.invalidateQueries({
      queryKey: workRecordKeys.candidates(detail.inboundLotId),
    });
    void queryClient.invalidateQueries({ queryKey: workRecordKeys.lists });
  };

  if (receiving)
    return (
      <section className="iwr-section" aria-label={td.matchTitle}>
        <h3 className="iwr-section-title">{td.matchTitle}</h3>
        <p className="field-note">{td.noMatchYet}</p>
      </section>
    );

  const lines = shownLines(detail, candidates.data ?? []);
  const live = values === null ? null : checkAllocations(lines, values, detail.receivedQty, uom);
  const errors = live === null ? [] : [...live.errors, ...serverErrors];
  const sum = live?.sum ?? lines.reduce((total, candidate) => total + candidate.thisLotQty, 0);
  const unallocated = live?.unallocated ?? detail.unallocatedQty;
  const blocked = (live?.errors.length ?? 0) > 0;

  const save = async (): Promise<void> => {
    if (values === null || blocked) return;
    setSaving(true);
    setBanner(null);
    setServerErrors([]);
    try {
      const saved = await saveAllocations(
        client,
        detail.inboundLotId,
        detail.versionNo,
        lines.map((candidate) => ({
          purchaseOrderLineId: candidate.purchaseOrderLineId,
          qty: parseQty(values[candidate.purchaseOrderLineId] ?? '0'),
        })),
      );
      queryClient.setQueryData(workRecordKeys.detail(detail.inboundLotId), saved);
      void queryClient.invalidateQueries({
        queryKey: workRecordKeys.candidates(detail.inboundLotId),
      });
      void queryClient.invalidateQueries({ queryKey: workRecordKeys.lists });
      toast.show({ variant: 'success', description: te.saved(detail.inboundLotNo) });
      setEditing(null);
    } catch (cause) {
      const failure = classifyFailure(cause);
      if (failure.kind === 'range') {
        const line = lines.find(
          (candidate) => candidate.purchaseOrderLineId === failure.details?.purchaseOrderLineId,
        );
        const received = failure.details?.receivedQty;
        const allocated = failure.details?.allocatedQty;
        if (line === undefined && received !== undefined && allocated !== undefined)
          /* 합계가 입하 수량을 넘음 — 라인 없이 `{receivedQty, allocatedQty}`(G2 L3). */
          setServerErrors([
            {
              purchaseOrderLineId: null,
              text: te.overTotal(
                formatQty(allocated),
                formatQty(received),
                uom,
                formatQty(allocated - received),
              ),
            },
          ]);
        else if (line === undefined) setBanner({ text: te.saveFailed, reload: false });
        else
          setServerErrors([
            {
              purchaseOrderLineId: line.purchaseOrderLineId,
              text: overLimitText(
                line,
                parseQty(values[line.purchaseOrderLineId] ?? '0'),
                failure.details?.maxQty ?? line.maxQty,
                uom,
              ),
            },
          ]);
      } else if (failure.kind === 'conflict') setBanner({ text: t.errors.conflict, reload: true });
      else if (failure.kind === 'stateLocked')
        setBanner({ text: t.errors.stateLocked, reload: true });
      else if (failure.kind === 'finalized') setBanner({ text: te.finalizedLocked, reload: true });
      else setBanner({ text: te.saveFailed, reload: false });
    } finally {
      setSaving(false);
    }
  };

  const badLines = new Set(errors.map((error) => error.purchaseOrderLineId));

  const table = () => {
    if (candidates.isError)
      return <LoadErrorAlert error={candidates.error} onRetry={() => void candidates.refetch()} />;
    if (candidates.isPending) return <Skeleton variant="rect" height="8rem" />;
    return (
      <div className="iwr-table-scroll">
        <table className="iwr-table iwr-match-table" aria-label={td.matchLabel}>
          <thead>
            <tr>
              <th scope="col">{td.matchColumns.line}</th>
              <th scope="col">{td.matchColumns.orderDate}</th>
              <th scope="col" className="is-number">
                {td.matchColumns.ordered}
              </th>
              <th scope="col" className="is-number">
                {td.matchColumns.previous}
              </th>
              <th scope="col" className="is-number">
                {td.matchColumns.thisMatch}
              </th>
              <th scope="col" className="is-number">
                {td.matchColumns.tolerance}
              </th>
              <th scope="col" className="is-number">
                {td.matchColumns.remaining}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((candidate) => {
              const id = candidate.purchaseOrderLineId;
              const qty = values === null ? candidate.thisLotQty : parseQty(values[id] ?? '0');
              const known = Number.isFinite(qty);
              const excess = known ? excessOf(candidate, qty) : 0;
              const remaining = known ? candidate.maxQty - qty : null;
              return (
                <tr key={id} data-invalid={badLines.has(id) ? true : undefined}>
                  <td className="is-wrap">
                    <span className="iwr-code">
                      {td.lineName(candidate.purchaseOrderNo, candidate.lineNo)}
                    </span>
                    {candidate.openedAfterReceiptClose === true && (
                      <span className="field-note iwr-line-note">{td.openedAfterClose}</span>
                    )}
                  </td>
                  <td>{shortDate(candidate.orderDate)}</td>
                  <td className="is-number">{formatQty(candidate.orderedQty)}</td>
                  <td className="is-number">{formatQty(previousOf(candidate))}</td>
                  <td className="is-number">
                    {values === null ? (
                      <>
                        {formatQty(candidate.thisLotQty)}
                        {excess > 0 && (
                          <>
                            {' '}
                            <mark className="iwr-mark is-excess">
                              {td.excessChip(formatQty(excess))}
                            </mark>
                          </>
                        )}
                      </>
                    ) : (
                      <TextField
                        size="sm"
                        className="iwr-qty-input"
                        aria-label={te.qtyLabel(lineLabel(candidate))}
                        inputMode="decimal"
                        aria-invalid={badLines.has(id) ? true : undefined}
                        value={values[id] ?? ''}
                        disabled={saving}
                        onChange={(event) => {
                          setServerErrors([]);
                          setValues({ ...values, [id]: event.target.value });
                        }}
                      />
                    )}
                  </td>
                  <td className="is-number">+{formatQty(candidate.toleranceQty)}</td>
                  <td
                    className="is-number"
                    data-invalid={remaining !== null && remaining < 0 ? true : undefined}
                  >
                    {remaining === null ? '—' : formatQty(remaining)}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td>
                <mark className="iwr-mark is-unallocated">{td.unallocatedRow}</mark>
              </td>
              <td colSpan={3} />
              <td className="is-number">
                {unallocated > 0 ? (
                  <mark className="iwr-mark is-unallocated">{formatQty(unallocated)}</mark>
                ) : (
                  formatQty(Math.max(0, unallocated))
                )}
              </td>
              <td colSpan={2} />
            </tr>
            <tr className="iwr-total-row">
              <td>{td.totalLabel}</td>
              <td colSpan={3} />
              <td className="is-number">
                {td.total(
                  formatQty(sum + Math.max(0, unallocated)),
                  formatQty(detail.receivedQty),
                  uom,
                )}
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="iwr-section" aria-label={td.matchTitle}>
      <div className="iwr-section-head">
        <h3 className="iwr-section-title">{td.matchTitle}</h3>
        <span className="field-note">{td.matchRule}</span>
        {editable && values === null && candidates.isSuccess && (
          <span className="iwr-section-actions">
            <Button
              variant="outlined"
              size="sm"
              onClick={() =>
                setEditing(
                  Object.fromEntries(
                    lines.map((candidate) => [
                      candidate.purchaseOrderLineId,
                      String(candidate.thisLotQty),
                    ]),
                  ),
                )
              }
            >
              {td.editMatch}
            </Button>
          </span>
        )}
      </div>
      {table()}
      {values !== null && (
        <>
          <p className="field-note">{te.help}</p>
          <p className="field-note">{te.reopenNote}</p>
          {errors.length > 0 && (
            <AlertBanner variant="error" title={te.errorsTitle}>
              <ul className="iwr-errors">
                {errors.map((error) => (
                  <li key={error.text}>{error.text}</li>
                ))}
              </ul>
            </AlertBanner>
          )}
          {banner !== null && (
            <AlertBanner
              variant="warning"
              action={
                banner.reload ? (
                  <Button variant="text" size="sm" onClick={reload}>
                    {t.errors.reload}
                  </Button>
                ) : undefined
              }
            >
              {banner.text}
            </AlertBanner>
          )}
          <div className="iwr-editor-actions">
            {blocked && (
              <span id={saveNoteId} className="field-note">
                {te.saveLocked}
              </span>
            )}
            <Button variant="outlined" disabled={saving} onClick={() => setEditing(null)}>
              {te.cancel}
            </Button>
            <Button
              disabled={blocked}
              loading={saving}
              aria-describedby={blocked ? saveNoteId : undefined}
              onClick={() => void save()}
            >
              {te.save}
            </Button>
          </div>
        </>
      )}
    </section>
  );
};

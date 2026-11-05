import { AlertBanner, Button, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { ReplenishmentArrival } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { useReceiveArrival } from './mutations';
import { useVarianceReasons } from './queries';
import { hasErrorCode, parseQty, qtyWithUom } from './types';

const t = messages.productionWarehouseReplenishment;
const tr = t.receiveDialog;

export const ALREADY_RECEIVED = 'ALREADY_RECEIVED';

interface DraftLine {
  received: string;
  reason: string;
}

export type ReceiveProblem = { kind: 'qty' | 'reason'; text: string } | null;

/**
 * 줄 검사 — 0 ≤ 받은 ≤ 출고, 받은 수량이 다르면 차이 사유(사유 목록이 있을 때) 필수(US2-5, 계약 §2).
 * 차이 사유는 고객이 늘리는 값이라 비어 올 수 있다 — 그때는 요구하지 않는다(M-01-09 와 같은 규칙).
 */
export const receiveProblem = (
  label: string,
  issued: number,
  uom: string,
  draft: DraftLine,
  hasReasons: boolean,
): ReceiveProblem => {
  const received = parseQty(draft.received);
  if (received === null || received < 0 || received > issued) {
    return { kind: 'qty', text: tr.qtyInvalid(label, qtyWithUom(issued, uom)) };
  }
  if (received !== issued && hasReasons && draft.reason === '') {
    return { kind: 'reason', text: tr.reasonRequired(label) };
  }
  return null;
};

export interface ReceiveDialogProps {
  arrival: ReplenishmentArrival;
  onClose: () => void;
  /** 그사이 이미 받은 출고(409) — 목록을 다시 받게 한다. */
  onStale: () => void;
}

/**
 * 하나씩 받기 창(screens/W-02-12.md 보기 3). 줄마다 받은 수량(기본 = 출고)과 차이 사유. 저장은 웹 개별 수령 경로 —
 * 도착 위치 · W/O 는 서버가 채운다. 수령은 기록만 하고 재고는 바꾸지 않는다.
 */
export const ReceiveDialog = ({ arrival, onClose, onStale }: ReceiveDialogProps) => {
  const toast = useToast();
  const blockId = useId();
  const reasons = useVarianceReasons();
  const hasReasons = reasons.isPending || (reasons.data ?? []).length > 0;
  const [drafts, setDrafts] = useState<ReadonlyMap<number, DraftLine>>(
    () =>
      new Map(
        arrival.lines.map((line) => [
          line.goodsIssueLineId,
          { received: String(line.issueQty), reason: '' },
        ]),
      ),
  );

  const receive = useReceiveArrival(arrival.goodsIssueId, (saved) => {
    const count = saved.shopfloorReceipt.putawayTaskIds?.length ?? 0;
    toast.show({
      variant: 'success',
      description:
        count > 0
          ? t.receiveToast.putaway(arrival.goodsIssueNo, count)
          : t.receiveToast.received(arrival.goodsIssueNo),
    });
    onClose();
  });

  const labelOf = (line: ReplenishmentArrival['lines'][number]): string =>
    `${line.itemCode} ${line.itemName}`;
  const draftOf = (id: number): DraftLine => drafts.get(id) ?? { received: '', reason: '' };
  const problems = arrival.lines.map((line) =>
    receiveProblem(
      labelOf(line),
      line.issueQty,
      line.uomCode,
      draftOf(line.goodsIssueLineId),
      hasReasons,
    ),
  );
  const firstProblem = problems.find((problem) => problem !== null) ?? null;
  const already = hasErrorCode(receive.error, ALREADY_RECEIVED);

  const update = (id: number, patch: Partial<DraftLine>): void => {
    receive.reset();
    setDrafts((prev) => new Map(prev).set(id, { ...draftOf(id), ...patch }));
  };

  const submit = (): void => {
    const now = new Date().toISOString();
    receive.write({
      businessDate: plantToday(),
      receivedAt: now,
      occurredAt: now,
      /* 전 줄 필수(계약 §2) — 적지 않은 줄을 빼지 않는다. */
      lines: arrival.lines.map((line) => {
        const draft = draftOf(line.goodsIssueLineId);
        const received = parseQty(draft.received) ?? 0;
        return {
          goodsIssueLineId: line.goodsIssueLineId,
          itemId: line.itemId,
          lotId: line.lotId,
          issuedQty: line.issueQty,
          receivedQty: received,
          uomId: line.uomId,
          varianceReasonCode:
            received === line.issueQty || draft.reason === '' ? null : draft.reason,
        };
      }),
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={tr.title(arrival.goodsIssueNo)}
      size="lg"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {tr.cancel}
          </Button>
          <Button
            disabled={firstProblem !== null || already}
            aria-describedby={firstProblem !== null ? blockId : undefined}
            loading={receive.isSaving}
            onClick={submit}
          >
            {tr.submit}
          </Button>
        </>
      }
    >
      <div className="replenishment-form">
        <p className="dialog-text">{tr.note}</p>
        {already ? (
          <AlertBanner
            variant="warning"
            action={
              <Button variant="outlined" size="sm" onClick={onStale}>
                {t.common.reload}
              </Button>
            }
          >
            {tr.already}
          </AlertBanner>
        ) : (
          receive.error !== null && <SaveErrorBanner error={receive.error} />
        )}
        <div className="replenishment-table-scroll">
          <table className="replenishment-table" aria-label={tr.linesLabel}>
            <thead>
              <tr>
                <th scope="col">{tr.columns.itemLot}</th>
                <th scope="col" className="is-number">
                  {tr.columns.issued}
                </th>
                <th scope="col">{tr.columns.received}</th>
                <th scope="col">{tr.columns.reason}</th>
              </tr>
            </thead>
            {arrival.lines.map((line, index) => {
              const draft = draftOf(line.goodsIssueLineId);
              const received = parseQty(draft.received);
              const diff =
                received !== null && received >= 0 && received < line.issueQty
                  ? line.issueQty - received
                  : 0;
              const problem = problems[index] ?? null;
              return (
                <tbody key={line.goodsIssueLineId} className="replenishment-line">
                  <tr>
                    <td className="is-wrap">
                      <span className="replenishment-code">{line.itemCode}</span>{' '}
                      {`${line.itemName}, ${line.lotNo}`}
                    </td>
                    <td className="is-number">{qtyWithUom(line.issueQty, line.uomCode)}</td>
                    <td>
                      <TextField
                        size="sm"
                        inputMode="decimal"
                        aria-label={tr.receivedLabel(labelOf(line))}
                        value={draft.received}
                        onChange={(event) =>
                          update(line.goodsIssueLineId, { received: event.target.value })
                        }
                      />
                    </td>
                    <td className="replenishment-source-cell">
                      <Select
                        aria-label={tr.reasonLabel(labelOf(line))}
                        placeholder={tr.reasonPlaceholder}
                        value={draft.reason === '' ? null : draft.reason}
                        invalid={problem?.kind === 'reason'}
                        disabled={received === line.issueQty}
                        options={reasons.data ?? []}
                        onChange={(value) => update(line.goodsIssueLineId, { reason: value })}
                      />
                    </td>
                  </tr>
                  {(diff > 0 || problem !== null) && (
                    <tr className="replenishment-note-row">
                      <td colSpan={4}>
                        {diff > 0 && (
                          <span className="replenishment-cap is-info">
                            {tr.diff(qtyWithUom(diff, line.uomCode))}
                          </span>
                        )}
                        {problem !== null && (
                          <span className="field-error" role="alert">
                            {problem.text}
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
        {firstProblem !== null && (
          <p id={blockId} className="visually-hidden">
            {firstProblem.text}
          </p>
        )}
      </div>
    </Dialog>
  );
};

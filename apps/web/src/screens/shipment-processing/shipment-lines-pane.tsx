import { type Column, EmptyState, IconButton, Select, TextField, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { LotCandidateResult } from './lot-candidates';
import {
  lineAllocationIssues,
  toAllocationRows,
  type LineAllocationDraft,
  type ShipmentLineAllocationRow,
} from './line-allocation-draft';

const t = messages.shipmentProcessing.lines;

export interface ShipmentLinesPaneProps {
  lines: readonly LineAllocationDraft[];
  lotCandidates: Record<number, LotCandidateResult>;
  onAddAllocation: (shipmentRequestLineId: number) => void;
  onRemoveAllocation: (shipmentRequestLineId: number, draftId: string) => void;
  onSetAllocationLot: (shipmentRequestLineId: number, draftId: string, lotId: number) => void;
  onSetAllocationQty: (shipmentRequestLineId: number, draftId: string, qty: string) => void;
  onSetShippedQty: (shipmentRequestLineId: number, shippedQty: string) => void;
}

/**
 * ①출하 내역 — 라인별 LOT 수동 선택 + 수량 입력.
 *
 * `Table`의 `groupBy`로 라인→LOT을 묶는다(계획서 결정). 배분이 아직 없는 라인도 표에서
 * 사라지지 않도록 자리표시 행을 하나씩 낸다(`line-allocation-draft.ts`의 `toAllocationRows`).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const ShipmentLinesPane = ({
  lines,
  lotCandidates,
  onAddAllocation,
  onRemoveAllocation,
  onSetAllocationLot,
  onSetAllocationQty,
  onSetShippedQty,
}: ShipmentLinesPaneProps) => {
  const rows = toAllocationRows(lines);
  const lineById = new Map(lines.map((line) => [line.shipmentRequestLineId, line]));

  const columns: Column<ShipmentLineAllocationRow>[] = [
    {
      key: 'lot',
      header: t.fields.lot,
      render: (row) => {
        if (row.isPlaceholder) return t.values.noAllocations;

        const candidates = lotCandidates[row.itemId];
        const options = (candidates?.items ?? []).map((lot) => ({
          value: String(lot.lotId),
          label: lot.held ? `${lot.lotNo}${t.values.heldSuffix}` : lot.lotNo,
          disabled: lot.held,
        }));

        return (
          <Select
            aria-label={`${t.fields.lot} · ${t.fields.line} ${String(row.lineNo)}`}
            placeholder={t.lotSelectPlaceholder}
            disabled={candidates?.isLoading ?? true}
            options={options}
            value={row.lotId === null ? null : String(row.lotId)}
            onChange={(value) => {
              onSetAllocationLot(row.shipmentRequestLineId, row.draftId, Number(value));
            }}
          />
        );
      },
    },
    {
      key: 'qty',
      header: t.fields.qty,
      align: 'end',
      render: (row) =>
        row.isPlaceholder ? null : (
          <TextField
            aria-label={`${t.fields.qty} · ${t.fields.line} ${String(row.lineNo)}`}
            type="number"
            min="0"
            value={row.qty}
            onChange={(event) => {
              onSetAllocationQty(row.shipmentRequestLineId, row.draftId, event.target.value);
            }}
          />
        ),
    },
    {
      key: 'manage',
      header: t.fields.manage,
      render: (row) =>
        row.isPlaceholder ? null : (
          <IconButton
            icon="delete"
            size="sm"
            variant="standard"
            aria-label={t.actions.removeLot}
            onClick={() => {
              onRemoveAllocation(row.shipmentRequestLineId, row.draftId);
            }}
          />
        ),
    },
  ];

  if (lines.length === 0) {
    return (
      <section className="pane" aria-label={messages.shipmentProcessing.panes.lines}>
        <EmptyState size="sm" title={messages.shipmentProcessing.detail.unavailable} />
      </section>
    );
  }

  return (
    <section className="pane" aria-label={messages.shipmentProcessing.panes.lines}>
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.rowKey}
          sort={null}
          groupBy={(row) => String(row.shipmentRequestLineId)}
          renderGroupHeader={(groupKey) => {
            const line = lineById.get(Number(groupKey));
            if (line === undefined) return groupKey;

            const issues = lineAllocationIssues(line);

            return (
              <div>
                <span>
                  {t.fields.line} {line.lineNo} · {t.values.itemLabel(line.itemId)} ·{' '}
                  {t.fields.requestedQty} {line.requestedQty} / {t.fields.allocatedQty}{' '}
                  {line.allocatedQty} / {t.fields.pickedQty} {line.pickedQty}
                </span>
                <div className="field-cell">
                  <TextField
                    label={t.fields.shippedQty}
                    type="number"
                    min="0"
                    value={line.shippedQty}
                    onChange={(event) => {
                      onSetShippedQty(line.shipmentRequestLineId, event.target.value);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="link-cell"
                  onClick={() => {
                    onAddAllocation(line.shipmentRequestLineId);
                  }}
                >
                  {t.actions.addLot}
                </button>
                {issues.length > 0 ? (
                  <p className="field-note">{issues.map((issue) => t.issues[issue]).join(' ')}</p>
                ) : null}
              </div>
            );
          }}
          empty={<EmptyState size="sm" title={t.values.noAllocations} />}
        />
      </div>
    </section>
  );
};

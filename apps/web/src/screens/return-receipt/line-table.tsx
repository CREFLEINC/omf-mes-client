import { Button, type Column, Table, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import type { LineDraft } from './line-draft';
import { formatQty } from './types';

const t = messages.returnReceipt;

export interface LineTableProps {
  drafts: LineDraft[];
  errors: Record<string, string>;
  uoms: LookupSource;
  items: LookupSource;
  isLocked: boolean;
  onChangeQty: (key: string, qtyText: string) => void;
  onRemove: (key: string) => void;
}

/**
 * 반품 라인 표 — 품목 · 원 LOT · 출하 수량 · 반품 수량(입력) · 단위.
 *
 * 배분에서 온 줄은 지울 수 없다(수량을 비우면 보내지 않는다). 직접 찾은 LOT 줄만 지운다.
 */
export const LineTable = ({
  drafts,
  errors,
  uoms,
  items,
  isLocked,
  onChangeQty,
  onRemove,
}: LineTableProps) => {
  const columns: Column<LineDraft>[] = [
    {
      key: 'item',
      header: t.fields.item,
      render: (row) => row.source.itemCode ?? lookupDisplayLabel(items, row.source.itemId),
    },
    { key: 'lot', header: t.fields.lotNo, render: (row) => row.source.lotNo },
    {
      key: 'shipped',
      header: t.fields.shippedQty,
      align: 'end',
      width: '88px',
      render: (row) =>
        row.source.shippedQty === null ? t.values.notAvailable : formatQty(row.source.shippedQty),
    },
    {
      key: 'return',
      header: t.fields.returnQty,
      width: '160px',
      render: (row) => (
        <TextField
          aria-label={`${row.source.lotNo} ${t.fields.returnQty}`}
          value={row.qtyText}
          placeholder={t.lines.qtyPlaceholder}
          inputMode="decimal"
          disabled={isLocked}
          error={errors[row.source.key]}
          onChange={(event) => onChangeQty(row.source.key, event.target.value)}
        />
      ),
    },
    {
      key: 'uom',
      header: t.fields.uom,
      width: '72px',
      render: (row) => lookupDisplayLabel(uoms, row.source.uomId),
    },
    {
      key: 'remove',
      header: '',
      width: '56px',
      render: (row) =>
        row.source.allocationId === null ? (
          <Button
            variant="text"
            size="sm"
            disabled={isLocked}
            aria-label={t.actions.removeLine(row.source.lotNo)}
            onClick={() => onRemove(row.source.key)}
          >
            ×
          </Button>
        ) : null,
    },
  ];

  if (drafts.length === 0) return <p className="field-note">{t.lines.empty}</p>;

  return (
    <div className="return-receipt-table">
      <Table
        density="compact"
        caption={<span className="return-receipt-table-caption">{t.panes.lines}</span>}
        columns={columns}
        rows={drafts}
        getRowId={(row) => row.source.key}
      />
      <p className="field-note">{t.lines.partialNote}</p>
    </div>
  );
};

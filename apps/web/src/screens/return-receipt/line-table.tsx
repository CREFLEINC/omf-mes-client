import { Button, type Column, Table, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { splitCodeName } from '../../patterns/split-code-name';
import type { LineDraft } from './line-draft';
import type { ItemNameLookup } from './lookups';
import { formatQty } from './types';

const t = messages.returnReceipt;

export interface LineTableProps {
  drafts: LineDraft[];
  errors: Record<string, string>;
  uoms: LookupSource;
  /** 품목은 번호마다 하나씩 푼다 — 목록 원천이 아니라 풀이 함수를 받는다. */
  items: ItemNameLookup;
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
  /** 품목코드 · 품목명 두 칸(사용자 지시 2026-11-24). 못 푼 안내는 품목코드 칸에 둔다. */
  const itemCodeNameOf = (row: LineDraft): { code: string; name: string } =>
    splitCodeName(
      lookupDisplayLabel(items.of(row.source.itemId), row.source.itemId),
      messages.common.reference.empty,
    );

  const columns: Column<LineDraft>[] = [
    {
      key: 'item',
      header: t.fields.itemCode,
      render: (row) => row.source.itemCode ?? itemCodeNameOf(row).code,
    },
    {
      key: 'itemName',
      header: t.fields.itemName,
      render: (row) => itemCodeNameOf(row).name,
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
      /* 한 줄 이상 반품 수량이 있어야 등록된다(잠금 noQty) — 열 제목에 필수 표시. */
      header: (
        <>
          {t.fields.returnQty}
          <span className="required-mark" aria-hidden="true">
            {' *'}
          </span>
        </>
      ),
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
    </div>
  );
};

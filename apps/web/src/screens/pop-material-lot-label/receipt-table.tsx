import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import type { LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import { formatReceiptDate, type TargetRow } from './types';

const t = messages.popMaterialLotLabel.receipts;

export interface ReceiptTableProps {
  rows: TargetRow[];
  supplierLookup: LookupSource;
  itemLookup: LookupSource;
  uomLookup: LookupSource;
  selectedId: number | null;
  onToggleSelect: (inboundReceiptLineId: number) => void;
  /** 결과가 없을 때 그 자리에 보일 안내. 「없음」과 「이 쪽에 없음」이 갈린다. */
  empty: string;
}

/**
 * 입하 목록 — **스펙 §3 의 한 줄이 입하 건과 품목을 함께 담는다.**
 *
 * 칸을 늘리는 대신 **한 칸에 두 줄을 쌓는다**(`.stacked-cell`). 1024 를 좌우로 나눈 폭에
 * 다섯 칸을 늘어놓으면 값이 칸 안에서 접히고, 코드는 하이픈 뒤에서 갈려 다른 코드로 읽힌다.
 *
 * 밀도를 `comfortable`로 둔다. 장갑 낀 손으로 누르는 표라 `compact`는 행이 서로 붙는다.
 *
 * ⛔ **정렬을 켜지 않는다.** 서버가 쪽 단위로 잘라 주므로 화면이 정렬하면 **보이는 쪽 안에서만**
 * 정렬돼 「전체가 정렬된 것」으로 오해된다.
 */
export const ReceiptTable = ({
  rows,
  supplierLookup,
  itemLookup,
  uomLookup,
  selectedId,
  onToggleSelect,
  empty,
}: ReceiptTableProps) => {
  const columns: Column<TargetRow>[] = [
    {
      key: 'select',
      header: t.columns.select,
      width: '128px',
      render: (row) => {
        const isSelected = row.inboundReceiptLineId === selectedId;
        const itemName = lookupDisplayLabel(itemLookup, row.itemId);

        return (
          <Button
            className={popTouchClass('normal')}
            variant={isSelected ? 'filled' : 'outlined'}
            size="xl"
            aria-pressed={isSelected}
            aria-label={
              isSelected
                ? t.deselectRow(row.inboundReceiptNo, itemName)
                : t.selectRow(row.inboundReceiptNo, itemName)
            }
            onClick={() => {
              onToggleSelect(row.inboundReceiptLineId);
            }}
          >
            {isSelected ? t.selected : t.select}
          </Button>
        );
      },
    },
    {
      key: 'receipt',
      header: t.columns.receipt,
      render: (row) => (
        <span className="stacked-cell">
          <span>{row.inboundReceiptNo}</span>
          <span>{lookupDisplayLabelWithInactive(supplierLookup, row.supplierId)}</span>
        </span>
      ),
    },
    {
      key: 'item',
      header: t.columns.item,
      render: (row) => lookupDisplayLabel(itemLookup, row.itemId),
    },
    {
      key: 'quantity',
      header: t.columns.quantity,
      align: 'end',
      width: '140px',
      render: (row) => (
        <span className="stacked-cell">
          <span>
            {row.receivedQty} {lookupDisplayLabel(uomLookup, row.uomId)}
          </span>
          <span>{formatReceiptDate(row.receiptDatetime)}</span>
        </span>
      ),
    },
  ];

  return (
    <Table
      caption={t.caption}
      columns={columns}
      rows={rows}
      density="comfortable"
      empty={<p className="field-note">{empty}</p>}
      getRowId={(row) => String(row.inboundReceiptLineId)}
    />
  );
};

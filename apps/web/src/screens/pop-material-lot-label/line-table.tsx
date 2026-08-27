import { Button, Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import type { LineView } from './types';

const t = messages.popMaterialLotLabel.lines;

export interface LineTableProps {
  rows: LineView[];
  itemLookup: LookupSource;
  uomLookup: LookupSource;
  selectedId: number | null;
  onToggleSelect: (inboundReceiptLineId: number) => void;
}

/**
 * 품목 줄 — 고른 입하 건의 라인이다.
 *
 * ⭐ **부착 여부를 줄마다 보인다.** 이 화면은 공급사가 LOT 을 붙이지 않은 건에 MES 가
 * 발번하는 자리인데, 계약이 그 값을 라인 속성으로 두고 입하 건 목록에는 필터를 주지 않는다.
 * 걸러 내면 쪽 나눔이 어긋나므로 **걸러 내는 대신 표시한다**(검토 요청 omf-mes#245 ③).
 * 「부착됨」을 감추지 않는 이유는 그것이 왜 발번 대상이 아닌지를 사람이 알아야 해서다.
 */
export const LineTable = ({
  rows,
  itemLookup,
  uomLookup,
  selectedId,
  onToggleSelect,
}: LineTableProps) => {
  const columns: Column<LineView>[] = [
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
            aria-label={isSelected ? t.deselectRow(itemName) : t.selectRow(itemName)}
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
      key: 'item',
      header: t.columns.item,
      render: (row) => lookupDisplayLabel(itemLookup, row.itemId),
    },
    {
      key: 'quantity',
      header: t.columns.quantity,
      align: 'end',
      width: '140px',
      render: (row) => `${row.receivedQty} ${lookupDisplayLabel(uomLookup, row.uomId)}`,
    },
    {
      key: 'attachment',
      header: t.columns.attachment,
      width: '112px',
      render: (row) => (
        <Chip status={row.supplierLotMissing ? 'info' : 'idle'}>
          {row.supplierLotMissing ? t.missing : t.attached}
        </Chip>
      ),
    },
  ];

  return (
    <Table
      caption={t.caption}
      columns={columns}
      rows={rows}
      density="comfortable"
      empty={<p className="field-note">{t.empty}</p>}
      getRowId={(row) => String(row.inboundReceiptLineId)}
    />
  );
};

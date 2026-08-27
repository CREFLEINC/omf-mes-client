import { Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import { formatReceiptDate, type ReceiptView } from './types';

const t = messages.popMaterialLotLabel.receipts;

export interface ReceiptTableProps {
  rows: ReceiptView[];
  supplierLookup: LookupSource;
  selectedId: number | null;
  onSelect: (inboundReceiptId: number) => void;
  /** 결과가 없을 때 그 자리에 보일 안내. 「없음」과 「이 쪽에 없음」이 갈린다. */
  empty: string;
}

/**
 * 입하 건 목록 — **고르는 표다.**
 *
 * 밀도를 `comfortable`로 둔다. 장갑 낀 손으로 누르는 표라 `compact`는 행이 서로 붙는다.
 *
 * ⛔ **정렬을 켜지 않는다.** 서버가 쪽 단위로 잘라 주므로 화면이 정렬하면 **보이는 쪽 안에서만**
 * 정렬돼 「전체가 정렬된 것」으로 오해된다.
 *
 * 행 선택은 DS `Table`의 선택 열(`selectable`)을 쓰지 않는다 — 이 화면은 **한 건만** 고르고,
 * 확인칸은 여럿 고르는 조작으로 읽힌다.
 */
export const ReceiptTable = ({
  rows,
  supplierLookup,
  selectedId,
  onSelect,
  empty,
}: ReceiptTableProps) => {
  const columns: Column<ReceiptView>[] = [
    {
      key: 'inboundReceiptNo',
      header: t.columns.inboundReceiptNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-pressed={row.inboundReceiptId === selectedId}
          onClick={() => {
            onSelect(row.inboundReceiptId);
          }}
        >
          {row.inboundReceiptNo}
        </button>
      ),
    },
    {
      key: 'supplier',
      header: t.columns.supplier,
      render: (row) => lookupDisplayLabelWithInactive(supplierLookup, row.supplierId),
    },
    {
      key: 'receiptDate',
      header: t.columns.receiptDate,
      width: '120px',
      render: (row) => formatReceiptDate(row.receiptDatetime),
    },
  ];

  return (
    <Table
      caption={t.caption}
      columns={columns}
      rows={rows}
      density="comfortable"
      empty={<p className="field-note">{empty}</p>}
      getRowId={(row) => String(row.inboundReceiptId)}
    />
  );
};

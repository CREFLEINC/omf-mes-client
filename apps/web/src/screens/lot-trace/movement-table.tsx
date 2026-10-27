import { Chip, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SelectableTable } from '../../patterns/selectable-table';
import type { MovementKind } from './filters';
import { qtyLabel, type MovementRow } from './rows';

const t = messages.lotTrace.list;

export interface MovementTableProps {
  kind: MovementKind;
  rows: MovementRow[];
  onOpen: (row: MovementRow) => void;
  empty: ReactNode;
}

/** 세 번째 열 이름 — 구분마다 상대가 다르다(공급사, W/O, 고객). */
const partnerHeader = (kind: MovementKind): string =>
  kind === 'MATERIAL'
    ? t.columns.supplier
    : kind === 'PRODUCT'
      ? t.columns.workOrder
      : t.columns.customer;

/**
 * 입출고 줄 표(C-1, C-10, C-16). 셀은 한 줄. 품목명이 남는 폭을 가져가고 말줄임한다(툴팁 「이름 (코드)」).
 * 문서번호와 LOT 번호는 대조에 쓰여 고정폭, 말줄임 없음(C-10). 출하 줄의 LOT은 첫 LOT과 「외 N」.
 * 1280×800 가로 넘침(C-16)으로 구분, 품목 코드, 창고, 상태는 드로어와 내려받은 파일에 둔다.
 */
export const MovementTable = ({ kind, rows, onOpen, empty }: MovementTableProps) => {
  const columns: Column<MovementRow>[] = [
    {
      key: 'date',
      header: kind === 'SHIPMENT' ? t.columns.shipDate : t.columns.receiptDate,
      render: (row) => <span className="nowrap-cell">{row.date}</span>,
    },
    {
      key: 'documentNo',
      header: kind === 'SHIPMENT' ? t.columns.shipmentNo : t.columns.receiptNo,
      render: (row) => <span className="nowrap-cell mono-cell">{row.documentNo}</span>,
    },
    {
      key: 'itemName',
      header: t.columns.itemName,
      render: (row) => (
        <span className="ellipsis-cell lot-trace-fill" title={named(row.item.name, row.item.code)}>
          {row.item.name}
        </span>
      ),
    },
    {
      key: 'lotNo',
      header: t.columns.lotNo,
      render: (row) => (
        <span className="chip-row">
          <span className="nowrap-cell mono-cell">{row.lots[0]?.lotNo ?? ''}</span>
          {row.lotCount > 1 && (
            <Chip variant="status" size="sm" status="idle">
              {t.moreLots(row.lotCount - 1)}
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: 'qty',
      header: t.columns.qty,
      align: 'end',
      render: (row) => <span className="nowrap-cell">{qtyLabel(row)}</span>,
    },
    {
      key: 'partner',
      header: partnerHeader(kind),
      render: (row) =>
        kind === 'PRODUCT' ? (
          <span className="nowrap-cell mono-cell">{row.workOrderNo ?? ''}</span>
        ) : (
          <span
            className="ellipsis-cell lot-trace-partner"
            title={row.partner === null ? undefined : named(row.partner.name, row.partner.code)}
          >
            {row.partner?.name ?? ''}
          </span>
        ),
    },
  ];

  return (
    <SelectableTable
      className="lot-trace-table"
      caption={<span className="visually-hidden">{t.caption}</span>}
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.id)}
      rowRole="link"
      rowLabel={(row) => t.openRow(row.documentNo, row.lots[0]?.lotNo ?? '')}
      onActivate={onOpen}
      empty={empty}
    />
  );
};

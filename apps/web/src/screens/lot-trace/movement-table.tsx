import { Chip, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { MovementKind } from './filters';
import { qtyLabel, type MovementRow } from './rows';
import { ListTable, LotNo } from './trace-table';

const t = messages.lotTrace.list;

export interface MovementTableProps {
  kind: MovementKind;
  rows: MovementRow[];
  /** 고른 줄(`MovementRow.id`). */
  activeId: number | null;
  onOpen: (row: MovementRow) => void;
  empty: ReactNode;
}

/**
 * 기간별 이력 줄 표(C-1, C-10, C-16). 다른 두 탭의 목록과 같은 짜임이다 — 열 폭은 px로 정하고 넘치면 말줄임, 행은 한 줄.
 * 목록 창(1440px에서 화면 절반)에 맞춰 일자, 문서번호, LOT 번호, 수량 넷만 둔다. 품목, 창고, 공급사 또는 고객, 상태는
 * 상세 창과 내려받은 파일에 있다. 출하 줄의 LOT은 첫 LOT과 「외 N」이고, 줄을 고르면 상세 머리에서 LOT을 고른다.
 */
export const MovementTable = ({ kind, rows, activeId, onOpen, empty }: MovementTableProps) => {
  const columns: Column<MovementRow>[] = [
    {
      key: 'date',
      header: kind === 'SHIPMENT' ? t.columns.shipDate : t.columns.receiptDate,
      width: '100px',
      align: 'center',
      render: (row) => row.date,
    },
    {
      key: 'documentNo',
      header: kind === 'SHIPMENT' ? t.columns.shipmentNo : t.columns.receiptNo,
      width: '168px',
      render: (row) => (
        <span className="mono-cell" title={row.documentNo}>
          {row.documentNo}
        </span>
      ),
    },
    {
      key: 'lotNo',
      header: t.columns.lotNo,
      width: '150px',
      render: (row) => (
        <span className="lot-trace-cell-with-chip">
          <LotNo lotNo={row.lots[0]?.lotNo ?? ''} />
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
      width: '96px',
      align: 'end',
      render: (row) => qtyLabel(row),
    },
  ];

  return (
    <ListTable
      storageKey={`omf-mes:lot-trace:columns:period:${kind}`}
      columns={columns}
      rows={rows}
      activeId={activeId === null ? null : String(activeId)}
      onOpen={onOpen}
      empty={empty}
      getRowId={(row) => String(row.id)}
      rowLabel={(row) => t.openRow(row.documentNo, row.lots[0]?.lotNo ?? '')}
      caption={t.caption}
    />
  );
};

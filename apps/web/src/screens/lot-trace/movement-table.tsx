import { Chip, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { qtyLabel, rowKeyOf, type MovementRow } from './rows';
import { ListTable } from './trace-table';

const t = messages.lotTrace;

export interface MovementTableProps {
  /** 전체를 볼 때만 구분 열을 둔다(구분 칩을 고르면 줄이 모두 같은 구분이다). */
  showKind: boolean;
  rows: MovementRow[];
  /** 고른 줄(`rowKeyOf`). */
  activeKey: string | null;
  onOpen: (row: MovementRow) => void;
  empty: ReactNode;
}

/**
 * 일시 — 목록의 줄이 모두 한 해이면 해를 빼고 「MM-DD HH:mm」, 해가 섞이면 「YYYY-MM-DD HH:mm」. 기간은 366일까지라
 * 해가 바뀌는 기간이 있다.
 */
const dateTimeOf = (row: MovementRow, withYear: boolean): string =>
  `${withYear ? row.date : row.date.slice(5)} ${row.time}`.trim();

/**
 * 이력 줄 표(C-1, C-10, C-16) — 일시, 구분(전체일 때), 문서번호, 품목명, 수량. 행은 한 줄이다.
 * 일시, 구분, 문서번호, 수량은 정한 폭이고 줄이지 않는다(구분과 문서번호는 잘리지 않아야 한다). 품목명이 남는 폭을 쓰고
 * 넘치면 말줄임(전체는 마우스를 올리면 「이름 (코드)」). LOT 번호는 목록에서 빼고 상세 머리와 내려받은 파일에 둔다.
 */
export const MovementTable = ({ showKind, rows, activeKey, onOpen, empty }: MovementTableProps) => {
  const withYear = new Set(rows.map((row) => row.date.slice(0, 4))).size > 1;
  const columns: Column<MovementRow>[] = [
    {
      key: 'date',
      header: t.list.columns.datetime,
      width: withYear ? '148px' : '108px',
      render: (row) => dateTimeOf(row, withYear),
    },
    ...(showKind
      ? [
          {
            key: 'kind',
            header: t.list.columns.kind,
            width: '92px',
            align: 'center' as const,
            render: (row: MovementRow) => (
              <Chip variant="status" size="sm" status="idle">
                {t.kinds[row.kind]}
              </Chip>
            ),
          },
        ]
      : []),
    {
      key: 'documentNo',
      header: t.list.columns.documentNo,
      width: '160px',
      render: (row) => <span className="mono-cell lot-trace-doc">{row.documentNo}</span>,
    },
    {
      key: 'item',
      header: t.list.columns.itemName,
      render: (row) => (
        <span className="ellipsis-cell" title={named(row.item.name, row.item.code)}>
          {row.item.name}
        </span>
      ),
    },
    {
      key: 'qty',
      header: t.list.columns.qty,
      width: '88px',
      align: 'end',
      render: (row) => qtyLabel(row),
    },
  ];

  return (
    <ListTable
      storageKey={`omf-mes:lot-trace:columns:history2:${showKind ? 'all' : 'kind'}`}
      columns={columns}
      rows={rows}
      activeId={activeKey}
      onOpen={onOpen}
      empty={empty}
      getRowId={rowKeyOf}
      rowLabel={(row) => t.list.openRow(row.documentNo, row.lots[0]?.lotNo ?? '')}
      caption={t.list.caption}
    />
  );
};

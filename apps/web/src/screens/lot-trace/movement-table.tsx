import { Chip, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { qtyLabel, rowKeyOf, type MovementRow } from './rows';
import { ListTable, LotNo } from './trace-table';

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
 * 이력 줄 표(C-1, C-10, C-16) — 일자, 구분(전체일 때), 문서번호, LOT 번호, 수량. 열 폭은 px로 정하고 넘치면 말줄임,
 * 행은 한 줄이다. 목록 창(1440px 좌우 배치에서 화면 절반)에 맞춘 열 넷 또는 다섯이다. 품목, 창고, 공급사 또는 고객,
 * 상태는 상세 창과 내려받은 파일에 있다. 현재 단계 열은 창에 들어가지 않아 두지 않는다 — 상세의 단계 줄이 보인다.
 * 출하 줄의 LOT은 첫 LOT과 「외 N」이고, 줄을 고르면 상세 머리에서 LOT을 고른다.
 */
export const MovementTable = ({ showKind, rows, activeKey, onOpen, empty }: MovementTableProps) => {
  const columns: Column<MovementRow>[] = [
    {
      key: 'date',
      header: t.list.columns.date,
      width: '100px',
      align: 'center',
      render: (row) => row.date,
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
      width: showKind ? '140px' : '168px',
      render: (row) => (
        <span className="mono-cell" title={row.documentNo}>
          {row.documentNo}
        </span>
      ),
    },
    {
      key: 'lotNo',
      header: t.list.columns.lotNo,
      width: showKind ? '112px' : '150px',
      render: (row) => (
        <span className="lot-trace-cell-with-chip">
          <LotNo lotNo={row.lots[0]?.lotNo ?? ''} />
          {row.lotCount > 1 && (
            <Chip variant="status" size="sm" status="idle">
              {t.list.moreLots(row.lotCount - 1)}
            </Chip>
          )}
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
      storageKey={`omf-mes:lot-trace:columns:history:${showKind ? 'all' : 'kind'}`}
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

import { Chip, EmptyState, Icon, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { useColumnWidths } from '../column-resize';
import { SelectableTable } from '../selectable-table';

const t = messages.traceTree;

export interface TraceEndTableProps<Row> {
  /** 「영향 제품 LOT」(정방향) · 「투입 원자재 LOT」(역방향). */
  title: string;
  columns: Column<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  /** 줄의 LOT 번호 — 접근 이름. */
  lotNoOf: (row: Row) => string;
  /** 고른 줄. */
  activeId: string | null;
  /** 줄을 고르면 계보에서 그 LOT 까지 경로를 편다(Q18). */
  onLocate: (row: Row) => void;
  /** 비었을 때(US1-4 「아직 생산에 투입되지 않았습니다」, US2-5 「투입 자재 기록이 없습니다」). */
  emptyTitle: string;
  emptyDescription?: ReactNode;
  /** 표 아래 안내. */
  note: string;
  /** 상한에 걸려 본 데까지만 셌다 — 「일부」. */
  partial: boolean;
  widthKey: string;
}

/** 최종 LOT 목록 — 줄 전체를 눌러 고르고(C-1), 고르면 계보에서 그 LOT 을 찾아 편다. */
export const TraceEndTable = <Row,>({
  title,
  columns,
  rows,
  getRowId,
  lotNoOf,
  activeId,
  onLocate,
  emptyTitle,
  emptyDescription,
  note,
  partial,
  widthKey,
}: TraceEndTableProps<Row>) => {
  const titleId = useId();
  const resizable = useColumnWidths(widthKey, columns, { fitContent: true });
  return (
    <section className="trace-tree-panel" aria-labelledby={titleId}>
      <div className="trace-tree-panel-head">
        <h3 className="subsection-title" id={titleId}>
          {title}
        </h3>
        <Chip variant="status" size="sm" status="idle">
          {t.end.count(rows.length)}
        </Chip>
        {partial && (
          <Chip variant="status" size="sm" status="warning">
            {t.detail.partialChip}
          </Chip>
        )}
        {rows.length > 0 && (
          <span className="field-note trace-tree-panel-hint">{t.end.locateHint}</span>
        )}
      </div>
      <div className="trace-tree-end-rows inspection-queue-table" style={resizable.style}>
        <SelectableTable
          className="trace-tree-end-table"
          caption={<span className="visually-hidden">{title}</span>}
          columns={resizable.columns}
          rows={[...rows]}
          getRowId={getRowId}
          activeId={activeId}
          rowLabel={(row) => t.end.openRow(lotNoOf(row))}
          onActivate={onLocate}
          empty={
            <EmptyState
              size="sm"
              icon={<Icon name="inventory" size={24} />}
              title={emptyTitle}
              description={emptyDescription}
            />
          }
        />
      </div>
      {rows.length > 0 && <p className="field-note">{note}</p>}
    </section>
  );
};

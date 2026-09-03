import { Chip, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { ProductionOrderRow } from './types';

const t = messages.productionOrder;
const displayOr = (value: string | null, fallback: string): string =>
  value === null || value.trim() === '' ? fallback : value;

export interface ProductionOrderListPaneProps {
  rows: ProductionOrderRow[];
  isLoading: boolean;
  page: PageView;
  selectedProductionOrderId: number | null;
  onSelect: (productionOrderId: number) => void;
  onToggleExpanded: (productionOrderId: number) => void;
  onChangePage: (page: number) => void;
}

export const ProductionOrderListPane = ({
  rows,
  isLoading,
  page,
  selectedProductionOrderId,
  onSelect,
  onToggleExpanded,
  onChangePage,
}: ProductionOrderListPaneProps) => {
  const columns: Column<ProductionOrderRow>[] = [
    {
      key: 'productionOrderNo',
      header: t.fields.productionOrderNo,
      render: (row) => (
        <div
          className="tree-toggle"
          data-depth={row.depth}
          style={{ paddingInlineStart: `${String(Math.max(0, Math.trunc(row.depth)))}rem` }}
        >
          {row.hasChildren ? (
            <IconButton
              size="sm"
              icon={row.isExpanded ? 'expand_more' : 'chevron_right'}
              aria-expanded={row.isExpanded}
              aria-label={
                row.isExpanded
                  ? t.actions.collapse(row.productionOrderNo)
                  : t.actions.expand(row.productionOrderNo)
              }
              onClick={() => {
                onToggleExpanded(row.productionOrderId);
              }}
            />
          ) : (
            <span aria-hidden="true" style={{ display: 'inline-block', width: '32px' }} />
          )}
          <button
            type="button"
            className="link-cell"
            aria-label={t.actions.select(row.productionOrderNo)}
            aria-current={selectedProductionOrderId === row.productionOrderId ? true : undefined}
            onClick={() => {
              onSelect(row.productionOrderId);
            }}
          >
            {row.productionOrderNo}
          </button>
        </div>
      ),
    },
    {
      key: 'erpProductionOrderNo',
      header: t.fields.erpProductionOrderNo,
      render: (row) => displayOr(row.erpProductionOrderNo, t.values.missingErpOrderNo),
    },
    {
      key: 'itemLabel',
      header: t.fields.item,
      render: (row) => displayOr(row.itemLabel, t.values.missingItemLabel),
    },
    { key: 'orderedQtyLabel', header: t.fields.orderedQty, align: 'end' },
    {
      key: 'dueDateLabel',
      header: t.fields.dueDate,
      render: (row) => displayOr(row.dueDateLabel, t.values.missingDueDate),
    },
    {
      key: 'workOrderProgress',
      header: t.fields.workOrderProgress,
      align: 'end',
      render: (row) =>
        `${String(row.expandedWorkOrderCount ?? '-')} / ${String(row.plannedWorkOrderCount ?? '-')}`,
    },
    {
      key: 'statusCode',
      header: t.fields.statusCode,
      render: (row) => (
        <Chip variant="status" status="idle" size="sm">
          {row.statusCode}
        </Chip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <section className="pane production-order-pane" aria-label={t.panes.list}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane production-order-pane" aria-label={t.panes.list}>
      <h2>{t.panes.list}</h2>
      <div className="wide-table production-order-table">
        <Table
          caption={<span className="production-order-table-caption">{t.panes.list}</span>}
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.productionOrderId)}
          sort={null}
          empty={
            <EmptyState
              size="sm"
              live
              title={page.isBeyondLast ? t.empty.beyondTitle : t.empty.title}
              description={page.isBeyondLast ? t.empty.beyondDescription : t.empty.description}
            />
          }
        />
      </div>
      <PageNav view={page} onChange={onChangePage} />
    </section>
  );
};

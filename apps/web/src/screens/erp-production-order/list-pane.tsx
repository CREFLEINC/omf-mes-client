import { Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { displayOr, formatQty, reworkLabel } from './format';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;

export interface ErpProductionOrderListPaneProps {
  rows: ErpProductionOrder[];
  isLoading: boolean;
  page: PageView;
  selectedId: number | null;
  itemNameOf: (itemId: number) => string;
  uomNameOf: (uomId: number) => string;
  storageLocationOf: (code: string) => string;
  statusNameOf: (code: string) => string;
  onSelect: (productionOrderId: number) => void;
  onChangePage: (page: number) => void;
}

/** ERP W/O 목록. 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다. */
export const ErpProductionOrderListPane = ({
  rows,
  isLoading,
  page,
  selectedId,
  itemNameOf,
  uomNameOf,
  storageLocationOf,
  statusNameOf,
  onSelect,
  onChangePage,
}: ErpProductionOrderListPaneProps) => {
  /*
   * 납기 열은 이 쪽에 납기가 있는 행이 있을 때만 세운다. ERP W/O 의 날짜는 계획 시작일 하나이고
   * 납기는 비어 온다(장부 P-66) — 늘 「-」뿐인 열이 표 폭을 먹지 않게 한다.
   */
  const hasDueDate = rows.some((row) => row.dueDate !== undefined && row.dueDate !== '');

  const columns: Column<ErpProductionOrder>[] = [
    {
      key: 'productionOrderNo',
      header: t.fields.productionOrderNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.select(row.productionOrderNo)}
          aria-current={selectedId === row.productionOrderId ? true : undefined}
          onClick={() => {
            onSelect(row.productionOrderId);
          }}
        >
          {row.productionOrderNo}
        </button>
      ),
    },
    { key: 'itemId', header: t.fields.item, render: (row) => itemNameOf(row.itemId) },
    {
      key: 'orderQty',
      header: t.fields.orderQty,
      align: 'end',
      render: (row) => t.values.qtyWithUom(formatQty(row.orderQty), uomNameOf(row.uomId)),
    },
    {
      key: 'plannedStartDate',
      header: t.fields.plannedStartDate,
      render: (row) => displayOr(row.plannedStartDate),
    },
    ...(hasDueDate
      ? [
          {
            key: 'dueDate',
            header: t.fields.dueDate,
            render: (row: ErpProductionOrder) => displayOr(row.dueDate),
          },
        ]
      : []),
    {
      key: 'erpOperationNo',
      header: t.fields.operationNo,
      render: (row) => displayOr(row.erpOperationNo),
    },
    {
      key: 'erpStorageLocationCode',
      header: t.fields.storageLocation,
      render: (row) =>
        row.erpStorageLocationCode === undefined || row.erpStorageLocationCode === ''
          ? t.values.missing
          : storageLocationOf(row.erpStorageLocationCode),
    },
    {
      key: 'erpReworkFlag',
      header: t.fields.rework,
      render: (row) => reworkLabel(row.erpReworkFlag),
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      render: (row) => (
        <Chip variant="status" size="sm">
          {statusNameOf(row.statusCode)}
        </Chip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <section className="pane" aria-label={t.panes.list}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane" aria-label={t.panes.list}>
      <h2>{t.panes.list}</h2>
      <div className="wide-table">
        <Table
          caption={<span className="erp-data-table-caption">{t.panes.list}</span>}
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

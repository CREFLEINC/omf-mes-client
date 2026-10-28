import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
import { displayOr, formatQty, reworkLabel } from './format';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;

export interface ErpProductionOrderListPaneProps {
  rows: ErpProductionOrder[];
  isLoading: boolean;
  page: PageView;
  itemNameOf: (itemId: number) => string;
  uomNameOf: (uomId: number) => string;
  storageLocationOf: (code: string) => string;
  statusNameOf: (code: string) => string;
  onChangePage: (page: number) => void;
}

/**
 * ERP W/O 목록 — 화면 틀(`BoardFrame`)의 한 구획 내용(상세가 없어 전체 폭을 쓴다). 쪽 이동 말고는 조작이 없다 — 읽기
 * 전용 화면이고, 줄을 고르는 일도 없다.
 */
export const ErpProductionOrderListPane = ({
  rows,
  isLoading,
  page,
  itemNameOf,
  uomNameOf,
  storageLocationOf,
  statusNameOf,
  onChangePage,
}: ErpProductionOrderListPaneProps) => {
  /*
   * 납기 열은 이 쪽에 납기가 있는 행이 있을 때만 세운다. ERP W/O 의 날짜는 계획 시작일 하나이고
   * 납기는 비어 온다(장부 P-66) — 늘 「-」뿐인 열이 표 폭을 먹지 않게 한다.
   */
  const hasDueDate = rows.some((row) => row.dueDate !== undefined && row.dueDate !== '');

  const columns: Column<ErpProductionOrder>[] = [
    { key: 'productionOrderNo', header: t.fields.productionOrderNo, width: '152px' },
    {
      key: 'itemId',
      header: t.fields.item,
      render: (row) => <OneLine text={itemNameOf(row.itemId)} />,
    },
    {
      key: 'orderQty',
      header: t.fields.orderQty,
      width: '112px',
      align: 'end',
      render: (row) => t.values.qtyWithUom(formatQty(row.orderQty), uomNameOf(row.uomId)),
    },
    {
      key: 'plannedStartDate',
      header: t.fields.plannedStartDate,
      width: '104px',
      render: (row) => displayOr(row.plannedStartDate),
    },
    ...(hasDueDate
      ? [
          {
            key: 'dueDate',
            header: t.fields.dueDate,
            width: '104px',
            render: (row: ErpProductionOrder) => displayOr(row.dueDate),
          },
        ]
      : []),
    {
      key: 'erpOperationNo',
      header: t.fields.operationNo,
      width: '80px',
      render: (row) => displayOr(row.erpOperationNo),
    },
    {
      key: 'erpStorageLocationCode',
      header: t.fields.storageLocation,
      width: '128px',
      render: (row) => (
        <OneLine
          text={
            row.erpStorageLocationCode === undefined || row.erpStorageLocationCode === ''
              ? t.values.missing
              : storageLocationOf(row.erpStorageLocationCode)
          }
        />
      ),
    },
    {
      key: 'erpReworkFlag',
      header: t.fields.rework,
      width: '72px',
      render: (row) => reworkLabel(row.erpReworkFlag),
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      width: '88px',
      render: (row) => (
        <Chip variant="status" size="sm">
          {statusNameOf(row.statusCode)}
        </Chip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <>
      <BoardTable
        label={t.panes.list}
        widthKey="omf-mes:erp-production-order:columns:orders"
        /* 납기 열이 서면 그 폭(104px)만큼 넓힌다. */
        minWidth={hasDueDate ? '63rem' : '56rem'}
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.productionOrderId)}
        sort={null}
        empty={
          <EmptyState
            size="sm"
            live
            title={page.isBeyondLast ? t.empty.beyondTitle : t.empty.title}
          />
        }
      />
      <PageNav view={page} onChange={onChangePage} />
    </>
  );
};

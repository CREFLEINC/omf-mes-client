import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { OneLine } from '../../patterns/po-board';
import { ErpDetailFields, ErpListTable, ErpPickEmpty } from '../erp-item/erp-data-parts';
import { displayOr, formatQty, reworkLabel } from './format';
import { ProgressChip } from './progress';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;

export interface ErpProductionOrderNames {
  itemNameOf: (itemId: number) => string;
  uomNameOf: (uomId: number) => string;
  storageLocationOf: (code: string) => string;
  statusNameOf: (code: string) => string;
}

const storageLocationLabel = (row: ErpProductionOrder, names: ErpProductionOrderNames): string =>
  row.erpStorageLocationCode === undefined || row.erpStorageLocationCode === ''
    ? t.values.missing
    : names.storageLocationOf(row.erpStorageLocationCode);

const StatusChip = ({ label }: { label: string }) => (
  <Chip variant="status" size="sm">
    {label}
  </Chip>
);

export interface ErpProductionOrderListPaneProps extends ErpProductionOrderNames {
  rows: ErpProductionOrder[];
  isLoading: boolean;
  isBeyondLast: boolean;
  selectedId: number | null;
  onSelect: (row: ErpProductionOrder) => void;
}

/**
 * ERP W/O 목록 — 식별에 필요한 열만(번호 · 품목 · 수량 · 계획 시작일 · 진행 · 상태). 나머지 칸은 고른 줄의 상세에 있다
 * (omf-all-around#358). 쪽 이동은 화면이 목록 아래에 둔다.
 */
export const ErpProductionOrderListPane = ({
  rows,
  isLoading,
  isBeyondLast,
  selectedId,
  onSelect,
  ...names
}: ErpProductionOrderListPaneProps) => {
  const columns: Column<ErpProductionOrder>[] = [
    { key: 'productionOrderNo', header: t.fields.productionOrderNo, width: '152px' },
    {
      key: 'itemId',
      header: t.fields.item,
      width: '200px',
      render: (row) => <OneLine text={names.itemNameOf(row.itemId)} />,
    },
    {
      key: 'orderQty',
      header: t.fields.orderQty,
      width: '112px',
      align: 'end',
      render: (row) => t.values.qtyWithUom(formatQty(row.orderQty), names.uomNameOf(row.uomId)),
    },
    {
      key: 'plannedStartDate',
      header: t.fields.plannedStartDate,
      width: '104px',
      render: (row) => displayOr(row.plannedStartDate),
    },
    {
      key: 'progressStatusCode',
      header: t.fields.progress,
      width: '96px',
      render: (row) => <ProgressChip code={row.progressStatusCode} />,
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      width: '88px',
      render: (row) => <StatusChip label={names.statusNameOf(row.statusCode)} />,
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
    <ErpListTable
      label={t.panes.list}
      storageKey="omf-mes:erp-production-order:columns:orders"
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.productionOrderId)}
      pick={{
        currentId: selectedId === null ? null : String(selectedId),
        onPick: onSelect,
      }}
      empty={
        <EmptyState size="sm" live title={isBeyondLast ? t.empty.beyondTitle : t.empty.title} />
      }
    />
  );
};

/** 고른 ERP W/O 의 모든 칸 — 같은 목록 응답만 쓴다(상세 요청을 따로 보내지 않는다). */
export const ErpProductionOrderDetail = ({
  row,
  ...names
}: ErpProductionOrderNames & { row: ErpProductionOrder | null }) => {
  if (row === null) {
    return (
      <ErpPickEmpty
        icon="factory"
        title={t.empty.pickTitle}
        description={t.empty.pickDescription}
      />
    );
  }

  return (
    <ErpDetailFields
      title={t.panes.detail}
      fields={[
        { key: 'no', label: t.fields.productionOrderNo, value: row.productionOrderNo },
        { key: 'item', label: t.fields.item, value: names.itemNameOf(row.itemId) },
        {
          key: 'qty',
          label: t.fields.orderQty,
          value: t.values.qtyWithUom(formatQty(row.orderQty), names.uomNameOf(row.uomId)),
        },
        {
          key: 'plannedStartDate',
          label: t.fields.plannedStartDate,
          value: displayOr(row.plannedStartDate),
        },
        { key: 'dueDate', label: t.fields.dueDate, value: displayOr(row.dueDate) },
        { key: 'operationNo', label: t.fields.operationNo, value: displayOr(row.erpOperationNo) },
        {
          key: 'storageLocation',
          label: t.fields.storageLocation,
          value: storageLocationLabel(row, names),
        },
        { key: 'rework', label: t.fields.rework, value: reworkLabel(row.erpReworkFlag) },
        {
          key: 'progress',
          label: t.fields.progress,
          value: <ProgressChip code={row.progressStatusCode} />,
        },
        {
          key: 'status',
          label: t.fields.status,
          value: <StatusChip label={names.statusNameOf(row.statusCode)} />,
        },
      ]}
    />
  );
};

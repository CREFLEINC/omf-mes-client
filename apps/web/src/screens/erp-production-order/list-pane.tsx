import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { OneLine } from '../../patterns/po-board';
import { splitCodeName } from '../../patterns/split-code-name';
import { ErpListTable } from '../erp-item/erp-data-parts';
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
}

/**
 * ERP W/O 목록 — 번호 · 품목 · 수량 · 계획 시작일 · 납기일 · 공정 번호 · 창고 · 재작업 여부 · 진행 · 상태. 납기일 ~ 재작업
 * 여부는 레이아웃 통일(#358) 때 상세로만 옮겼던 열을 되살렸다(사용자 지시 2026-11-24). 쪽 이동은 화면이 목록 아래에 둔다.
 */
export const ErpProductionOrderListPane = ({
  rows,
  isLoading,
  isBeyondLast,
  ...names
}: ErpProductionOrderListPaneProps) => {
  const hasDueDate = rows.some((row) => row.dueDate !== undefined && row.dueDate !== '');
  const columns: Column<ErpProductionOrder>[] = [
    /* 번호 끝이 「…」로 잘리지 않는 폭(사용자 지시 2026-11-25 목록만 보이게 바꾸며). */
    { key: 'productionOrderNo', header: t.fields.productionOrderNo, width: '184px' },
    /* 품목코드 · 품목명은 두 열(사용자 지시 2026-11-24 — 구매발주 상세 품목 표와 같은 모양). */
    {
      key: 'itemId',
      header: t.fields.itemCode,
      width: '120px',
      render: (row) => (
        <OneLine text={splitCodeName(names.itemNameOf(row.itemId), t.values.missing).code} />
      ),
    },
    {
      key: 'itemName',
      header: t.fields.itemName,
      width: '160px',
      render: (row) => (
        <OneLine text={splitCodeName(names.itemNameOf(row.itemId), t.values.missing).name} />
      ),
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
    /*
     * 납기 열은 이 쪽에 납기가 있는 행이 있을 때만 세운다. ERP W/O 의 날짜는 계획 시작일 하나이고
     * 납기는 비어 온다(장부 P-66) — 늘 「-」뿐인 열이 표 폭을 먹지 않게 한다.
     */
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
      width: '88px',
      render: (row) => displayOr(row.erpOperationNo),
    },
    {
      key: 'erpStorageLocationCode',
      header: t.fields.storageLocation,
      width: '128px',
      render: (row) => <OneLine text={storageLocationLabel(row, names)} />,
    },
    {
      key: 'erpReworkFlag',
      header: t.fields.rework,
      width: '96px',
      render: (row) => reworkLabel(row.erpReworkFlag),
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
      /* 열이 열 안팎 — 줄여 잘리지 않게 가로로 구른다(사용자 지시 2026-11-24 열 되살림). */
      scrollX
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.productionOrderId)}
      /* 줄을 눌러 하는 일이 없다 — 눌리는 것처럼 보이지 않게(사용자 지시 2026-11-25). */
      className="erp-data-list-static"
      empty={
        <EmptyState size="sm" live title={isBeyondLast ? t.empty.beyondTitle : t.empty.title} />
      }
    />
  );
};

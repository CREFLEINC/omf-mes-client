import { AlertBanner, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { BoardTable } from '../../patterns/board-table';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { OneLine } from '../../patterns/po-board';

import type { PurchaseOrderDetail, PurchaseOrderLine } from './types';

const t = messages.erpPurchaseOrder;

const displayOr = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missing : value;

const formatQty = (value: number): string => value.toLocaleString();

/**
 * 고른 건의 표시 상태. 네 갈래를 타입으로 가른다 — 「안 고름」과 「불러오는 중」과 「실패」를
 * 한 빈 상태로 뭉개면 실패가 「라인이 없습니다」로 읽힌다.
 */
export type DetailState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; data: PurchaseOrderDetail };

export interface ErpPurchaseOrderDetailPaneProps {
  state: DetailState;
  supplierNameOf: (id: number) => string;
  plantNameOf: (id: number) => string;
  statusNameOf: (code: string) => string;
  itemNameOf: (id: number) => string;
  uomNameOf: (id: number) => string;
  /** 공통코드 이름 — 서버 #737 · P-67 의 ERP 원본 코드 칸 */
  orderTypeNameOf: (code: string | null | undefined) => string;
  purchaseGroupNameOf: (code: string | null | undefined) => string;
  storageLocationNameOf: (code: string | null | undefined) => string;
}

/** 라인 취소 표시 — 취소 표지와 ERP 가 취소를 보낸 시각(공장 시각). 취소되지 않았으면 「-」 */
const renderCancelled = (cancelledAt: string | null | undefined) => {
  if (cancelledAt === null || cancelledAt === undefined || cancelledAt === '') {
    return t.values.missing;
  }
  return (
    <>
      <Chip variant="status" status="error" size="sm">
        {t.values.cancelled}
      </Chip>{' '}
      {formatPlantDateTime(cancelledAt) ?? cancelledAt}
    </>
  );
};

export const ErpPurchaseOrderDetailPane = ({
  state,
  supplierNameOf,
  plantNameOf,
  statusNameOf,
  itemNameOf,
  uomNameOf,
  orderTypeNameOf,
  purchaseGroupNameOf,
  storageLocationNameOf,
}: ErpPurchaseOrderDetailPaneProps) => {
  if (state.kind === 'idle') {
    return (
      <>
        <h2 className="pane-title">{t.panes.detail}</h2>
        <EmptyState size="sm" title={t.empty.notSelectedTitle} />
      </>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  if (state.kind === 'failed') {
    return (
      <AlertBanner variant="error" title={t.detailLoadFailedTitle}>
        {t.loadFailedDescription}
      </AlertBanner>
    );
  }

  const { purchaseOrder: header, lines } = state.data;
  const fields = [
    { key: 'no', label: t.fields.purchaseOrderNo, value: header.purchaseOrderNo },
    { key: 'supplier', label: t.fields.supplier, value: supplierNameOf(header.supplierId) },
    { key: 'plant', label: t.fields.plant, value: plantNameOf(header.plantId) },
    { key: 'orderDate', label: t.fields.orderDate, value: header.orderDate },
    {
      key: 'expected',
      label: t.fields.expectedReceiptDate,
      value: displayOr(header.expectedReceiptDate),
    },
    { key: 'status', label: t.fields.status, value: statusNameOf(header.statusCode) },
    {
      key: 'orderType',
      label: t.fields.orderType,
      value: orderTypeNameOf(header.erpOrderTypeCode),
    },
    {
      key: 'purchaseGroup',
      label: t.fields.purchaseGroup,
      value: purchaseGroupNameOf(header.erpPurchaseGroupCode),
    },
    /* 입출고 유형은 코드 그룹이 없어 원본 코드를 그대로 보인다. */
    { key: 'ioType', label: t.fields.ioType, value: displayOr(header.erpIoTypeCode) },
  ];

  /* 잔량은 서버가 내리지 않는다 — 발주에서 입하를 뺀 값을 표시로만 보인다(0 아래로 내리지 않는다). */
  const columns: Column<PurchaseOrderLine>[] = [
    { key: 'lineNo', header: t.fields.lineNo, width: '56px', align: 'end' },
    {
      key: 'itemId',
      header: t.fields.item,
      render: (row) => <OneLine text={itemNameOf(row.itemId)} />,
    },
    {
      key: 'orderedQty',
      header: t.fields.orderedQty,
      width: '88px',
      align: 'end',
      render: (row) => formatQty(row.orderedQty),
    },
    {
      key: 'receivedQty',
      header: t.fields.receivedQty,
      width: '88px',
      align: 'end',
      render: (row) => formatQty(row.receivedQty),
    },
    {
      key: 'remainingQty',
      header: t.fields.remainingQty,
      width: '88px',
      align: 'end',
      render: (row) => formatQty(Math.max(0, row.orderedQty - row.receivedQty)),
    },
    { key: 'uomId', header: t.fields.uom, width: '64px', render: (row) => uomNameOf(row.uomId) },
    {
      key: 'tolerance',
      header: t.fields.tolerance,
      width: '128px',
      align: 'end',
      render: (row) => `${formatQty(row.toleranceOverQty)} / ${formatQty(row.toleranceUnderQty)}`,
    },
    {
      key: 'erpStorageLocationCode',
      header: t.fields.storageLocation,
      width: '104px',
      render: (row) => <OneLine text={storageLocationNameOf(row.erpStorageLocationCode)} />,
    },
    {
      key: 'cancelledAt',
      header: t.fields.cancelled,
      width: '184px',
      render: (row) => renderCancelled(row.cancelledAt),
    },
  ];

  /*
   * 화면 틀(`BoardFrame`)의 오른쪽 구획 내용 — 머리 사실 칸(입고 관리 라인 머리와 같은 모양) 다음 라인 표. 구획이 통째로
   * 스크롤한다.
   */
  return (
    <>
      <h2 className="pane-title">{t.panes.detail}</h2>
      <dl className="po-board-order-facts">
        {fields.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      <section className="board-frame-sub" aria-label={t.panes.lines}>
        <h2 className="pane-title">{t.panes.lines}</h2>
        <BoardTable
          label={t.panes.lines}
          widthKey="omf-mes:erp-purchase-order:columns:lines"
          minWidth="60rem"
          columns={columns}
          rows={lines}
          getRowId={(row) => String(row.purchaseOrderLineId)}
          sort={null}
          empty={<EmptyState size="sm" title={t.empty.linesTitle} />}
        />
      </section>
    </>
  );
};

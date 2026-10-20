import {
  AlertBanner,
  Card,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';

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
      <section className="pane" aria-label={t.panes.detail}>
        <h2>{t.panes.detail}</h2>
        <EmptyState
          size="sm"
          title={t.empty.notSelectedTitle}
          description={t.empty.notSelectedDescription}
        />
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section className="pane" aria-label={t.panes.detail}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }

  if (state.kind === 'failed') {
    return (
      <section className="pane" aria-label={t.panes.detail}>
        <AlertBanner variant="error" title={t.detailLoadFailedTitle}>
          {t.loadFailedDescription}
        </AlertBanner>
      </section>
    );
  }

  const { purchaseOrder: header, lines } = state.data;
  const fields = [
    { key: 'no', label: t.fields.purchaseOrderNo, value: header.purchaseOrderNo },
    { key: 'erp', label: t.fields.erpPurchaseOrderNo, value: displayOr(header.erpPurchaseOrderNo) },
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
    { key: 'lineNo', header: t.fields.lineNo, align: 'end' },
    { key: 'itemId', header: t.fields.item, render: (row) => itemNameOf(row.itemId) },
    {
      key: 'orderedQty',
      header: t.fields.orderedQty,
      align: 'end',
      render: (row) => formatQty(row.orderedQty),
    },
    {
      key: 'receivedQty',
      header: t.fields.receivedQty,
      align: 'end',
      render: (row) => formatQty(row.receivedQty),
    },
    {
      key: 'remainingQty',
      header: t.fields.remainingQty,
      align: 'end',
      render: (row) => formatQty(Math.max(0, row.orderedQty - row.receivedQty)),
    },
    { key: 'uomId', header: t.fields.uom, render: (row) => uomNameOf(row.uomId) },
    {
      key: 'tolerance',
      header: t.fields.tolerance,
      align: 'end',
      render: (row) => `${formatQty(row.toleranceOverQty)} / ${formatQty(row.toleranceUnderQty)}`,
    },
    {
      key: 'erpStorageLocationCode',
      header: t.fields.storageLocation,
      render: (row) => storageLocationNameOf(row.erpStorageLocationCode),
    },
    {
      key: 'cancelledAt',
      header: t.fields.cancelled,
      render: (row) => renderCancelled(row.cancelledAt),
    },
  ];

  return (
    <>
      <section className="pane" aria-label={t.panes.detail}>
        <h2>{t.panes.detail}</h2>
        <Card bordered>
          <Card.Body>
            <dl>
              {fields.map((field) => (
                <div key={field.key}>
                  <dt className="field-label">{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </Card.Body>
        </Card>
      </section>
      <section className="pane" aria-label={t.panes.lines}>
        <h2>{t.panes.lines}</h2>
        <div className="wide-table">
          <Table
            caption={<span className="erp-data-table-caption">{t.panes.lines}</span>}
            density="compact"
            columns={columns}
            rows={lines}
            getRowId={(row) => String(row.purchaseOrderLineId)}
            sort={null}
            empty={
              <EmptyState
                size="sm"
                title={t.empty.linesTitle}
                description={t.empty.linesDescription}
              />
            }
          />
        </div>
      </section>
    </>
  );
};

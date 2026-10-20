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

import type { SalesOrder, SalesOrderLine } from './types';

const t = messages.erpSalesOrder;

const displayOr = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missing : value;

const formatQty = (value: number): string => value.toLocaleString();

/**
 * 고른 건의 표시 상태. 네 갈래를 타입으로 가른다 — 「안 고름」과 「불러오는 중」과 「실패」를
 * 한 빈 상태로 뭉개면 실패가 「라인이 없습니다」로 읽힌다.
 */
export type DetailState =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: SalesOrder };

export interface ErpSalesOrderDetailPaneProps {
  state: DetailState;
  partnerNameOf: (id: number) => string;
  itemNameOf: (id: number) => string;
  uomNameOf: (id: number) => string;
  statusNameOf: (code: string) => string;
  /** 공통코드 이름 — 서버 #737 · P-67 의 ERP 원본 코드 칸 */
  orderTypeNameOf: (code: string | null | undefined) => string;
  salesGroupNameOf: (code: string | null | undefined) => string;
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

export const ErpSalesOrderDetailPane = ({
  state,
  partnerNameOf,
  itemNameOf,
  uomNameOf,
  statusNameOf,
  orderTypeNameOf,
  salesGroupNameOf,
  storageLocationNameOf,
}: ErpSalesOrderDetailPaneProps) => {
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

  const order = state.data;
  /* 계약상 `lines` 는 선택 필드다 — 오지 않으면 빈 라인으로 읽는다. */
  const lines = order.lines ?? [];
  const fields = [
    { key: 'no', label: t.fields.salesOrderNo, value: order.salesOrderNo },
    { key: 'erp', label: t.fields.erpSalesOrderNo, value: displayOr(order.erpSalesOrderNo) },
    { key: 'customer', label: t.fields.customer, value: partnerNameOf(order.customerId) },
    { key: 'shipTo', label: t.fields.shipTo, value: partnerNameOf(order.shipToPartnerId) },
    { key: 'orderDate', label: t.fields.orderDate, value: order.orderDate },
    { key: 'status', label: t.fields.status, value: statusNameOf(order.statusCode) },
    { key: 'orderType', label: t.fields.orderType, value: orderTypeNameOf(order.erpOrderTypeCode) },
    {
      key: 'salesGroup',
      label: t.fields.salesGroup,
      value: salesGroupNameOf(order.erpSalesGroupCode),
    },
    /* 이동 유형은 코드 그룹이 없어 원본 코드를 그대로 보인다. */
    {
      key: 'movementType',
      label: t.fields.movementType,
      value: displayOr(order.erpMovementTypeCode),
    },
  ];

  /* 잔량은 서버가 내리지 않는다 — 수주에서 출하를 뺀 값을 표시로만 보인다(0 아래로 내리지 않는다). */
  const columns: Column<SalesOrderLine>[] = [
    { key: 'lineNo', header: t.fields.lineNo, align: 'end' },
    { key: 'itemId', header: t.fields.item, render: (row) => itemNameOf(row.itemId) },
    {
      key: 'orderedQty',
      header: t.fields.orderedQty,
      align: 'end',
      render: (row) => formatQty(row.orderedQty),
    },
    {
      key: 'shippedQty',
      header: t.fields.shippedQty,
      align: 'end',
      render: (row) => formatQty(row.shippedQty),
    },
    {
      key: 'remainingQty',
      header: t.fields.remainingQty,
      align: 'end',
      render: (row) => formatQty(Math.max(0, row.orderedQty - row.shippedQty)),
    },
    { key: 'uomId', header: t.fields.uom, render: (row) => uomNameOf(row.uomId) },
    {
      key: 'requestedDeliveryDate',
      header: t.fields.requestedDeliveryDate,
      render: (row) => displayOr(row.requestedDeliveryDate),
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
            getRowId={(row) => String(row.salesOrderLineId)}
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

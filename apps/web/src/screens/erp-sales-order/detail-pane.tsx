import { AlertBanner, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useClientPage, type TabPageSize } from '../../patterns/client-page';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { OneLine } from '../../patterns/po-board';
import { ErpDetailFields, ErpListTable, ErpPickEmpty } from '../erp-item/erp-data-parts';

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

/** 「코드 · 이름」을 두 칸으로 나눈다(사용자 지시 2026-11-24). 이름을 못 풀었으면(불러오는 중 · 없음) 안내를 코드 칸에 둔다. */
const splitCodeName = (label: string): { code: string; name: string } => {
  const at = label.indexOf(' · ');
  return at < 0
    ? { code: label, name: t.values.missing }
    : { code: label.slice(0, at), name: label.slice(at + 3) };
};

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
      <ErpPickEmpty
        icon="receipt_long"
        title={t.empty.notSelectedTitle}
        description={t.empty.notSelectedDescription}
      />
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

  const order = state.data;
  /* 계약상 `lines` 는 선택 필드다 — 오지 않으면 빈 라인으로 읽는다. */
  const lines = order.lines ?? [];
  const fields = [
    { key: 'no', label: t.fields.salesOrderNo, value: order.salesOrderNo },
    { key: 'customer', label: t.fields.customer, value: partnerNameOf(order.customerId) },
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

  /* 미출하 수량은 서버가 내리지 않는다 — 수주에서 출하를 뺀 값을 표시로만 보인다(0 아래로 내리지 않는다). */
  /* 수량은 단위를 붙여 보인다 — 단위 칸은 따로 두지 않는다(사용자 지시 2026-11-24). */
  const withUom = (qty: number, uomId: number): string => `${formatQty(qty)} ${uomNameOf(uomId)}`;
  const columns: Column<SalesOrderLine>[] = [
    { key: 'lineNo', header: t.fields.lineNo, width: '72px', align: 'end' },
    {
      key: 'itemId',
      header: t.fields.itemCode,
      width: '120px',
      render: (row) => <OneLine text={splitCodeName(itemNameOf(row.itemId)).code} />,
    },
    {
      key: 'itemName',
      header: t.fields.itemName,
      width: '160px',
      render: (row) => <OneLine text={splitCodeName(itemNameOf(row.itemId)).name} />,
    },
    {
      key: 'orderedQty',
      header: t.fields.orderedQty,
      width: '104px',
      align: 'end',
      render: (row) => withUom(row.orderedQty, row.uomId),
    },
    {
      key: 'shippedQty',
      header: t.fields.shippedQty,
      width: '104px',
      align: 'end',
      render: (row) => withUom(row.shippedQty, row.uomId),
    },
    {
      key: 'remainingQty',
      header: t.fields.remainingQty,
      width: '112px',
      align: 'end',
      render: (row) => withUom(Math.max(0, row.orderedQty - row.shippedQty), row.uomId),
    },
    {
      key: 'requestedDeliveryDate',
      header: t.fields.requestedDeliveryDate,
      width: '104px',
      render: (row) => displayOr(row.requestedDeliveryDate),
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

  /* 머리 칸은 「이름 : 값」, 그 아래 라인 표(열 조절 · 화면 안 쪽 넘김 · #358). 상자가 통째로 스크롤한다. */
  return (
    <div className="erp-data-detail">
      <ErpDetailFields title={t.panes.detail} fields={fields} />
      <Lines columns={columns} rows={lines} />
    </div>
  );
};

/** 라인 표 — 다 받은 라인을 화면에서 쪽으로 나눈다. 고른 건이 바뀌면 상자가 새로 서므로 첫 쪽부터다. */
const Lines = ({
  columns,
  rows,
}: {
  columns: Column<SalesOrderLine>[];
  rows: SalesOrderLine[];
}) => {
  const paged = useClientPage(rows);
  return (
    <section className="erp-data-sub" aria-label={t.panes.lines}>
      <div className="erp-data-sub-head">
        <h2 className="pane-title">{t.panes.lines}</h2>
      </div>
      <div className="erp-data-sub-scroll">
        <ErpListTable
          label={t.panes.lines}
          storageKey="omf-mes:erp-sales-order:columns:lines"
          columns={columns}
          rows={paged.rows}
          getRowId={(row) => String(row.salesOrderLineId)}
          empty={<EmptyState size="sm" title={t.empty.linesTitle} />}
        />
      </div>
      <PageNav<TabPageSize> {...paged.nav} buttonSize="md" />
    </section>
  );
};

import { AlertBanner, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useClientPage, type TabPageSize } from '../../patterns/client-page';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { OneLine } from '../../patterns/po-board';
import { ErpDetailFields, ErpListTable, ErpPickEmpty } from '../erp-item/erp-data-parts';

import { formatCustomsClearance } from './customs-clearance';
import { isForeignOrder, type PurchaseOrderDetail, type PurchaseOrderLine } from './types';

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
  /** 라인 표 머리 오른쪽 — 외자 발주의 [통관번호 받아오기]. 세울지는 화면이 정한다(권한 · 발주 유형). */
  linesAction?: ReactNode;
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
  linesAction = null,
}: ErpPurchaseOrderDetailPaneProps) => {
  if (state.kind === 'idle') {
    return (
      <ErpPickEmpty
        icon="shopping_cart"
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
  /* 수량은 단위를 붙여 보인다 — 단위 칸은 따로 두지 않는다(사용자 지시 2026-11-24). */
  const withUom = (qty: number, uomId: number): string => `${formatQty(qty)} ${uomNameOf(uomId)}`;
  const columns: Column<PurchaseOrderLine>[] = [
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
      key: 'receivedQty',
      header: t.fields.receivedQty,
      width: '104px',
      align: 'end',
      render: (row) => withUom(row.receivedQty, row.uomId),
    },
    {
      key: 'remainingQty',
      header: t.fields.remainingQty,
      width: '104px',
      align: 'end',
      render: (row) => withUom(Math.max(0, row.orderedQty - row.receivedQty), row.uomId),
    },
    {
      key: 'tolerance',
      header: t.fields.tolerance,
      width: '144px',
      align: 'end',
      render: (row) =>
        `${formatQty(row.toleranceOverQty)} / ${withUom(row.toleranceUnderQty, row.uomId)}`,
    },
    /* 통관번호 / 순번 — 외자 발주에만 있는 칸이라 그때만 세운다(omf-all-around#206). */
    ...(isForeignOrder(header)
      ? [
          {
            key: 'erpCustomsClearanceNo',
            header: t.fields.customsClearance,
            width: '152px',
            render: (row: PurchaseOrderLine) => (
              <OneLine
                text={
                  formatCustomsClearance(row.erpCustomsClearanceNo, row.erpCustomsClearanceSeq) ??
                  t.values.missing
                }
              />
            ),
          },
        ]
      : []),
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
    <div className="erp-data-detail erp-data-detail-fill">
      <ErpDetailFields title={t.panes.detail} fields={fields} />
      <Lines columns={columns} rows={lines} linesAction={linesAction} />
    </div>
  );
};

/** 라인 표 — 다 받은 라인을 화면에서 쪽으로 나눈다. 고른 건이 바뀌면 상자가 새로 서므로 첫 쪽부터다. */
const Lines = ({
  columns,
  rows,
  linesAction,
}: {
  columns: Column<PurchaseOrderLine>[];
  rows: PurchaseOrderLine[];
  linesAction: ReactNode;
}) => {
  const paged = useClientPage(rows);
  return (
    <section className="erp-data-sub" aria-label={t.panes.lines}>
      <div className="erp-data-sub-head">
        <h2 className="pane-title">{t.panes.lines}</h2>
        {linesAction}
      </div>
      <div className="erp-data-sub-scroll">
        <ErpListTable
          label={t.panes.lines}
          storageKey="omf-mes:erp-purchase-order:columns:lines"
          columns={columns}
          rows={paged.rows}
          getRowId={(row) => String(row.purchaseOrderLineId)}
          empty={<EmptyState size="sm" title={t.empty.linesTitle} />}
        />
      </div>
      <PageNav<TabPageSize> {...paged.nav} buttonSize="md" />
    </section>
  );
};

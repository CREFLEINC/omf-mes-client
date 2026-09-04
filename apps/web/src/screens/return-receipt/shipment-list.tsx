import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import { formatQty, type ShipmentRow } from './types';

const t = messages.returnReceipt;

export interface ShipmentListProps {
  rows: ShipmentRow[];
  isLoading: boolean;
  error: ReactNode;
  page: PageView;
  selectedShipmentId: number | null;
  statusLookup: LookupSource;
  onSelect: (row: ShipmentRow) => void;
  onChangePage: (page: number) => void;
}

/** 상태 표시명 — 코드값이 아직 없거나 모르는 코드면 코드를 그대로 보인다. 뜻을 지어내지 않는다. */
const statusText = (lookup: LookupSource, code: string): string => {
  const label = lookupDisplayLabel(lookup, code);
  return label === messages.common.reference.unknown || label === '' ? code : label;
};

/**
 * 원 출하 목록 — 출하번호를 누르면 그 출하의 배분이 반품 라인으로 선다.
 *
 * 목록 응답에 라인이 없으면 「선택하면 보인다」로 적는다 — 빈 칸으로 두면 배분이 없는 출하처럼 읽힌다.
 */
export const ShipmentList = ({
  rows,
  isLoading,
  error,
  page,
  selectedShipmentId,
  statusLookup,
  onSelect,
  onChangePage,
}: ShipmentListProps) => {
  const columns: Column<ShipmentRow>[] = [
    {
      key: 'shipmentNo',
      header: t.fields.shipmentNo,
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          aria-label={t.actions.selectRow(row.shipmentNo)}
          aria-pressed={row.shipmentId === selectedShipmentId}
          onClick={() => onSelect(row)}
        >
          {row.shipmentNo}
        </Button>
      ),
    },
    {
      key: 'shippedAt',
      header: t.fields.shippedAt,
      width: '104px',
      render: (row) => (row.shippedAtText === '' ? t.values.notAvailable : row.shippedAtText),
    },
    {
      key: 'status',
      header: t.fields.status,
      width: '96px',
      render: (row) => (
        <Chip variant="status" size="sm">
          {statusText(statusLookup, row.statusCode)}
        </Chip>
      ),
    },
    {
      key: 'items',
      header: t.fields.items,
      render: (row) => row.itemSummary ?? t.values.notAvailable,
    },
    {
      key: 'lots',
      header: t.fields.lots,
      render: (row) =>
        row.lots === null ? (
          <span className="field-note">{t.values.unknownLots}</span>
        ) : row.lots.length === 0 ? (
          t.values.notAvailable
        ) : (
          <span className="stacked-cell">
            {row.lots.map((lot) => (
              <span key={lot.lotId}>{`${lot.lotNo} · ${formatQty(lot.qty)}`}</span>
            ))}
          </span>
        ),
    },
  ];

  if (error !== null) return <>{error}</>;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.search.loading}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="return-receipt-empty">
        <EmptyState
          size="sm"
          title={page.isBeyondLast ? t.search.beyondLast : t.search.empty}
          description={page.isBeyondLast ? undefined : t.search.emptyDescription}
          action={
            page.isBeyondLast ? (
              <Button variant="outlined" size="sm" onClick={() => onChangePage(1)}>
                {t.actions.firstPage}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="return-receipt-table">
      <Table
        density="compact"
        caption={<span className="return-receipt-table-caption">{t.panes.search}</span>}
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.shipmentId)}
      />
      <PageNav view={page} label={t.panes.search} onChange={onChangePage} />
    </div>
  );
};

import { type Column, Chip, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ShipmentGateBlocker } from './candidate-gate';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';

const t = messages.shipmentProcessing.list;

export interface ShipmentProcessingCandidateRow {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  customerLabel: string | null;
  requestedShipDate: string;
  statusCode: string;
  blockers: readonly ShipmentGateBlocker[];
}

export interface ShipmentProcessingCandidateListPaneProps {
  rows: ShipmentProcessingCandidateRow[];
  selectedShipmentRequestId: number | null;
  isLoading: boolean;
  loadError: ReactNode;
  page: PageView;
  onSelect: (shipmentRequestId: number) => void;
  onChangePage: (page: number) => void;
}

const customerLabel = (value: ShipmentProcessingCandidateRow['customerLabel']): string =>
  value === null || value.trim() === '' ? t.values.missingCustomer : value;

const GateBadge = ({ blockers }: { blockers: readonly ShipmentGateBlocker[] }) => {
  if (blockers.length === 0) {
    return (
      <Chip variant="status" status="success" size="sm">
        {t.values.ready}
      </Chip>
    );
  }

  return (
    <>
      {blockers.map((blocker) => (
        <Chip key={blocker} variant="status" status="warning" size="sm">
          {t.blockers[blocker]}
        </Chip>
      ))}
    </>
  );
};

/** 좌측 — 확정 대기 출하작업지시 목록. `work-order-close/candidate-list-pane.tsx`를 구조 원형으로 삼는다. */
export const ShipmentProcessingCandidateListPane = ({
  rows,
  selectedShipmentRequestId,
  isLoading,
  loadError,
  page,
  onSelect,
  onChangePage,
}: ShipmentProcessingCandidateListPaneProps) => {
  const columns: Column<ShipmentProcessingCandidateRow>[] = [
    {
      key: 'shipmentRequestNo',
      header: t.fields.shipmentRequestNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.select(row.shipmentRequestNo)}
          aria-current={selectedShipmentRequestId === row.shipmentRequestId ? true : undefined}
          onClick={() => {
            onSelect(row.shipmentRequestId);
          }}
        >
          {row.shipmentRequestNo}
        </button>
      ),
    },
    {
      key: 'customer',
      header: t.fields.customer,
      render: (row) => customerLabel(row.customerLabel),
    },
    { key: 'requestedShipDate', header: t.fields.requestedShipDate },
    {
      key: 'status',
      header: t.fields.status,
      render: (row) => (
        <Chip variant="status" size="sm">
          {row.statusCode}
        </Chip>
      ),
    },
    {
      key: 'gate',
      header: t.fields.gate,
      render: (row) => <GateBadge blockers={row.blockers} />,
    },
  ];

  if (loadError !== null && loadError !== undefined) {
    return (
      <section className="pane" aria-label={t.pane}>
        {loadError}
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="pane" aria-label={t.pane}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane" aria-label={t.pane}>
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.shipmentRequestId)}
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

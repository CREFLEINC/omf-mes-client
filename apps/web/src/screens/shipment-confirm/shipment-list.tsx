import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { elapsedOf, formatElapsed } from './elapsed';
import { flowOf, warehouseDisplay, type ShipmentFlow } from './rules';
import type { ErpSendStatus, ShipmentRow } from './types';

const t = messages.shipmentConfirm;

type ChipStatus = 'success' | 'error' | 'warning' | 'info' | 'idle';

/** ERP 송신 칩의 색 — 시안 W0412-After 의 표(대기 info · 보냄 ok · 오류 err · 송신 안 함 warn). */
const ERP_TONE: Record<ErpSendStatus, ChipStatus> = {
  PENDING: 'info',
  SENT: 'success',
  SEND_ERROR: 'error',
  NOT_SENT_NO_SALES_ORDER: 'warning',
  CANCELLED: 'idle',
  NOT_QUEUED: 'idle',
};

export const ErpChip = ({ status }: { status: ErpSendStatus | null }) =>
  status === null ? (
    <span>{t.list.elapsedUnknown}</span>
  ) : (
    <Chip status={ERP_TONE[status]} size="sm">
      {t.erp[status]}
    </Chip>
  );

const FLOW_TONE: Record<ShipmentFlow, ChipStatus> = {
  completed: 'success',
  legacyUnconfirmed: 'idle',
  expeditedUnconfirmed: 'idle',
  confirmed: 'success',
  cancelled: 'idle',
};

export const FlowChip = ({ row }: { row: ShipmentRow }) => {
  const flow = flowOf(row);
  if (row.cancelRequestPending && flow !== 'cancelled') {
    return (
      <Chip status="warning" size="sm">
        {t.flow.cancelPending}
      </Chip>
    );
  }
  return (
    <Chip status={FLOW_TONE[flow]} size="sm">
      {t.flow[flow]}
    </Chip>
  );
};

/** 미확정 출하만 경과를 단다 — 적체가 위험하다(§5-7). 셀 수 없으면 0 으로 접지 않는다. */
const ElapsedChip = ({ row, now }: { row: ShipmentRow; now: Date }) => {
  if (row.statusCode !== 'UNCONFIRMED') return null;
  const elapsed = elapsedOf(row, now);
  if (elapsed.level === 'unknown') return null;
  const status =
    elapsed.level === 'critical' ? 'error' : elapsed.level === 'overdue' ? 'warning' : 'idle';
  return (
    <Chip status={status} size="sm">
      {formatElapsed(elapsed)}
    </Chip>
  );
};

const WarehouseCell = ({ row }: { row: ShipmentRow }) => {
  const display = warehouseDisplay(row);
  if (display.kind === 'none') return <span>{t.list.elapsedUnknown}</span>;
  if (display.kind === 'one') return <span>{display.name}</span>;
  return (
    <span title={display.names}>
      <Chip status="idle" size="sm">
        {t.list.warehouseCount(display.count)}
      </Chip>
    </span>
  );
};

export interface ShipmentListProps {
  rows: ShipmentRow[];
  now: Date;
  selectedId: number | null;
  isLoading: boolean;
  error: ReactNode;
  onOpen: (shipmentId: number) => void;
}

/**
 * 출하 목록(피처 010).
 *
 * ⛔ **체크 칸·「모두 선택」·일괄 확정이 없다**(결정 2026-11-18) — 옛 흐름·긴급 직행은 상세에서
 * 한 건씩 확정한다. 출하번호를 누르면 상세가 열린다.
 */
export const ShipmentList = ({
  rows,
  now,
  selectedId,
  isLoading,
  error,
  onOpen,
}: ShipmentListProps) => {
  const columns: Column<ShipmentRow>[] = [
    {
      key: 'shipmentNo',
      header: t.list.fields.shipmentNo,
      render: (row) => (
        <div className="ship-history-cell">
          <Button
            variant="text"
            size="sm"
            aria-label={t.list.open(row.shipmentNo)}
            aria-pressed={row.shipmentId === selectedId}
            onClick={() => onOpen(row.shipmentId)}
          >
            {row.shipmentNo}
          </Button>
          <span className="ship-history-chips">
            <FlowChip row={row} />
            <ElapsedChip row={row} now={now} />
          </span>
        </div>
      ),
    },
    {
      key: 'shippedAt',
      header: t.list.fields.shippedAt,
      /* `yyyy-MM-dd HH:mm`(공장 시각). 못 읽으면 원문, 없으면 「—」. */
      render: (row) =>
        row.shippedAt === null ? (
          <span title={t.list.shippedAtUnknown}>{t.list.elapsedUnknown}</span>
        ) : (
          (formatPlantDateTime(row.shippedAt) ?? row.shippedAt)
        ),
    },
    {
      key: 'customerRequest',
      header: t.list.fields.customerRequest,
      render: (row) => (
        <div className="ship-history-cell">
          <span>{row.customerName ?? t.detail.noValue}</span>
          {row.shipmentRequestNo !== null && (
            <span className="field-note">{row.shipmentRequestNo}</span>
          )}
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: t.list.fields.warehouse,
      render: (row) => <WarehouseCell row={row} />,
    },
    {
      key: 'completedBy',
      header: t.list.fields.completedBy,
      render: (row) =>
        row.completedTerminalCode === null ? (
          <span>{t.list.webCreated}</span>
        ) : (
          <div className="ship-history-cell">
            <span>{row.completedTerminalCode}</span>
            {row.completedWorker !== null && (
              <span className="field-note">{row.completedWorker.workerName}</span>
            )}
          </div>
        ),
    },
    {
      key: 'erp',
      header: t.list.fields.erp,
      render: (row) => (
        <div className="ship-history-cell">
          <ErpChip status={row.erpSendStatus} />
          {row.cancelRequestPending && <span className="field-note">{t.hold}</span>}
        </div>
      ),
    },
  ];

  if (error !== null && error !== undefined) return error;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.list.loading}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <div className="wide-table">
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.shipmentId)}
        empty={
          <EmptyState size="sm" live title={t.list.empty} description={t.list.emptyDescription} />
        }
      />
    </div>
  );
};

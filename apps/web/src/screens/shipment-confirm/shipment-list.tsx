import {
  AlertBanner,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { LookupSource } from '../../patterns/lookup-display';

import type { ConfirmOutcome } from './confirm-run';
import { failureReason } from './confirm-run';
import { elapsedOf, formatElapsed } from './elapsed';
import { shipmentStatusText } from './lookups';
import { isBatchExcluded } from './selection';
import type { ShipmentRow } from './types';

const t = messages.shipmentConfirm;

export interface ShipmentListProps {
  rows: ShipmentRow[];
  now: Date;
  selected: readonly number[];
  isLoading: boolean;
  error: ReactNode;
  /** 직전 확정에서 실패한 건들. 행에 사유를 붙인다. */
  failures: readonly ConfirmOutcome[];
  /** 출하 상태 표시명(`SHIPMENT_STATUS`). 없으면 코드를 그대로 보인다. */
  statusLookup: LookupSource;
  onToggle: (shipmentId: number) => void;
  onToggleAll: () => void;
}

const ElapsedCell = ({ row, now }: { row: ShipmentRow; now: Date }) => {
  const elapsed = elapsedOf(row, now);

  if (elapsed.level === 'unknown') {
    /* ⚠ 셀 수 없는 것을 0으로 접지 않는다 — 접으면 가장 오래 적체된 건이 「방금」으로 보인다. */
    return <span title={t.list.shippedAtUnknown}>{t.list.elapsedUnknown}</span>;
  }

  const text = formatElapsed(elapsed);
  if (elapsed.level === 'critical') return <Chip status="error">{text}</Chip>;
  if (elapsed.level === 'overdue') return <Chip status="warning">{text}</Chip>;

  return <span>{text}</span>;
};

/**
 * 미확정 출하 목록.
 *
 * ⚠ **3일 경과 건은 「모두 선택」에 담기지 않는다**(§6) — 위험한 것을 한 번에 쓸어 담지 않게
 * 하는 것이 목적이다. 개별로는 고를 수 있다. 못 하게 막는 것이 아니다.
 */
export const ShipmentList = ({
  rows,
  now,
  selected,
  isLoading,
  error,
  failures,
  statusLookup,
  onToggle,
  onToggleAll,
}: ShipmentListProps) => {
  const chosen = new Set(selected);
  const failureOf = (shipmentId: number): ConfirmOutcome | undefined =>
    failures.find((outcome) => outcome.shipmentId === shipmentId);

  const columns: Column<ShipmentRow>[] = [
    {
      key: 'select',
      header: (
        <Checkbox
          aria-label={t.list.selectAll}
          checked={rows.length > 0 && rows.every((row) => chosen.has(row.shipmentId))}
          onChange={onToggleAll}
        />
      ),
      render: (row) => (
        <Checkbox
          aria-label={t.list.selectRow(row.shipmentNo)}
          checked={chosen.has(row.shipmentId)}
          onChange={() => onToggle(row.shipmentId)}
        />
      ),
    },
    { key: 'shipmentNo', header: t.list.fields.shipmentNo, render: (row) => row.shipmentNo },
    {
      key: 'shippedAt',
      header: t.list.fields.shippedAt,
      render: (row) => row.shippedAt ?? t.list.elapsedUnknown,
    },
    {
      key: 'elapsed',
      header: t.list.fields.elapsed,
      render: (row) => <ElapsedCell row={row} now={now} />,
    },
    {
      key: 'status',
      header: t.list.fields.status,
      render: (row) => shipmentStatusText(statusLookup, row.statusCode),
    },
    {
      key: 'erpDeliveryNo',
      header: t.list.fields.erpDeliveryNo,
      /* G-9 — 확정 직후에는 아직 번호가 없다. 빈칸으로 두면 「실패」로 읽힌다. */
      render: (row) => row.erpDeliveryNo ?? t.list.erpPending,
    },
    {
      key: 'note',
      header: '',
      render: (row) => {
        const failure = failureOf(row.shipmentId);
        if (failure?.failure != null) {
          return <Chip status="error">{failureReason(failure.failure)}</Chip>;
        }
        return isBatchExcluded(row, now) ? <span>{t.hold.excludedFromBatch}</span> : null;
      },
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
    <>
      {/*
       * A-11 — **목록이 못 보이는 것 둘을 목록 머리에 적는다.** 조용히 빼면 「없는 기능」이
       * 아니라 「없는 데이터」로 읽힌다. 배너를 둘로 나누지 않는 이유는 둘 다 「이 표가 무엇을
       * 못 보이는가」에 대한 말이라서다 — 나누면 머리가 배너로 덮인다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="info">
          {t.withdrawn.cancelPendingUnknown} {t.withdrawn.confirmedBy}
        </AlertBanner>
      </div>
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.shipmentId)}
        empty={
          <EmptyState size="sm" live title={t.list.empty} description={t.list.emptyDescription} />
        }
      />
    </>
  );
};

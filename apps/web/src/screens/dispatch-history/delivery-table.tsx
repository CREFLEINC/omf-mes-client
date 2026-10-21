import { Chip, EmptyState, Table, type ChipStatus, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import type { Delivery, DeliveryStatus } from './types';

const t = messages.dispatchHistory;

/** 화면이 보이는 네 상태. `SENDING` 은 러너가 보내는 중인 짧은 내부 상태라 「대기」로 합친다. */
export type DeliveryView = keyof typeof t.deliveryStatus;

export const toDeliveryView = (status: DeliveryStatus): DeliveryView =>
  status === 'SENDING' ? 'PENDING' : status;

const CHIP: Record<DeliveryView, ChipStatus> = {
  PENDING: 'info',
  SENT: 'success',
  FAILED: 'error',
  EXPIRED: 'idle',
};

export const DeliveryTable = ({ rows }: { rows: Delivery[] }) => {
  const columns: Column<Delivery>[] = [
    { key: 'recipient', header: t.columns.recipient, render: (row) => row.recipientName },
    { key: 'phone', header: t.columns.phone, render: (row) => row.phoneMasked },
    {
      key: 'status',
      header: t.columns.status,
      render: (row) => {
        const view = toDeliveryView(row.status);
        return (
          <Chip size="sm" status={CHIP[view]}>
            {t.deliveryStatus[view]}
          </Chip>
        );
      },
    },
    {
      key: 'attempts',
      header: t.columns.attempts,
      align: 'end',
      render: (row) => String(row.attemptCount),
    },
    {
      key: 'error',
      header: t.columns.error,
      render: (row) =>
        row.lastErrorCode === null
          ? '—'
          : `${row.lastErrorCode} ${row.lastErrorMessage ?? ''}`.trim(),
    },
    {
      key: 'sentAt',
      header: t.columns.sentAt,
      render: (row) =>
        row.sentAt === null ? '—' : (formatPlantDateTime(row.sentAt) ?? row.sentAt),
    },
    { key: 'trackingId', header: t.columns.trackingId, render: (row) => row.trackingId },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.zaloDeliveryId)}
      density="compact"
      caption={t.panes.deliveries}
      empty={<EmptyState size="sm" title={t.state.deliveriesEmpty} />}
    />
  );
};

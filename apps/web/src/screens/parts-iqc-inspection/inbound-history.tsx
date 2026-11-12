import { AlertBanner, Dialog, Table, type Column } from '@crefle/web-ui';
import type { InspectionRequestEventForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { useInspectionEvents } from './inbound-queries';

const t = messages.iqcInboundLot.history;

/**
 * 변경 이력 — 오른쪽 덮개(520, screens/W-01-01.md 「변경 이력」 · US3-6). 결과 기록 · 수정 · 삭제, 판정 확정 · 취소, 분리를
 * 누가 · 언제 · 무엇을 했는지. 내용은 서버가 만든 한 줄을 그대로 보인다.
 */
export const InboundHistory = ({
  inspectionRequestId,
  inboundLotNo,
  onClose,
}: {
  inspectionRequestId: number;
  inboundLotNo: string;
  onClose: () => void;
}) => {
  const events = useInspectionEvents(inspectionRequestId);

  const columns: Column<InspectionRequestEventForward>[] = [
    {
      key: 'when',
      header: t.columns.when,
      render: (row) => formatPlantDateTime(row.occurredAt) ?? row.occurredAt,
    },
    { key: 'who', header: t.columns.who, render: (row) => row.actorName ?? '—' },
    {
      key: 'what',
      header: t.columns.what,
      render: (row) => t.events[row.eventCode] ?? row.eventCode,
    },
    { key: 'detail', header: t.columns.detail, render: (row) => row.detail ?? '' },
  ];

  return (
    <Dialog
      open
      placement="right"
      size="md"
      className="iqc-inbound-history"
      title={t.title(inboundLotNo)}
      onClose={onClose}
    >
      <p className="field-note">{t.help}</p>
      {events.isError ? (
        <AlertBanner variant="error">{t.loadFailed}</AlertBanner>
      ) : events.data === undefined ? null : events.data.length === 0 ? (
        <p className="field-note">{t.empty}</p>
      ) : (
        <Table
          density="compact"
          columns={columns}
          rows={events.data}
          getRowId={(row, index) => `${row.occurredAt}-${String(index)}`}
          aria-label={t.title(inboundLotNo)}
        />
      )}
    </Dialog>
  );
};

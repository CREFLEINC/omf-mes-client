import { AlertBanner, Dialog, Table, type Column } from '@crefle/web-ui';
import type { InspectionRequestEventForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { useInspectionEvents } from './inbound-queries';

const t = messages.iqcInboundLot.history;
const judgmentLabel = messages.partsIqcInspection.judgment as Record<string, string | undefined>;

/**
 * 「내용」 칸 — 서버가 만든 한 줄이 있으면 그것, 없으면 판정 · 사유 · 재검 사유로 채운다. 아무것도 없으면 「—」(빈 칸 없음 · G2 M4).
 */
export const eventDetailOf = (row: InspectionRequestEventForward): string => {
  if (row.detail != null && row.detail.trim() !== '') return row.detail;
  const parts = [
    row.judgmentCode == null ? null : (judgmentLabel[row.judgmentCode] ?? row.judgmentCode),
    row.reason == null || row.reason.trim() === '' ? null : row.reason,
    row.reinspectionReasonName == null ? null : t.reinspectionReason(row.reinspectionReasonName),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? '—' : parts.join(' · '); // ui-check-ignore: C-13 서버 이력 「내용」과 같은 「·」 잇기(G2 M4)
};

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
    { key: 'detail', header: t.columns.detail, render: eventDetailOf },
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

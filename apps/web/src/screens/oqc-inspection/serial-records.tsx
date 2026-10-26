import { EmptyState, Icon, Table, type Column } from '@crefle/web-ui';
import type { OqcSerialRecord } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useOqcSerialRecords } from './queries';
import { formatDateTime } from './types';

const t = messages.oqcInspection.serials;

const columns: Column<OqcSerialRecord>[] = [
  { key: 'serialNo', header: t.recordColumns.serialNo, width: '168px' },
  { key: 'lotNo', header: t.recordColumns.lotNo },
  { key: 'firstJudgmentCode', header: t.recordColumns.first, width: '96px' },
  { key: 'finalJudgmentCode', header: t.recordColumns.final, width: '96px' },
  {
    key: 'inspectionRound',
    header: t.recordColumns.round,
    width: '96px',
    render: (row) => (row.inspectionRound === undefined ? '' : t.round(row.inspectionRound)),
  },
  {
    key: 'inspectorName',
    header: t.recordColumns.inspector,
    render: (row) => row.inspectorName ?? '',
  },
  {
    key: 'inspectedAt',
    header: t.recordColumns.inspectedAt,
    render: (row) => formatDateTime(row.inspectedAt),
  },
];

/**
 * 「시리얼 출하검사」 — 이 의뢰의 회차들이 남긴 시리얼 판정(omf-all-around#68 · 읽기 전용).
 * ⚠ 시리얼당 한 줄이다 — 재검 회차는 최종 판정만 바꾸므로 회차별 이력은 없다.
 */
export const SerialRecords = ({ inspectionRequestId }: { inspectionRequestId: number }) => {
  const records = useOqcSerialRecords(inspectionRequestId, true);

  return (
    <section className="oqc-inspection-records" aria-label={t.recordHeading}>
      {/* 제목은 접는 줄(건수 칩과 함께)이 맡는다 — 여기서는 설명만(#136). */}
      <p className="field-note">{t.recordHelp}</p>
      {records.isError ? (
        <p className="field-note">{t.recordFailed}</p>
      ) : records.isPending ? (
        <p className="field-note">{t.recordLoading}</p>
      ) : (
        <div className="oqc-inspection-serial-box-table">
          <Table
            caption={<span className="oqc-inspection-visually-hidden">{t.recordHeading}</span>}
            density="compact"
            columns={columns}
            rows={records.data}
            getRowId={(row) => String(row.serialNumberId)}
            empty={
              <EmptyState
                size="sm"
                icon={<Icon name="assignment" size={32} />}
                title={t.recordEmpty}
                description={t.recordEmptyDescription}
              />
            }
          />
        </div>
      )}
    </section>
  );
};

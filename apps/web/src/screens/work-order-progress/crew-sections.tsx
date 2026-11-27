import { AlertBanner, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { InfoFacts, InfoGroupTitle, InfoTable } from '../../patterns/info-facts';
import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  QTY_KEYS,
  type CrewRoleLabel,
  type DefectTypeRow,
  type ParticipantRow,
  type QtyKey,
  type WorkerResultRow,
} from './crew-model';
import type { WorkOrderCrew } from './queries';

const t = messages.workOrderProgress.detail;
const blank = messages.workOrderProgress.list.blank;

const timeText = (value: string | null): string =>
  value === null ? blank : (formatPlantDateTime(value) ?? value);

const workerText = (row: {
  workerId: number;
  workerNo: string | null;
  workerName: string | null;
}) =>
  row.workerName !== null && row.workerNo !== null
    ? t.workerLabel(row.workerName, row.workerNo)
    : (row.workerName ?? row.workerNo ?? t.unknownWorker);

const roleText = (role: CrewRoleLabel): string => t.roles[role];

/* 서버가 소수 둘째 자리까지 준다 — 그 이상으로 늘이지 않는다. */
const minutesText = (minutes: number | null): string =>
  minutes === null ? blank : String(Math.round(minutes * 100) / 100);

const participantColumns: Column<ParticipantRow>[] = [
  { key: 'worker', header: t.sessions.columns.worker, render: workerText },
  { key: 'role', header: t.sessions.columns.role, render: (row) => roleText(row.role) },
  {
    key: 'joinedAt',
    header: t.sessions.columns.joinedAt,
    render: (row) => timeText(row.joinedAt),
  },
  { key: 'leftAt', header: t.sessions.columns.leftAt, render: (row) => timeText(row.leftAt) },
  {
    key: 'minutes',
    header: t.sessions.columns.minutes,
    align: 'end',
    render: (row) => minutesText(row.participatedMinutes),
  },
];

const defectTypeColumns: Column<DefectTypeRow>[] = [
  {
    key: 'type',
    header: t.defectTypes.columns.type,
    render: (row) => row.label ?? t.defectTypes.untyped,
  },
  {
    key: 'qty',
    header: t.defectTypes.columns.qty,
    align: 'end',
    render: (row) => row.qty.toLocaleString('ko-KR'),
  },
];

/** 양품·불량은 늘 두고, 나머지 수량은 0 이 아닌 값이 있을 때만 연다. */
const shownQtyKeys = (rows: readonly WorkerResultRow[]): QtyKey[] =>
  QTY_KEYS.filter(
    (key) => key === 'goodQty' || key === 'defectQty' || rows.some((row) => row[key] !== 0),
  );

export interface CrewSectionsProps {
  crew: WorkOrderCrew | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** W/O 상세 창의 「작업 세션」·「작업자별 실적」. 읽기만 한다. */
export const CrewSections = ({ crew, isLoading, isError }: CrewSectionsProps) => {
  if (isLoading) return <p role="status">{t.crewLoading}</p>;
  if (isError || crew === undefined) {
    return (
      <div className="banner-slot">
        <AlertBanner variant="error">{t.crewLoadError}</AlertBanner>
      </div>
    );
  }

  const resultColumns: Column<WorkerResultRow>[] = [
    { key: 'worker', header: t.workerResults.columns.worker, render: workerText },
    { key: 'role', header: t.workerResults.columns.role, render: (row) => roleText(row.role) },
    ...shownQtyKeys(crew.workerResults).map((key): Column<WorkerResultRow> => ({
      key,
      header: t.workerResults.columns[key],
      align: 'end',
      render: (row) => row[key].toLocaleString('ko-KR'),
    })),
  ];

  return (
    <>
      {crew.sessionsTruncated && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.sessionsTruncated}</AlertBanner>
        </div>
      )}
      {crew.resultsTruncated && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.resultsTruncated}</AlertBanner>
        </div>
      )}

      {/* 정보 표시 팝업 — 묶음 제목 + 상자, 표는 제목 · 건수 + 공용 표(시안 2026-11-27 · #360). */}
      <section className="work-order-progress-crew" aria-label={t.sessions.heading}>
        <InfoGroupTitle>{t.sessions.heading}</InfoGroupTitle>
        {crew.sessions.length === 0 ? (
          <p className="field-note">{t.sessions.empty}</p>
        ) : (
          crew.sessions.map((session) => (
            <section
              key={session.workSessionId}
              className="work-order-progress-session"
              aria-label={t.sessions.session(session.sessionNo)}
            >
              <InfoFacts
                rows={[
                  [
                    { label: t.sessions.startedAt, value: timeText(session.startedAt) },
                    {
                      label: t.sessions.endedAt,
                      value:
                        session.endedAt === null ? t.sessions.ongoing : timeText(session.endedAt),
                    },
                  ],
                ]}
              />
              <InfoTable
                title={t.sessions.session(session.sessionNo)}
                storageKey="omf-mes:work-order-progress:columns:crew-session"
                columns={participantColumns}
                rows={session.participants}
                getRowId={(row) => String(row.workSessionWorkerId)}
                emptyTitle={t.sessions.noParticipants}
              />
            </section>
          ))
        )}
      </section>

      <section className="work-order-progress-crew" aria-label={t.workerResults.heading}>
        <InfoTable
          title={t.workerResults.heading}
          storageKey="omf-mes:work-order-progress:columns:crew-results"
          columns={resultColumns}
          rows={crew.workerResults}
          getRowId={(row) => String(row.workerId)}
          emptyTitle={t.workerResults.empty}
        />
      </section>

      <section className="work-order-progress-crew" aria-label={t.defectTypes.heading}>
        <InfoTable
          title={t.defectTypes.heading}
          storageKey="omf-mes:work-order-progress:columns:crew-defects"
          columns={defectTypeColumns}
          rows={crew.defectTypes}
          getRowId={(row) => (row.defectCodeId === null ? 'untyped' : String(row.defectCodeId))}
          emptyTitle={t.defectTypes.empty}
        />
      </section>
    </>
  );
};

import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
  { key: 'type', header: t.defectTypes.columns.type, render: (row) => row.label },
  {
    key: 'qty',
    header: t.defectTypes.columns.qty,
    align: 'end',
    render: (row) => String(row.qty),
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
      render: (row) => String(row[key]),
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

      <section className="work-order-progress-crew" aria-label={t.sessions.heading}>
        <h3>{t.sessions.heading}</h3>
        {crew.sessions.length === 0 ? (
          <p className="field-note">{t.sessions.empty}</p>
        ) : (
          crew.sessions.map((session) => (
            <section
              key={session.workSessionId}
              className="work-order-progress-session"
              aria-label={t.sessions.session(session.sessionNo)}
            >
              <h4>{t.sessions.session(session.sessionNo)}</h4>
              <dl className="work-order-progress-session-times">
                <div className="field-cell">
                  <dt className="field-label">{t.sessions.startedAt}</dt>
                  <dd>{timeText(session.startedAt)}</dd>
                </div>
                <div className="field-cell">
                  <dt className="field-label">{t.sessions.endedAt}</dt>
                  <dd>
                    {session.endedAt === null ? t.sessions.ongoing : timeText(session.endedAt)}
                  </dd>
                </div>
              </dl>
              <Table
                caption={t.sessions.session(session.sessionNo)}
                density="compact"
                columns={participantColumns}
                rows={session.participants}
                getRowId={(row) => String(row.workSessionWorkerId)}
                empty={<p className="field-note">{t.sessions.noParticipants}</p>}
              />
            </section>
          ))
        )}
      </section>

      <section className="work-order-progress-crew" aria-label={t.workerResults.heading}>
        <h3>{t.workerResults.heading}</h3>
        <Table
          caption={t.workerResults.heading}
          density="compact"
          columns={resultColumns}
          rows={crew.workerResults}
          getRowId={(row) => String(row.workerId)}
          empty={<p className="field-note">{t.workerResults.empty}</p>}
        />
      </section>

      <section className="work-order-progress-crew" aria-label={t.defectTypes.heading}>
        <h3>{t.defectTypes.heading}</h3>
        <Table
          caption={t.defectTypes.heading}
          density="compact"
          columns={defectTypeColumns}
          rows={crew.defectTypes}
          getRowId={(row) => String(row.defectCodeId)}
          empty={<p className="field-note">{t.defectTypes.empty}</p>}
        />
      </section>
    </>
  );
};

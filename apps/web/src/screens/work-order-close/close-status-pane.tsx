import { AlertBanner, Button, type Column, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { JSX, ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import type { WorkOrderCloseBlocker } from './close-readiness';
import type { WorkOrderCloseOpenSessionView } from './queries';

export type WorkOrderCloseStatusPaneState =
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE'; content: ReactNode }
  | { kind: 'RESOLVED'; blockers: readonly WorkOrderCloseBlocker[] };

export interface WorkOrderCloseStatusPaneProps {
  state: WorkOrderCloseStatusPaneState;
  /** 마감을 막는 열린 세션. 막힘에 열린 세션이 있을 때만 표로 보인다 */
  openSessions?: readonly WorkOrderCloseOpenSessionView[];
  onRecheckSessions?: () => void;
  /** 주면 줄마다 [강제 종료]를 둔다 */
  onForceEnd?: (session: WorkOrderCloseOpenSessionView) => void;
}

const sessionText = messages.workOrderClose.status.sessions;

const SESSION_COLUMNS: Column<WorkOrderCloseOpenSessionView>[] = [
  {
    key: 'terminal',
    header: sessionText.terminal,
    render: (row) => row.terminalCode ?? sessionText.unknown,
  },
  {
    key: 'worker',
    header: sessionText.worker,
    render: (row) =>
      row.workerName === null || row.workerNo === null
        ? sessionText.unknown
        : sessionText.workerValue(row.workerName, row.workerNo),
  },
  {
    key: 'startedAt',
    header: sessionText.startedAt,
    render: (row) => formatPlantDateTime(row.startedAt) ?? sessionText.unknown,
  },
  {
    key: 'state',
    header: sessionText.state,
    render: (row) =>
      row.statusCode === 'RUNNING' || row.statusCode === 'STOPPED'
        ? sessionText[row.statusCode]
        : sessionText.unknown,
  },
];

export const WorkOrderCloseStatusPane = ({
  state,
  openSessions = [],
  onRecheckSessions,
  onForceEnd,
}: WorkOrderCloseStatusPaneProps): JSX.Element => {
  const columns: Column<WorkOrderCloseOpenSessionView>[] =
    onForceEnd === undefined
      ? SESSION_COLUMNS
      : [
          ...SESSION_COLUMNS,
          {
            key: 'actions',
            header: sessionText.actions,
            render: (row) => (
              <Button
                variant="outlined"
                size="sm"
                aria-label={sessionText.forceEndFor(row.terminalCode ?? sessionText.unknown)}
                onClick={() => onForceEnd(row)}
              >
                {sessionText.forceEnd}
              </Button>
            ),
          },
        ];
  const t = messages.workOrderClose.status;

  return (
    <section aria-label={t.pane} className="pane work-order-close-status-pane">
      <h2 className="pane-title">{t.heading}</h2>
      {state.kind === 'CHECKING' ? (
        <div aria-label={t.loading} role="status">
          <SkeletonText lines={3} />
        </div>
      ) : null}
      {state.kind === 'UNAVAILABLE' ? state.content : null}
      {state.kind === 'RESOLVED' && state.blockers.length === 0 ? (
        <p aria-live="polite" role="status">
          {t.complete}
        </p>
      ) : null}
      {state.kind === 'RESOLVED' && state.blockers.length > 0 ? (
        <AlertBanner variant="warning">
          <ol>
            {state.blockers.map((blocker) => (
              <li key={blocker}>{t.blockers[blocker]}</li>
            ))}
          </ol>
        </AlertBanner>
      ) : null}
      {state.kind === 'RESOLVED' &&
      state.blockers.includes('OPEN_SESSION') &&
      openSessions.length > 0 ? (
        <div className="work-order-close-sessions">
          <Table
            density="compact"
            caption={sessionText.label}
            columns={columns}
            rows={[...openSessions]}
            getRowId={(row) => String(row.workSessionId)}
          />
          <p className="field-note">{sessionText.action(messages.workHoldRegister.title)}</p>
          {onRecheckSessions === undefined ? null : (
            <Button variant="outlined" size="sm" onClick={onRecheckSessions}>
              {sessionText.recheck}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
};

import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { dispositionEntryPath } from '../disposition-decision/filters';
import { dispositionTypeLabel, type Stage } from './codes';
import { LoadErrorBanner } from './load-error';
import type { FollowUpStates } from './lock';
import type { RequestLookup } from './lookups';
import type { DecisionRow } from './types';

export interface ResultPaneProps {
  nonconformanceId: number | null;
  stage: Stage | null;
  decisions: { rows: DecisionRow[]; isLoading: boolean; isError: boolean; error: unknown };
  followUp: FollowUpStates;
  uoms: RequestLookup;
  onRetry: () => void;
}

interface FollowUpButtonProps {
  label: string;
  reason: string | undefined;
}

/**
 * 비활성 컨트롤의 사유 — 규범 4: 항상 보이는 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 * 사유가 붙는 비활성 보조 액션은 `outlined`를 쓴다(`text`는 라벨로 읽힌다).
 */
const FollowUpButton = ({ label, reason }: FollowUpButtonProps) => {
  const reasonId = useId();

  return (
    <div className="field-cell">
      <Button
        variant="outlined"
        size="sm"
        disabled={reason !== undefined}
        aria-describedby={reason === undefined ? undefined : reasonId}
      >
        {label}
      </Button>
      {reason !== undefined && (
        <span id={reasonId} className="field-note">
          {reason}
        </span>
      )}
    </div>
  );
};

/**
 * ③ 결과 수신 후 — 처분 «목록»을 보인다. 부분 처분이 정상이라 여러 행일 수 있고(§5-5), 후속 버튼은
 * 처분마다 따로 활성 조건을 판정한다. 판정은 이 화면이 하지 않는다 — 「판정 결과 보기」는 품질
 * 화면(W-03-10)의 진입 주소로 연다.
 */
export const ResultPane = ({
  nonconformanceId,
  stage,
  decisions,
  followUp,
  uoms,
  onRetry,
}: ResultPaneProps) => {
  const t = messages.dispositionRequest;
  const openReasonId = useId();
  const columns: Column<DecisionRow>[] = [
    {
      key: 'type',
      header: t.fields.dispositionType,
      render: (row) => dispositionTypeLabel(row.dispositionTypeCode),
    },
    {
      key: 'qty',
      header: t.fields.decisionQty,
      align: 'end',
      render: (row) => `${row.qtyText} ${lookupDisplayLabel(uoms, row.uomId)}`.trim(),
    },
    { key: 'reason', header: t.fields.reason, render: (row) => row.reason },
    {
      key: 'decidedAt',
      header: t.fields.decidedAt,
      render: (row) =>
        row.hasApproval ? `${row.decidedAtText} · ${t.result.approvalPending}` : row.decidedAtText,
    },
  ];

  let body: ReactNode;
  if (nonconformanceId === null || stage === 'NONE' || stage === 'NOT_REQUESTED') {
    body = <p className="field-note">{t.result.notRequested}</p>;
  } else if (decisions.isError) {
    body = <LoadErrorBanner error={decisions.error} isDetail onRetry={onRetry} />;
  } else if (decisions.isLoading) {
    body = (
      <div role="status" aria-label={t.result.loading}>
        <SkeletonText lines={2} />
      </div>
    );
  } else if (decisions.rows.length === 0) {
    body = (
      <p className="field-note">
        {stage === 'PENDING_DECISION' ? t.result.pending : t.result.empty}
      </p>
    );
  } else {
    body = (
      <div className="disposition-request-table">
        <p className="field-note">{t.result.partialNote}</p>
        <Table
          density="compact"
          caption={<span className="disposition-request-table-caption">{t.panes.decisions}</span>}
          columns={columns}
          rows={decisions.rows}
          getRowId={(row) => String(row.dispositionDecisionId)}
        />
      </div>
    );
  }

  return (
    <div className="disposition-request-result" role="group" aria-label={t.panes.result}>
      {body}

      <div className="disposition-request-follow-ups">
        <div className="field-cell">
          {nonconformanceId === null ? (
            <>
              <Button variant="outlined" size="sm" disabled aria-describedby={openReasonId}>
                {t.actions.openDecision}
              </Button>
              <span id={openReasonId} className="field-note">
                {t.result.followUp.openDecisionUnavailable}
              </span>
            </>
          ) : (
            <Link to={dispositionEntryPath(nonconformanceId)}>{t.actions.openDecision}</Link>
          )}
        </div>
        <FollowUpButton label={t.actions.reworkResult} reason={followUp.rework.reason} />
        <FollowUpButton label={t.actions.disposalRequest} reason={followUp.disposal.reason} />
        <FollowUpButton label={t.actions.reinstate} reason={followUp.reinstate.reason} />
      </div>
    </div>
  );
};

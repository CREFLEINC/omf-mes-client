import { type Column, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { dispositionTypeLabel } from './disposition-codes';
import type { DispositionLookup } from './lookups';
import type { DecisionRow } from './types';

export interface DecisionHistoryProps {
  rows: DecisionRow[];
  uoms: DispositionLookup;
  isLoading: boolean;
  isError: boolean;
}

export const DecisionHistory = ({ rows, uoms, isLoading, isError }: DecisionHistoryProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<DecisionRow>[] = [
    {
      key: 'dispositionTypeCode',
      header: t.fields.dispositionTypeCode,
      render: (row) => dispositionTypeLabel(row.dispositionTypeCode),
    },
    {
      key: 'qty',
      header: t.fields.decisionQty,
      align: 'end',
      render: (row) => row.decisionQtyText,
    },
    { key: 'uom', header: t.fields.uom, render: (row) => lookupDisplayLabel(uoms, row.uomId) },
    { key: 'decidedAt', header: t.fields.decidedAt, render: (row) => row.decidedAtText },
    { key: 'reason', header: t.fields.reason, render: (row) => row.reason },
  ];

  /*
   * 접는 구역(사용자 시안 · #223) — 머리에 건수, 펼치면 표. 이력이 없으면 빈 표 대신 한 줄 문구만.
   * 남은 수량은 판정 구역 머리로 옮겼다(조회 시점 참고값인 것은 그대로 — 최종 판정은 저장 때 서버가 낸다).
   */
  return (
    <details className="disposition-fold">
      <summary>
        <span className="disposition-fold-title">{t.panes.decisions}</span>
        <span className="disposition-fold-count">
          {isLoading || isError ? '' : t.decisions.count(rows.length)}
        </span>
      </summary>
      {isLoading ? (
        <div role="status" aria-label={t.decisions.loading}>
          <SkeletonText lines={2} />
        </div>
      ) : isError ? (
        <p className="field-note">{t.decisions.unavailable}</p>
      ) : rows.length === 0 ? (
        <p className="field-note">{t.decisions.empty}</p>
      ) : (
        <div className="disposition-table disposition-decision-table">
          <Table
            density="compact"
            caption={<span className="disposition-table-caption">{t.panes.decisions}</span>}
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.dispositionDecisionId)}
          />
        </div>
      )}
    </details>
  );
};

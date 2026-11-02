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
   * 상세 아래 「판정 이력」 탭의 내용(사용자 지시 · #223) — 이력이 없으면 빈 표 대신 한 줄 문구만.
   * 남은 수량은 판정 구역 머리로 옮겼다(조회 시점 참고값인 것은 그대로 — 최종 판정은 저장 때 서버가 낸다).
   */
  return (
    <div className="disposition-decision-history" role="group" aria-label={t.panes.decisions}>
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
    </div>
  );
};

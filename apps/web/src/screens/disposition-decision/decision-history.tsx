import { Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import type { DispositionLookup } from './lookups';
import type { RemainingQty } from './remaining-qty';
import type { DecisionRow } from './types';

export interface DecisionHistoryProps {
  rows: DecisionRow[];
  remaining: RemainingQty;
  uoms: DispositionLookup;
  isLoading: boolean;
  isError: boolean;
}

export const DecisionHistory = ({
  rows,
  remaining,
  uoms,
  isLoading,
  isError,
}: DecisionHistoryProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<DecisionRow>[] = [
    {
      key: 'dispositionTypeCode',
      header: t.fields.dispositionTypeCode,
      render: (row) => row.dispositionTypeCode,
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

  if (isLoading) {
    return (
      <div role="status" aria-label={t.decisions.loading}>
        <SkeletonText lines={2} />
      </div>
    );
  }

  if (isError) return <EmptyState size="sm" title={t.decisions.unavailable} />;

  return (
    <section className="disposition-subsection" aria-label={t.panes.decisions}>
      <h3 className="disposition-subtitle">{t.panes.decisions}</h3>
      <div className="disposition-table disposition-decision-table">
        <Table
          density="compact"
          caption={<span className="disposition-table-caption">{t.panes.decisions}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.dispositionDecisionId)}
          empty={<EmptyState size="sm" title={t.decisions.empty} />}
        />
      </div>
      {/*
       * ⭐ 남은 수량은 판정 이력 조회의 `summary.remainingQty`다 — 서버가 대상 수량 합에서
       * 결정 수량 합을 뺀 값이다(공유계약 L-2). ⚠ 그래도 **조회 시점의 스냅샷**이라 참고값으로
       * 적는다 — 이 값을 받은 뒤 다른 판정이 저장되면 실제 남은 수량은 달라져 있을 수 있고,
       * 최종 판정은 저장 시 서버가 409로 낸다. 근거: W-03-10 §3 · §9-1 · omf-mes#253.
       */}
      <div
        className="field-cell disposition-remaining-card"
        role="group"
        aria-label={t.remaining.label}
      >
        <span className="field-label">{t.remaining.label}</span>
        <Chip status={remaining.isSettled ? 'idle' : 'warning'}>{remaining.text}</Chip>
        <span className="field-note">
          {remaining.value === undefined
            ? t.remaining.unknown
            : remaining.isSettled
              ? t.remaining.settled
              : t.remaining.note}
        </span>
      </div>
    </section>
  );
};

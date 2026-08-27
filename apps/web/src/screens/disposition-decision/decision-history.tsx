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
    <section aria-label={t.panes.decisions}>
      <h3 className="field-label">{t.panes.decisions}</h3>
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.dispositionDecisionId)}
        empty={<EmptyState size="sm" title={t.decisions.empty} />}
      />
      {/*
       * ⭐ 남은 수량은 서버가 내려주지 않아 화면이 합계 차로 낸 **참고값**이다(omf-mes#253).
       * 값 옆에 그 사실을 상시 적어, 사용자가 이 수를 서버의 확정 판정으로 읽지 않게 한다.
       */}
      <div className="field-cell" role="group" aria-label={t.remaining.label}>
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

import {
  Button,
  type Column,
  DatePicker,
  EmptyState,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import type { CodeOption } from './disposition-codes';
import type { HistoryFilters } from './history-filters';
import { LoadErrorBanner } from './load-error';
import type { DispositionLookup } from './lookups';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { DecisionRow } from './types';

export interface HistoryTabProps {
  applied: HistoryFilters;
  dispositionOptions: CodeOption[];
  rows: DecisionRow[];
  uoms: DispositionLookup;
  page: PageView;
  isLoading: boolean;
  error: unknown;
  onApply: (filters: HistoryFilters) => void;
  onChangePage: (page: number) => void;
  onRetry: () => void;
}

export const HistoryTab = ({
  applied,
  dispositionOptions,
  rows,
  uoms,
  page,
  isLoading,
  error,
  onApply,
  onChangePage,
  onRetry,
}: HistoryTabProps) => {
  const t = messages.dispositionDecision;
  const periodId = useId();
  const dispositionId = useId();
  const dispositionNoteId = `${dispositionId}-note`;
  const [draft, setDraft] = useState<HistoryFilters>(applied);
  const { from, to, dispositionTypeCode } = applied;

  useEffect(() => {
    setDraft({ from, to, dispositionTypeCode });
  }, [from, to, dispositionTypeCode]);

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

  const isPendingCodes = dispositionOptions.length === 0;
  const choices = isPendingCodes ? [] : [{ value: '', label: t.all }, ...dispositionOptions];

  const results = (): ReactNode => {
    if (error !== null && error !== undefined) {
      return <LoadErrorBanner error={error} onRetry={onRetry} />;
    }

    if (isLoading) {
      return (
        <div role="status" aria-label={t.historyLoading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.dispositionDecisionId)}
          empty={
            page.isBeyondLast ? (
              <EmptyState
                size="sm"
                live
                title={t.empty.beyondTitle}
                description={t.empty.beyondDescription}
                action={
                  <Button variant="outlined" onClick={() => onChangePage(1)}>
                    {t.actions.goFirstPage}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                size="sm"
                live
                title={t.empty.historyTitle}
                description={t.empty.historyDescription}
              />
            )
          }
        />
        <PageNav view={page} label={t.page.label} onChange={onChangePage} />
      </>
    );
  };

  return (
    <section className="pane" aria-label={t.panes.history}>
      <div className="filter-bar">
        <div className="field-cell">
          <label className="field-label" htmlFor={periodId}>
            {t.fields.decidedPeriod}
          </label>
          <DatePicker
            id={periodId}
            mode="range"
            value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
            placeholder={messages.common.selectDate}
            onChange={([nextFrom, nextTo]) =>
              setDraft((current) => ({ ...current, from: nextFrom, to: nextTo }))
            }
          />
          <span className="field-note">{t.values.periodRequired}</span>
        </div>
        <div className="field-cell">
          <label className="field-label" htmlFor={dispositionId}>
            {t.fields.dispositionTypeCode}
          </label>
          <Select
            id={dispositionId}
            options={choices}
            value={
              draft.dispositionTypeCode === '' && isPendingCodes ? null : draft.dispositionTypeCode
            }
            placeholder={isPendingCodes ? t.codePlaceholder : t.all}
            aria-describedby={isPendingCodes ? dispositionNoteId : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, dispositionTypeCode: value }))
            }
          />
          {isPendingCodes && (
            <span id={dispositionNoteId} className="field-note">
              {t.codePending}
            </span>
          )}
        </div>
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={() => onApply(draft)}>{messages.common.search}</Button>
          </div>
        </div>
      </div>
      {results()}
    </section>
  );
};

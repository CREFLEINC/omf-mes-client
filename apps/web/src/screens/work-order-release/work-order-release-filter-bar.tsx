import { Button, Select, TextField, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

const t = messages.workOrderRelease.filter;

export interface WorkOrderReleaseFilterValues {
  productionLineId: string;
  plannedStartFrom: string;
  plannedStartTo: string;
  statusCode: string;
}

export const EMPTY_WORK_ORDER_RELEASE_FILTERS: WorkOrderReleaseFilterValues = {
  productionLineId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: '',
};

export interface WorkOrderReleaseFilterBarProps {
  appliedFilters: WorkOrderReleaseFilterValues;
  productionLineOptions: SelectItems;
  statusOptions: SelectItems;
  productionLineUnavailableReason: string | null;
  statusUnavailableReason: string | null;
  onSearch: (filters: WorkOrderReleaseFilterValues) => void;
  onReset: () => void;
}

export const WorkOrderReleaseFilterBar = ({
  appliedFilters,
  productionLineOptions,
  statusOptions,
  productionLineUnavailableReason,
  statusUnavailableReason,
  onSearch,
  onReset,
}: WorkOrderReleaseFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const productionLineId = useId();
  const statusId = useId();
  const lineNoteId = `${productionLineId}-note`;
  const statusNoteId = `${statusId}-note`;
  const validationId = `${statusId}-validation`;
  const {
    productionLineId: appliedProductionLineId,
    plannedStartFrom,
    plannedStartTo,
    statusCode,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      productionLineId: appliedProductionLineId,
      plannedStartFrom,
      plannedStartTo,
      statusCode,
    });
  }, [appliedProductionLineId, plannedStartFrom, plannedStartTo, statusCode]);

  const statusReason =
    statusUnavailableReason ?? (statusOptions.length === 0 ? t.statusEmpty : null);
  const validationReasons: string[] = [];
  if (draft.statusCode === '') validationReasons.push(t.statusRequired);
  if (
    draft.plannedStartFrom !== '' &&
    draft.plannedStartTo !== '' &&
    draft.plannedStartFrom > draft.plannedStartTo
  ) {
    validationReasons.push(t.dateRange);
  }
  const searchDisabled = validationReasons.length > 0;

  return (
    <section className="pane work-order-release-filter-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.pane}</h2>
      <form
        className="filter-bar work-order-release-filter"
        onSubmit={(event) => {
          event.preventDefault();
          if (!searchDisabled) onSearch({ ...draft });
        }}
      >
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={productionLineId}>
            {t.productionLine}
          </label>
          <Select
            id={productionLineId}
            aria-describedby={productionLineUnavailableReason === null ? undefined : lineNoteId}
            disabled={productionLineUnavailableReason !== null}
            options={[{ value: '', label: t.all }, ...productionLineOptions]}
            value={draft.productionLineId}
            onChange={(value) => setDraft((current) => ({ ...current, productionLineId: value }))}
          />
          {productionLineUnavailableReason !== null && (
            <p className="field-note" id={lineNoteId}>
              {productionLineUnavailableReason}
            </p>
          )}
        </div>
        <div className="field-cell">
          <TextField
            label={t.plannedStartFrom}
            type="date"
            value={draft.plannedStartFrom}
            onChange={(event) =>
              setDraft((current) => ({ ...current, plannedStartFrom: event.target.value }))
            }
          />
        </div>
        <div className="field-cell">
          <TextField
            label={t.plannedStartTo}
            type="date"
            value={draft.plannedStartTo}
            onChange={(event) =>
              setDraft((current) => ({ ...current, plannedStartTo: event.target.value }))
            }
          />
        </div>
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={statusId}>
            {t.status}
          </label>
          <Select
            id={statusId}
            aria-describedby={statusReason === null ? undefined : statusNoteId}
            aria-required
            disabled={statusReason !== null}
            options={statusOptions}
            value={draft.statusCode === '' ? null : draft.statusCode}
            onChange={(value) => setDraft((current) => ({ ...current, statusCode: value }))}
          />
          {statusReason !== null && (
            <p className="field-note" id={statusNoteId}>
              {statusReason}
            </p>
          )}
        </div>
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              type="submit"
              aria-describedby={searchDisabled ? validationId : undefined}
              disabled={searchDisabled}
            >
              {t.search}
            </Button>
            <Button
              type="button"
              variant="outlined"
              onClick={() => {
                setDraft(EMPTY_WORK_ORDER_RELEASE_FILTERS);
                onReset();
              }}
            >
              {t.reset}
            </Button>
          </div>
          {searchDisabled && (
            <p className="field-error" id={validationId}>
              {validationReasons.join(' ')}
            </p>
          )}
        </div>
      </form>
    </section>
  );
};

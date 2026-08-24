import { Button, Select, TextField, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type JSX, useEffect, useId, useState } from 'react';
export interface WorkOrderCloseFilterValues {
  productionOrderId: string;
  plannedStartFrom: string;
  plannedStartTo: string;
  statusCode: string;
}
export interface WorkOrderCloseFilterBarProps {
  appliedFilters: WorkOrderCloseFilterValues;
  productionOrderOptions: SelectItems;
  statusOptions: SelectItems;
  productionOrderUnavailableReason: string | null;
  statusUnavailableReason: string | null;
  onSearch: (filters: WorkOrderCloseFilterValues) => void;
  onReset: () => void;
}
export const WorkOrderCloseFilterBar = ({
  appliedFilters,
  productionOrderOptions,
  statusOptions,
  productionOrderUnavailableReason,
  statusUnavailableReason,
  onSearch,
  onReset,
}: WorkOrderCloseFilterBarProps): JSX.Element => {
  const t = messages.workOrderClose.filter;
  const [draft, setDraft] = useState(appliedFilters);
  const productionOrderId = useId();
  const statusId = useId();
  const productionOrderNoteId = `${productionOrderId}-note`;
  const statusNoteId = `${statusId}-note`;
  const {
    productionOrderId: appliedProductionOrderId,
    plannedStartFrom,
    plannedStartTo,
    statusCode,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      productionOrderId: appliedProductionOrderId,
      plannedStartFrom,
      plannedStartTo,
      statusCode,
    });
  }, [appliedProductionOrderId, plannedStartFrom, plannedStartTo, statusCode]);

  const productionOrderReason = productionOrderUnavailableReason;
  const statusReason =
    statusUnavailableReason ?? (statusOptions.length === 0 ? t.statusEmpty : null);
  const validationReasons: string[] = [];
  if (draft.statusCode === '') validationReasons.push(t.statusRequired);
  if (
    draft.plannedStartFrom !== '' &&
    draft.plannedStartTo !== '' &&
    draft.plannedStartFrom > draft.plannedStartTo
  )
    validationReasons.push(t.dateRange);
  const validationId = `${statusId}-validation`;
  const searchDisabled = validationReasons.length > 0;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!searchDisabled) onSearch({ ...draft });
  };

  return (
    <form className="filter-bar" onSubmit={submit}>
      <div className="field-cell">
        <label className="field-label" htmlFor={productionOrderId}>
          {t.productionOrder}
        </label>
        <Select
          aria-describedby={productionOrderReason === null ? undefined : productionOrderNoteId}
          disabled={productionOrderReason !== null}
          id={productionOrderId}
          options={[{ value: '', label: t.all }, ...productionOrderOptions]}
          value={draft.productionOrderId}
          onChange={(productionOrderId) =>
            setDraft((current) => ({ ...current, productionOrderId }))
          }
        />
        {productionOrderReason === null ? null : (
          <p className="field-note" id={productionOrderNoteId}>
            {productionOrderReason}
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
      <div className="field-cell">
        <label className="field-label" htmlFor={statusId}>
          {t.status}
        </label>
        <Select
          aria-describedby={statusReason === null ? undefined : statusNoteId}
          aria-required
          disabled={statusReason !== null}
          id={statusId}
          options={statusOptions}
          value={draft.statusCode === '' ? null : draft.statusCode}
          onChange={(statusCode) => setDraft((current) => ({ ...current, statusCode }))}
        />
        {statusReason === null ? null : (
          <p className="field-note" id={statusNoteId}>
            {statusReason}
          </p>
        )}
      </div>
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button
            aria-describedby={searchDisabled ? validationId : undefined}
            disabled={searchDisabled}
            type="submit"
          >
            {t.search}
          </Button>
          <Button type="button" variant="outlined" onClick={onReset}>
            {t.reset}
          </Button>
        </div>
        {searchDisabled ? (
          <p className="field-error" id={validationId}>
            {validationReasons.join(' ')}
          </p>
        ) : null}
      </div>
    </form>
  );
};

import {
  AlertBanner,
  Button,
  Chip,
  DatePicker,
  Select,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import {
  summarizeProductionPlanQuantities,
  type ProductionPlanDraft,
  type ProductionPlanDraftErrors,
  type ProductionPlanDraftField,
} from './editor-model';

const t = messages.productionPlan.editor;
const summaryText = messages.productionPlan.quantitySummary;

const NO_LINE = '__none__';
export interface ProductionPlanEditorOption {
  value: string;
  label: string;
}
export interface ProductionPlanEditorRow {
  key: string;
  displayNo: number;
  planNo: string | null;
  statusCode: string;
  confirmed: boolean;
  isPending: boolean;
  draft: ProductionPlanDraft;
  errors: ProductionPlanDraftErrors;
}
interface ProductionPlanEditorPaneProps {
  rows: ProductionPlanEditorRow[];
  orderQty: number;
  uomLabel: string;
  bomOptions: ProductionPlanEditorOption[];
  routingOptions: ProductionPlanEditorOption[];
  lineOptions: ProductionPlanEditorOption[];
  addDisabled?: boolean;
  onAdd: () => void;
  onChange: (key: string, field: ProductionPlanDraftField, value: string) => void;
  onRemove: (key: string) => void;
  renderActions?: (row: ProductionPlanEditorRow) => ReactNode;
}
const errorMessage = (code: ProductionPlanDraftErrors[ProductionPlanDraftField]): string | null => {
  if (typeof code === 'object') return code.message;
  if (code === 'REQUIRED') return messages.productionPlan.draftErrors.REQUIRED;
  if (code === 'INVALID_DATE') return messages.productionPlan.draftErrors.INVALID_DATE;
  if (code === 'INVALID_QUANTITY') return messages.productionPlan.draftErrors.INVALID_QUANTITY;
  if (code === 'INVALID_SELECTION') return messages.productionPlan.draftErrors.INVALID_SELECTION;
  return null;
};
const quantity = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);
const quantitySummary = (orderQty: number, rows: ProductionPlanEditorRow[]) => {
  const quantities = rows.map(({ draft }) => {
    const raw = draft.plannedQty.trim();
    return raw === '' ? Number.NaN : Number(raw);
  });
  if (quantities.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return summarizeProductionPlanQuantities(orderQty, quantities);
};
export const ProductionPlanEditorPane = ({
  rows,
  orderQty,
  uomLabel,
  bomOptions,
  routingOptions,
  lineOptions,
  addDisabled = false,
  onAdd,
  onChange,
  onRemove,
  renderActions,
}: ProductionPlanEditorPaneProps) => {
  const summary = quantitySummary(orderQty, rows);
  const fieldError = (row: ProductionPlanEditorRow, field: ProductionPlanDraftField) =>
    errorMessage(row.errors[field]);
  const locked = (row: ProductionPlanEditorRow) => row.confirmed || row.isPending;
  const rowName = (row: ProductionPlanEditorRow) => row.planNo ?? t.newRow(row.displayNo);
  const select = (
    row: ProductionPlanEditorRow,
    field: 'bomId' | 'routingId' | 'plannedLineId',
    label: string,
    options: ProductionPlanEditorOption[],
  ) => {
    const optional = field === 'plannedLineId';
    const error = fieldError(row, field);
    const errorId = `${row.key}-${field}-error`;
    return (
      <div className="production-plan-editor-field">
        <Select
          aria-label={t.fieldLabel(rowName(row), label)}
          aria-describedby={error === null ? undefined : errorId}
          aria-required={optional ? undefined : true}
          size="sm"
          value={optional && row.draft[field] === '' ? NO_LINE : row.draft[field]}
          options={optional ? [{ value: NO_LINE, label: t.lineUnset }, ...options] : options}
          placeholder={t.selectPlaceholder}
          disabled={locked(row)}
          invalid={error !== null}
          onChange={(value) => onChange(row.key, field, value === NO_LINE ? '' : value)}
        />
        {error !== null && (
          <span id={errorId} className="field-error">
            {error}
          </span>
        )}
      </div>
    );
  };
  const columns: Column<ProductionPlanEditorRow>[] = [
    {
      key: 'planNo',
      header: t.columns.planNo,
      width: '8rem',
      render: (row) => <span className="production-plan-table-value">{rowName(row)}</span>,
    },
    {
      key: 'planDate',
      header: t.columns.planDate,
      width: '10rem',
      render: (row) => (
        <div className="production-plan-editor-field">
          <DatePicker
            aria-label={t.fieldLabel(rowName(row), t.columns.planDate)}
            aria-describedby={
              fieldError(row, 'planDate') === null ? undefined : `${row.key}-planDate-error`
            }
            aria-required="true"
            size="sm"
            value={row.draft.planDate || null}
            disabled={locked(row)}
            invalid={fieldError(row, 'planDate') !== null}
            onChange={(value) => onChange(row.key, 'planDate', value)}
          />
          {fieldError(row, 'planDate') !== null && (
            <span id={`${row.key}-planDate-error`} className="field-error">
              {fieldError(row, 'planDate')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'plannedQty',
      header: t.columns.plannedQty,
      width: '13rem',
      align: 'end',
      render: (row) => (
        <TextField
          aria-label={t.fieldLabel(rowName(row), t.quantityField)}
          containerClassName="production-plan-quantity-field"
          fullWidth
          size="sm"
          type="number"
          required
          min="0"
          step="any"
          value={row.draft.plannedQty}
          disabled={locked(row)}
          disabledReason={row.confirmed ? t.confirmedLock : undefined}
          error={fieldError(row, 'plannedQty')}
          onChange={(event) => onChange(row.key, 'plannedQty', event.target.value)}
        />
      ),
    },
    {
      key: 'bomId',
      header: t.columns.bomId,
      width: '15rem',
      render: (row) => select(row, 'bomId', t.columns.bomId, bomOptions),
    },
    {
      key: 'routingId',
      header: t.columns.routingId,
      width: '15rem',
      render: (row) => select(row, 'routingId', t.columns.routingId, routingOptions),
    },
    {
      key: 'plannedLineId',
      header: t.columns.plannedLineId,
      width: '17rem',
      render: (row) => select(row, 'plannedLineId', t.columns.plannedLineId, lineOptions),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '10rem',
      align: 'center',
      render: (row) => (
        <span className="production-plan-table-value production-plan-table-value-center">
          <Chip status={row.confirmed ? 'success' : row.isPending ? 'warning' : 'info'}>
            {row.confirmed ? t.confirmedChip : row.isPending ? t.savingChip : row.statusCode}
          </Chip>
        </span>
      ),
    },
    {
      key: 'remarks',
      header: t.columns.remarks,
      width: '12rem',
      render: (row) => (
        <TextField
          aria-label={t.fieldLabel(rowName(row), t.columns.remarks)}
          fullWidth
          size="sm"
          value={row.draft.remarks}
          disabled={locked(row)}
          onChange={(event) => onChange(row.key, 'remarks', event.target.value)}
        />
      ),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      width: '15rem',
      align: 'end',
      render: (row) =>
        renderActions?.(row) ?? (
          <Button
            size="sm"
            variant="text"
            disabled={row.confirmed}
            loading={row.isPending}
            onClick={() => onRemove(row.key)}
          >
            {t.remove}
          </Button>
        ),
    },
  ];
  const total =
    summary === null
      ? t.totalUnknown
      : t.total(quantity(summary.totalPlannedQty), quantity(orderQty), uomLabel);
  return (
    <section className="pane production-plan-section" aria-label={t.pane}>
      <div className="production-plan-section-heading">
        <span className="production-plan-step" aria-hidden="true">
          2
        </span>
        <h2>{t.heading}</h2>
        <Button size="sm" variant="outlined" disabled={addDisabled} onClick={onAdd}>
          {t.add}
        </Button>
      </div>
      <div className="wide-table production-plan-table">
        <Table
          className="production-plan-editor-table"
          caption={<span className="production-plan-table-caption">{t.tableCaption}</span>}
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.key}
          empty={<p>{t.empty}</p>}
          summaryRows={[
            [
              { key: 'label', content: t.totalLabel, colSpan: 2, emphasis: true },
              { key: 'total', content: total, colSpan: 7, align: 'end', emphasis: true },
            ],
          ]}
        />
      </div>
      {summary === null ? (
        <AlertBanner variant="error" title={summaryText.invalid} />
      ) : summary.relation === 'empty' ? (
        <AlertBanner variant="error" title={summaryText.empty} />
      ) : summary.relation === 'over' ? (
        <AlertBanner
          variant="warning"
          title={summaryText.over(quantity(-summary.remainingQty), uomLabel)}
        >
          {summaryText.overDescription}
        </AlertBanner>
      ) : summary.relation === 'under' ? (
        <AlertBanner
          variant="info"
          title={summaryText.under(quantity(summary.remainingQty), uomLabel)}
        >
          {summaryText.underDescription}
        </AlertBanner>
      ) : (
        <AlertBanner variant="success" title={summaryText.matched} />
      )}
    </section>
  );
};

import { AlertBanner, Button, Chip, DatePicker, TextField, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';

import { ReferenceField } from '../../../patterns/reference-picker';
import { SelectableTable } from '../../../patterns/selectable-table';
import type {
  ProductionPlanDraftErrors,
  ProductionPlanDraftField,
} from '../../production-plan/editor-model';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import { formatQty } from './process-model';
import { useLineSource } from './reference-sources';

/**
 * 생산계획 단계 본문. 한 행 입력 칸은 계획일, 계획 수량, 라인, 비고 넷(C-16). BOM과 Routing은 마스터 점검 단계에서 정한다.
 * 행에는 저장과 확정 버튼이 없다. 하단 바 [전개 확정]이 바뀐 줄을 함께 저장하고 확정한다(T-W-C 중간 단계의 확정).
 * 행 동작은 작성 중 계획의 [삭제] 하나(오른쪽 고정 열, C-1).
 */
const t = messages.erpWorkOrderFlow.process.plan;

export interface PlanLine {
  id: number;
  code: string;
  name: string;
}

export interface PlanStepProps {
  rows: ProductionPlanEditorStateRow[];
  orderQty: number;
  uomLabel: string;
  plantId: number | null;
  lines: readonly PlanLine[];
  statusNameOf: (code: string) => string;
  disabled: boolean;
  /** 저장이나 확정에 실패한 줄의 서버 문구 */
  failures: string[];
  onAdd: () => void;
  onChange: (key: string, field: ProductionPlanDraftField, value: string) => void;
  onRemove: (row: ProductionPlanEditorStateRow) => void;
}

const errorText = (
  errors: ProductionPlanDraftErrors,
  field: ProductionPlanDraftField,
): string | undefined => {
  const error = errors[field];
  if (error === undefined) return undefined;
  if (typeof error === 'object') return error.message;
  return t.errors[error];
};

export const PlanStep = ({
  rows,
  orderQty,
  uomLabel,
  plantId,
  lines,
  statusNameOf,
  disabled,
  failures,
  onAdd,
  onChange,
  onRemove,
}: PlanStepProps) => {
  const lineSource = useLineSource(plantId);
  const rowName = (row: ProductionPlanEditorStateRow) => row.planNo ?? t.newRow(row.displayNo);
  const lineLabel = (value: string) => {
    const line = lines.find((item) => String(item.id) === value);
    return line === undefined ? '' : named(line.name, line.code);
  };
  const total = rows.reduce((sum, row) => {
    const qty = Number(row.draft.plannedQty);
    return Number.isFinite(qty) ? sum + qty : sum;
  }, 0);
  const columns: Column<ProductionPlanEditorStateRow>[] = [
    {
      key: 'planNo',
      header: t.columns.planNo,
      render: (row) => <span className="nowrap-cell mono-cell">{rowName(row)}</span>,
    },
    {
      key: 'planDate',
      header: t.columns.planDate,
      render: (row) =>
        row.confirmed ? (
          <span className="nowrap-cell">{row.draft.planDate}</span>
        ) : (
          <DatePicker
            size="sm"
            aria-label={t.fieldLabel(rowName(row), t.columns.planDate)}
            value={row.draft.planDate === '' ? null : row.draft.planDate}
            invalid={errorText(row.errors, 'planDate') !== undefined}
            disabled={disabled}
            onChange={(value) => onChange(row.key, 'planDate', value)}
          />
        ),
    },
    {
      key: 'plannedQty',
      header: t.columns.plannedQty,
      align: 'end',
      render: (row) =>
        row.confirmed ? (
          <span className="nowrap-cell">{formatQty(Number(row.draft.plannedQty))}</span>
        ) : (
          <TextField
            size="sm"
            containerClassName="plan-qty-field"
            inputMode="decimal"
            aria-label={t.fieldLabel(rowName(row), t.columns.plannedQty)}
            value={row.draft.plannedQty}
            error={errorText(row.errors, 'plannedQty')}
            disabled={disabled}
            onChange={(event) => onChange(row.key, 'plannedQty', event.target.value)}
          />
        ),
    },
    {
      key: 'line',
      header: t.columns.line,
      render: (row) =>
        row.confirmed ? (
          <span className="ellipsis-cell" title={lineLabel(row.draft.plannedLineId)}>
            {lineLabel(row.draft.plannedLineId)}
          </span>
        ) : (
          <ReferenceField
            hideLabel
            size="sm"
            label={t.fieldLabel(rowName(row), t.columns.line)}
            valueLabel={lineLabel(row.draft.plannedLineId)}
            source={lineSource}
            disabled={disabled}
            invalid={errorText(row.errors, 'plannedLineId') !== undefined}
            onPick={(line) => onChange(row.key, 'plannedLineId', String(line.id))}
            onClear={() => onChange(row.key, 'plannedLineId', '')}
          />
        ),
    },
    {
      key: 'status',
      header: t.columns.status,
      render: (row) => (
        <Chip variant="status" size="sm" status={row.confirmed ? 'success' : 'idle'}>
          {row.productionPlanId === null ? t.newStatus : statusNameOf(row.statusCode)}
        </Chip>
      ),
    },
    {
      key: 'remarks',
      header: t.columns.remarks,
      render: (row) =>
        row.confirmed ? (
          <span className="ellipsis-cell" title={row.draft.remarks}>
            {row.draft.remarks}
          </span>
        ) : (
          <TextField
            size="sm"
            aria-label={t.fieldLabel(rowName(row), t.columns.remarks)}
            value={row.draft.remarks}
            disabled={disabled}
            onChange={(event) => onChange(row.key, 'remarks', event.target.value)}
          />
        ),
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">{t.columns.actions}</span>,
      align: 'end',
      render: (row) =>
        row.confirmed ? null : (
          <Button
            size="sm"
            variant="outlined"
            aria-label={t.remove(rowName(row))}
            disabled={disabled}
            onClick={() => onRemove(row)}
          >
            {t.removeShort}
          </Button>
        ),
    },
  ];

  return (
    <section className="pane erp-wo-step-pane" aria-label={t.heading}>
      <div className="section-heading-row">
        <h2 className="section-title">{t.heading}</h2>
        <Button variant="outlined" disabled={disabled} onClick={onAdd}>
          {t.add}
        </Button>
      </div>
      {failures.length > 0 && (
        <AlertBanner variant="error" title={t.failedTitle}>
          <ul className="erp-wo-plain-list">
            {failures.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </AlertBanner>
      )}
      <SelectableTable
        className="plan-table"
        stickyLastColumn
        columns={columns}
        rows={rows}
        getRowId={(row) => row.key}
        empty={<p className="empty-line">{t.empty}</p>}
        summaryRows={[
          [
            {
              key: 'total',
              colSpan: columns.length,
              emphasis: true,
              content: t.total(formatQty(total), formatQty(orderQty), uomLabel),
            },
          ],
        ]}
      />
    </section>
  );
};

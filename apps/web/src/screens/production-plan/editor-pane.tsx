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
import type { ReactNode } from 'react';
import {
  summarizeProductionPlanQuantities,
  type ProductionPlanDraft,
  type ProductionPlanDraftErrors,
  type ProductionPlanDraftField,
} from './editor-model';
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
  onAdd: () => void;
  onChange: (key: string, field: ProductionPlanDraftField, value: string) => void;
  onRemove: (key: string) => void;
  renderActions?: (row: ProductionPlanEditorRow) => ReactNode;
}
const errorMessage = (code: ProductionPlanDraftErrors[ProductionPlanDraftField]): string | null => {
  if (typeof code === 'object') return code.message;
  if (code === 'REQUIRED') return '필수 값입니다.';
  if (code === 'INVALID_DATE') return '올바른 날짜를 선택하세요.';
  if (code === 'INVALID_QUANTITY') return '0보다 큰 수량을 입력하세요.';
  if (code === 'INVALID_SELECTION') return '올바른 항목을 선택하세요.';
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
  onAdd,
  onChange,
  onRemove,
  renderActions,
}: ProductionPlanEditorPaneProps) => {
  const summary = quantitySummary(orderQty, rows);
  const fieldError = (row: ProductionPlanEditorRow, field: ProductionPlanDraftField) =>
    errorMessage(row.errors[field]);
  const locked = (row: ProductionPlanEditorRow) => row.confirmed || row.isPending;
  const rowName = (row: ProductionPlanEditorRow) =>
    row.planNo ?? `신규 계획 ${String(row.displayNo)}`;
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
      <>
        <Select
          aria-label={`${rowName(row)} ${label}`}
          aria-describedby={error === null ? undefined : errorId}
          aria-required={optional ? undefined : true}
          size="sm"
          value={optional && row.draft[field] === '' ? NO_LINE : row.draft[field]}
          options={optional ? [{ value: NO_LINE, label: '미지정' }, ...options] : options}
          placeholder="선택"
          disabled={locked(row)}
          invalid={error !== null}
          onChange={(value) => onChange(row.key, field, value === NO_LINE ? '' : value)}
        />
        {error !== null && (
          <span id={errorId} className="field-error">
            {error}
          </span>
        )}
      </>
    );
  };
  const columns: Column<ProductionPlanEditorRow>[] = [
    { key: 'planNo', header: '계획번호', render: rowName },
    {
      key: 'planDate',
      header: '계획일',
      render: (row) => (
        <>
          <DatePicker
            aria-label={`${rowName(row)} 계획일`}
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
        </>
      ),
    },
    {
      key: 'plannedQty',
      header: '수량',
      align: 'end',
      render: (row) => (
        <TextField
          aria-label={`${rowName(row)} 계획수량`}
          size="sm"
          type="number"
          required
          min="0"
          step="any"
          value={row.draft.plannedQty}
          disabled={locked(row)}
          disabledReason={row.confirmed ? '확정된 계획은 수정할 수 없습니다.' : undefined}
          error={fieldError(row, 'plannedQty')}
          onChange={(event) => onChange(row.key, 'plannedQty', event.target.value)}
        />
      ),
    },
    {
      key: 'bomId',
      header: 'BOM Rev',
      render: (row) => select(row, 'bomId', 'BOM Rev', bomOptions),
    },
    {
      key: 'routingId',
      header: 'Routing Rev',
      render: (row) => select(row, 'routingId', 'Routing Rev', routingOptions),
    },
    {
      key: 'plannedLineId',
      header: '라인',
      render: (row) => select(row, 'plannedLineId', '라인', lineOptions),
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => (
        <Chip status={row.confirmed ? 'success' : row.isPending ? 'warning' : 'info'}>
          {row.confirmed ? '확정 · 편집 불가' : row.isPending ? '저장 중' : row.statusCode}
        </Chip>
      ),
    },
    {
      key: 'remarks',
      header: '비고',
      render: (row) => (
        <TextField
          aria-label={`${rowName(row)} 비고`}
          size="sm"
          value={row.draft.remarks}
          disabled={locked(row)}
          onChange={(event) => onChange(row.key, 'remarks', event.target.value)}
        />
      ),
    },
    {
      key: 'actions',
      header: '작업',
      render: (row) =>
        renderActions?.(row) ?? (
          <Button
            size="sm"
            variant="text"
            disabled={row.confirmed}
            loading={row.isPending}
            onClick={() => onRemove(row.key)}
          >
            삭제
          </Button>
        ),
    },
  ];
  const total =
    summary === null
      ? '합계 계산 불가'
      : `${quantity(summary.totalPlannedQty)} / ${quantity(orderQty)} ${uomLabel}`;
  return (
    <section className="pane" aria-label="생산계획 편집">
      <div className="section-heading-row">
        <h2>② 생산계획</h2>
        <Button size="sm" variant="outlined" onClick={onAdd}>
          + 계획 추가
        </Button>
      </div>
      <Table
        caption="P/O 생산계획 편집 표"
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.key}
        empty={<p>등록된 계획이 없습니다.</p>}
        summaryRows={[
          [
            { key: 'label', content: '합계', colSpan: 2, emphasis: true },
            { key: 'total', content: total, colSpan: 7, align: 'end', emphasis: true },
          ],
        ]}
      />
      {summary === null ? (
        <AlertBanner variant="error" title="계획 수량 오류를 먼저 수정하세요." />
      ) : summary.relation === 'empty' ? (
        <AlertBanner variant="error" title="계획을 1건 이상 추가해야 전개할 수 있습니다." />
      ) : summary.relation === 'over' ? (
        <AlertBanner
          variant="warning"
          title={`P/O 수량보다 ${quantity(-summary.remainingQty)} ${uomLabel} 초과합니다.`}
        >
          초과 생산 정책을 확인하세요.
        </AlertBanner>
      ) : summary.relation === 'under' ? (
        <AlertBanner
          variant="info"
          title={`P/O 수량보다 ${quantity(summary.remainingQty)} ${uomLabel} 부족합니다.`}
        >
          나눠 계획하는 중이면 계속 편집하세요.
        </AlertBanner>
      ) : (
        <AlertBanner variant="success" title="계획 수량 합계가 P/O 수량과 일치합니다." />
      )}
    </section>
  );
};

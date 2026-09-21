import {
  AlertBanner,
  Button,
  Chip,
  DatePicker,
  Dialog,
  Select,
  Table,
  TextArea,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const [remarksRowKey, setRemarksRowKey] = useState<string | null>(null);
  const [remarksDraft, setRemarksDraft] = useState('');
  const remarksInputRef = useRef<HTMLTextAreaElement | null>(null);
  const remarksRow = rows.find((row) => row.key === remarksRowKey) ?? null;
  /** 확정된 줄의 비고는 읽기만 한다. */
  const remarksReadOnly = remarksRow !== null && (remarksRow.confirmed || remarksRow.isPending);
  /*
   * 창이 열리면 이미 적힌 글 «끝»에 커서를 둔다 — 맨 앞에서 시작하면 이어 쓰려던 글이 앞에
   * 끼어든다(사용자 지시 2026-09-21).
   */
  useEffect(() => {
    if (remarksRowKey === null) return;
    const node = remarksInputRef.current;
    if (node === null) return;
    if (remarksReadOnly) {
      /*
       * 읽기만 하는 창은 칸에 커서를 두지 않는다 — 창이 열릴 때 칸이 초점을 잡으면 테두리가
       * 「고르는 중」으로 밝아져 쓸 수 있어 보인다(브라우저 실측 2026-09-21). 초점은 닫기로.
       */
      const buttons = node.closest('dialog')?.querySelectorAll('button') ?? [];
      buttons[buttons.length - 1]?.focus();
      return;
    }
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [remarksReadOnly, remarksRowKey]);
  const summary = quantitySummary(orderQty, rows);
  const fieldError = (row: ProductionPlanEditorRow, field: ProductionPlanDraftField) =>
    errorMessage(row.errors[field]);
  /*
   * 필수 열은 머리글이 이미 「* 필수 입력」이라고 말한다 — 칸 아래에 같은 말을 다시 쓰지 않는다
   * (사용자 지시 2026-09-21). 빨간 테두리는 그대로 둔다.
   */
  /** 아직 비어 있는 필수 칸 — 문구 없이 테두리만 붉게 해서 눈에 띄게 한다(사용자 지시 2026-09-21). */
  const missingRequired = (row: ProductionPlanEditorRow, field: 'planDate' | 'plannedQty') =>
    !row.confirmed && row.draft[field].trim() === '';
  const shownError = (row: ProductionPlanEditorRow, field: ProductionPlanDraftField) => {
    const message = fieldError(row, field);
    return message === messages.productionPlan.draftErrors.REQUIRED ? null : message;
  };
  const locked = (row: ProductionPlanEditorRow) => row.confirmed || row.isPending;
  /*
   * 확정된 줄은 «읽는» 값이다 — 입력칸을 잠가 두는 대신 글자로 보인다(사용자 지시 2026-09-20).
   * 저장 중인 줄은 곧 다시 쓸 수 있으므로 입력칸을 그대로 두고 잠그기만 한다.
   */
  const optionLabel = (options: ProductionPlanEditorOption[], value: string, fallback: string) =>
    options.find((option) => option.value === value)?.label ?? fallback;
  const readOnlyValue = (text: string) => (
    <span className="production-plan-table-value">
      {text.trim() === '' ? messages.common.reference.empty : text}
    </span>
  );
  const rowName = (row: ProductionPlanEditorRow) => row.planNo ?? t.newRow(row.displayNo);
  /*
   * 쓸 수 있는 줄이 하나도 없으면 필수 표시를 내지 않는다 — 읽기만 하는 표에 「필수 입력」은
   * 할 일이 없다(사용자 지시 2026-09-21).
   */
  const hasEditableRow = rows.some((row) => !row.confirmed);
  /*
   * 필수 열 머리글 — 빨간 별표만 이름 옆에 둔다. 「필수 입력」 문구와 작은 글자는 빼고 다른 열
   * 머리글과 같은 크기로 읽는다(사용자 지시 2026-09-21).
   */
  const requiredHeader = (label: string) =>
    !hasEditableRow ? (
      label
    ) : (
      <span className="production-plan-required-header">
        {label}
        <span className="required-mark" aria-hidden="true">
          {' '}
          *
        </span>
      </span>
    );
  const select = (
    row: ProductionPlanEditorRow,
    field: 'bomId' | 'routingId' | 'plannedLineId',
    label: string,
    options: ProductionPlanEditorOption[],
  ) => {
    const optional = field === 'plannedLineId';
    if (row.confirmed) {
      return readOnlyValue(
        optionLabel(
          options,
          row.draft[field],
          optional ? t.lineUnset : messages.common.reference.empty,
        ),
      );
    }

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
      width: '11%',
      render: (row) => <span className="production-plan-table-value">{rowName(row)}</span>,
    },
    {
      key: 'planDate',
      header: requiredHeader(t.columns.planDate),
      width: '10%',
      render: (row) =>
        row.confirmed ? (
          readOnlyValue(row.draft.planDate)
        ) : (
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
              invalid={fieldError(row, 'planDate') !== null || missingRequired(row, 'planDate')}
              onChange={(value) => onChange(row.key, 'planDate', value)}
            />
            {shownError(row, 'planDate') !== null && (
              <span id={`${row.key}-planDate-error`} className="field-error">
                {shownError(row, 'planDate')}
              </span>
            )}
          </div>
        ),
    },
    {
      key: 'plannedQty',
      header: requiredHeader(t.columns.plannedQty),
      width: '7.5%',
      align: 'center',
      render: (row) =>
        row.confirmed ? (
          readOnlyValue(row.draft.plannedQty)
        ) : (
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
            /* 확정 안내는 줄마다 큰 글로 반복하지 않는다 — 상태 칩이 말하고, 칸에는 짧게 붙인다. */
            title={row.confirmed ? t.confirmedLock : undefined}
            /*
             * 필수 누락은 머리글이 말한다 — 칸에는 붉은 테두리만 남긴다. 테두리를 켜는 스위치가
             * 「오류 글」이라 글을 «보이지 않게» 실어 보낸다(사용자 지시 2026-09-21).
             */
            error={
              fieldError(row, 'plannedQty') === null && !missingRequired(row, 'plannedQty')
                ? undefined
                : (shownError(row, 'plannedQty') ?? (
                    <span className="production-plan-visually-hidden">
                      {messages.productionPlan.draftErrors.REQUIRED}
                    </span>
                  ))
            }
            onChange={(event) => onChange(row.key, 'plannedQty', event.target.value)}
          />
        ),
    },
    {
      key: 'bomId',
      header: t.columns.bomId,
      width: '18%',
      render: (row) => select(row, 'bomId', t.columns.bomId, bomOptions),
    },
    {
      key: 'routingId',
      header: t.columns.routingId,
      width: '19%',
      render: (row) => select(row, 'routingId', t.columns.routingId, routingOptions),
    },
    {
      key: 'plannedLineId',
      header: t.columns.plannedLineId,
      width: '12%',
      render: (row) => select(row, 'plannedLineId', t.columns.plannedLineId, lineOptions),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '9%',
      align: 'center',
      render: (row) => (
        <span className="production-plan-table-value production-plan-table-value-center">
          <Chip size="sm" status={row.confirmed ? 'success' : row.isPending ? 'warning' : 'info'}>
            {row.confirmed ? t.confirmedChip : row.isPending ? t.savingChip : row.statusCode}
          </Chip>
        </span>
      ),
    },
    {
      key: 'remarks',
      header: t.columns.remarks,
      /* 단추 하나가 들어갈 만큼은 준다 — 좁으면 단추가 칸 밖으로 밀려 가운데가 어긋난다. */
      width: '7rem',
      align: 'center',
      /*
       * 칸이 좁아 긴 글을 적기 어렵다 — 창을 열어 적는다(사용자 지시 2026-09-20).
       * 잠긴 줄은 적지 못하므로 적힌 비고가 있을 때만 「확인」 단추를 둔다.
       */
      render: (row) => {
        const written = row.draft.remarks.trim() !== '';

        /* 적힌 비고가 없는 잠긴 줄은 빈 칸 대신 공통 표기를 둔다(사용자 지시 2026-09-20). */
        if (locked(row) && !written) {
          return (
            <span className="production-plan-table-value">{messages.common.reference.empty}</span>
          );
        }

        return (
          <Button
            size="sm"
            variant="outlined"
            className="production-plan-remarks-button"
            aria-label={
              locked(row) ? t.remarksViewLabel(rowName(row)) : t.remarksEdit(rowName(row))
            }
            onClick={() => {
              setRemarksDraft(row.draft.remarks);
              setRemarksRowKey(row.key);
            }}
          >
            {locked(row) ? t.remarksView : written ? t.remarksWritten : t.remarksEmpty}
          </Button>
        );
      },
    },
    {
      key: 'actions',
      /* 줄 단추 묶음이라 머리글에 이름을 두지 않는다(사용자 지시 2026-09-20). */
      header: <span className="production-plan-actions-header">{t.columns.actions}</span>,
      width: '12rem',
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
        <span className="production-plan-section-note">{t.confirmedNotice}</span>
        <Button variant="outlined" disabled={addDisabled} onClick={onAdd}>
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
      {remarksRow !== null && (
        <Dialog
          open
          title={t.remarksDialog}
          showCloseButton={false}
          onClose={() => setRemarksRowKey(null)}
          footer={
            locked(remarksRow) ? (
              <Button variant="outlined" onClick={() => setRemarksRowKey(null)}>
                {messages.common.close}
              </Button>
            ) : (
              <>
                <Button variant="outlined" onClick={() => setRemarksRowKey(null)}>
                  {messages.common.cancel}
                </Button>
                <Button
                  variant="filled"
                  onClick={() => {
                    onChange(remarksRow.key, 'remarks', remarksDraft);
                    setRemarksRowKey(null);
                  }}
                >
                  {messages.common.confirm}
                </Button>
              </>
            )
          }
        >
          <TextArea
            fullWidth
            rows={4}
            ref={remarksInputRef}
            /* 읽기만 하는 창은 누를 수도, 크기를 바꿀 수도 없다(사용자 지시 2026-09-21). */
            {...(remarksReadOnly ? { tabIndex: -1, resize: 'none' as const } : {})}
            containerClassName={remarksReadOnly ? 'production-plan-remarks-readonly' : undefined}
            aria-label={t.columns.remarks}
            value={remarksDraft}
            readOnly={locked(remarksRow)}
            onChange={(event) => setRemarksDraft(event.target.value)}
          />
        </Dialog>
      )}
      {/* 줄 단추가 만든 오류 안내가 서는 자리 — 좁은 칸 대신 표 아래에서 읽는다. */}
      <div className="production-plan-row-errors" data-plan-error-slot="" />
      {summary === null ? (
        <AlertBanner
          className="production-plan-summary-banner"
          variant="error"
          title={summaryText.invalid}
        />
      ) : summary.relation === 'empty' ? (
        <AlertBanner
          className="production-plan-summary-banner"
          variant="error"
          title={summaryText.empty}
        />
      ) : summary.relation === 'over' ? (
        <AlertBanner
          className="production-plan-summary-banner"
          variant="warning"
          title={summaryText.over()}
        >
          <span className="production-plan-summary-facts">
            {summaryText.overFacts(quantity(orderQty), quantity(summary.totalPlannedQty), uomLabel)}
          </span>
        </AlertBanner>
      ) : summary.relation === 'under' ? (
        <AlertBanner
          className="production-plan-summary-banner"
          variant="info"
          title={summaryText.under(quantity(summary.remainingQty), uomLabel)}
        >
          {summaryText.underDescription}
        </AlertBanner>
      ) : (
        <AlertBanner
          className="production-plan-summary-banner"
          variant="success"
          title={summaryText.matched}
        />
      )}
    </section>
  );
};

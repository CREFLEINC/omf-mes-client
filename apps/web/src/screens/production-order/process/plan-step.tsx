import {
  AlertBanner,
  Button,
  Chip,
  DatePicker,
  Tabs,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { plantToday } from '../../../patterns/plant-time';
import { ReferenceField } from '../../../patterns/reference-picker';
import { SelectableTable } from '../../../patterns/selectable-table';
import type {
  ProductionPlanDraftErrors,
  ProductionPlanDraftField,
} from '../../production-plan/editor-model';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import { formatQty } from './process-model';
import { planWeek, shiftPlanDate } from './plan-view-model';
import { useLineSource } from './reference-sources';
import { DistributionControls } from './distribution-controls';
import { distributePlans, type ScheduledDraft } from './distribution-model';

const t = messages.erpWorkOrderFlow.process.plan;
const ui = t.workspace;

export interface PlanLine {
  id: number;
  code: string;
  name: string;
}
export interface PlanStepProps {
  rows: ProductionPlanEditorStateRow[];
  orderQty: number;
  confirmedQty?: number | null;
  uomLabel: string;
  plantId: number | null;
  lines: readonly PlanLine[];
  statusNameOf: (code: string) => string;
  disabled: boolean;
  failures: string[];
  onAdd: () => void;
  viewMode?: 'grid' | 'week';
  hideTotals?: boolean;
  orderNameOf?: (row: ProductionPlanEditorStateRow) => string;
  onAppend?: (drafts: ScheduledDraft[]) => void;
  onSplit?: (row: ProductionPlanEditorStateRow, quantity: number) => void;
  onChange: (key: string, field: ProductionPlanDraftField, value: string) => void;
  onRemove: (row: ProductionPlanEditorStateRow) => void;
}

const errorText = (errors: ProductionPlanDraftErrors, field: ProductionPlanDraftField) => {
  const error = errors[field];
  return error === undefined
    ? undefined
    : typeof error === 'object'
      ? error.message
      : t.errors[error];
};

/** T-W-C: 조회·편집 보기만 바꾸며 저장·확정은 기존 편집 세션과 하단 바를 그대로 쓴다. */
export const PlanStep = ({
  rows,
  orderQty,
  confirmedQty,
  uomLabel,
  plantId,
  lines,
  statusNameOf,
  disabled,
  failures,
  onAdd,
  onAppend,
  onSplit,
  hideTotals = false,
  viewMode,
  orderNameOf,
  onChange,
  onRemove,
}: PlanStepProps) => {
  const [localView, setView] = useState('grid');
  const view = viewMode ?? localView;
  const [splitQty, setSplitQty] = useState('');
  const [splitError, setSplitError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectAdded, setSelectAdded] = useState(false);
  const beforeAdded = useRef<ReadonlySet<string> | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const editorId = useId();
  const lineSource = useLineSource(plantId);
  const selected =
    rows.find((row) => row.key === selectedKey) ?? rows.find((row) => !row.confirmed) ?? rows[0];
  useEffect(() => {
    if (!selectAdded || beforeAdded.current === null) return;
    const added = rows.find((row) => !beforeAdded.current?.has(row.key));
    if (!added) return;
    setSelectedKey(added.key);
    setSelectAdded(false);
    beforeAdded.current = null;
  }, [rows, selectAdded]);

  const nameOf = (row: ProductionPlanEditorStateRow) => row.planNo ?? t.newRow(row.displayNo);
  const lineName = (value: string) => {
    const line = lines.find((line) => String(line.id) === value);
    return line === undefined ? ui.unassigned : named(line.name, line.code);
  };
  const week = planWeek(anchor ?? (selected?.draft.planDate || plantToday()));
  const total = rows.reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0);
  const draftQty = rows
    .filter((row) => !row.confirmed)
    .reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0);
  const remaining = confirmedQty == null ? null : orderQty - confirmedQty - draftQty;
  const displayQty = (qty: number | null | undefined) =>
    qty == null ? '—' : `${formatQty(qty)} ${uomLabel}`;
  const choose = (row: ProductionPlanEditorStateRow) => setSelectedKey(row.key);
  const columns: Column<ProductionPlanEditorStateRow>[] = [
    ...(orderNameOf
      ? [
          {
            key: 'order',
            header: 'ERP W/O / 품목',
            width: '12rem',
            render: (row: ProductionPlanEditorStateRow) => (
              <span className="erp-wo-plan-order">{orderNameOf(row)}</span>
            ),
          },
        ]
      : []),
    {
      key: 'planNo',
      header: t.columns.planNo,
      render: (row) => (
        <span className="ellipsis-cell" title={nameOf(row)}>
          {nameOf(row)}
        </span>
      ),
    },
    {
      key: 'planDate',
      header: t.columns.planDate,
      width: '7rem',
      render: (row) => row.draft.planDate,
    },
    {
      key: 'plannedQty',
      header: t.columns.plannedQty,
      width: '6rem',
      align: 'end',
      render: (row) => formatQty(Number(row.draft.plannedQty) || 0),
    },
    {
      key: 'line',
      header: t.columns.line,
      render: (row) => (
        <span className="ellipsis-cell" title={lineName(row.draft.plannedLineId)}>
          {lineName(row.draft.plannedLineId)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '6rem',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.confirmed ? 'success' : 'idle'}>
          {row.confirmed ? statusNameOf(row.statusCode) : ui.unconfirmed}
        </Chip>
      ),
    },
  ];
  const groups = [...new Set(rows.map((row) => row.draft.plannedLineId))];
  const outsideWeek = rows.filter((row) => !week.includes(row.draft.planDate));
  const editDisabled = disabled || selected?.confirmed === true;

  return (
    <section className="erp-wo-plan-workspace" aria-label={t.heading}>
      <div className="erp-wo-plan-toolbar">
        {viewMode && <h2 className="section-title">{ui.weekHeading}</h2>}
        {!viewMode && (
          <Tabs
            size="sm"
            aria-label={ui.views}
            value={view}
            onChange={setView}
            items={[
              { value: 'grid', label: ui.grid, content: null },
              { value: 'week', label: ui.week, content: null },
            ]}
          />
        )}
        <Button
          variant="outlined"
          disabled={disabled}
          onClick={() => {
            beforeAdded.current = new Set(rows.map((row) => row.key));
            onAdd();
            setSelectAdded(true);
          }}
        >
          {t.add}
        </Button>
      </div>
      {onAppend && (
        <DistributionControls
          lines={lines}
          disabled={disabled}
          onDistribute={(options) => {
            const result = distributePlans(
              [{ id: 'single', remaining: remaining ?? Math.max(0, orderQty - total) }],
              options,
              rows.map((row) => row.draft),
            );
            onAppend(result.drafts);
            return `${result.drafts.length}개 계획 추가 / 편성 대기 ${result.pending} ${uomLabel}. 저장 전 날짜, 라인, 수량을 수정할 수 있습니다.`;
          }}
        />
      )}
      {!hideTotals && (
        <dl className="erp-wo-plan-totals">
          {[
            [ui.orderQty, orderQty],
            [ui.confirmedQty, confirmedQty],
            [ui.draftQty, draftQty],
            [ui.remainingQty, remaining],
          ].map(([label, qty]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd>{displayQty(qty as number | null | undefined)}</dd>
            </div>
          ))}
        </dl>
      )}
      {!viewMode && rows.some((row) => row.isDirty) && (
        <p className="field-note erp-wo-plan-note">{ui.unsavedSummary}</p>
      )}
      {failures.length > 0 && (
        <AlertBanner variant="error" title={t.failedTitle}>
          <ul className="erp-wo-plain-list">
            {failures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        </AlertBanner>
      )}
      <div className="erp-wo-plan-layout">
        <section
          className="pane erp-wo-plan-board"
          aria-label={view === 'week' ? ui.week : ui.grid}
        >
          <h2 className="section-title erp-wo-plan-board-title">
            {view === 'week' ? ui.weekHeading : ui.gridHeading}
          </h2>
          {view === 'grid' ? (
            <SelectableTable
              className="erp-wo-plan-grid"
              columns={columns}
              rows={rows}
              getRowId={(row) => row.key}
              activeId={selected?.key}
              rowLabel={(row) => nameOf(row)}
              onActivate={choose}
              empty={<p className="empty-line">{t.empty}</p>}
            />
          ) : (
            <>
              <div className="erp-wo-week-heading">
                <span>
                  {week[0]} — {week.at(-1)}
                </span>
                <div className="erp-wo-week-actions">
                  <Button
                    size="sm"
                    variant="outlined"
                    aria-label={ui.previousWeek}
                    onClick={() => setAnchor(shiftPlanDate(week[0] ?? plantToday(), -7))}
                  >
                    ‹
                  </Button>
                  <Button
                    size="sm"
                    variant="outlined"
                    aria-label={ui.nextWeek}
                    onClick={() => setAnchor(shiftPlanDate(week[0] ?? plantToday(), 7))}
                  >
                    ›
                  </Button>
                </div>
              </div>
              <div className="erp-wo-week-scroll">
                <table className="erp-wo-week-table">
                  <caption className="visually-hidden">{ui.week}</caption>
                  <thead>
                    <tr>
                      <th>{t.columns.line}</th>
                      {week.map((date, index) => (
                        <th key={date}>
                          {date.slice(5)}
                          <span>{ui.weekdays[index]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group}>
                        <th>
                          <span title={lineName(group)}>{lineName(group)}</span>
                        </th>
                        {week.map((date) => (
                          <td key={date}>
                            {rows
                              .filter(
                                (row) =>
                                  row.draft.plannedLineId === group && row.draft.planDate === date,
                              )
                              .map((row) => (
                                <button
                                  key={row.key}
                                  className="erp-wo-week-plan"
                                  title={`${nameOf(row)} / ${row.draft.plannedQty} ${uomLabel}`}
                                  aria-label={ui.selectPlan(nameOf(row))}
                                  aria-pressed={selected?.key === row.key}
                                  aria-controls={editorId}
                                  onClick={() => choose(row)}
                                >
                                  <span>{nameOf(row)}</span>
                                  <strong>
                                    {orderNameOf && <small>{orderNameOf(row)}</small>}
                                    {formatQty(Number(row.draft.plannedQty) || 0)} {uomLabel}
                                  </strong>
                                  <small>
                                    {row.confirmed ? statusNameOf(row.statusCode) : ui.unconfirmed}
                                  </small>
                                </button>
                              ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <p className="empty-line">{t.empty}</p>}
              {outsideWeek.length > 0 && (
                <div className="erp-wo-plan-outside">
                  <span>{ui.outsideWeek}</span>
                  {outsideWeek.map((row) => (
                    <Button
                      key={row.key}
                      size="sm"
                      variant="text"
                      onClick={() => {
                        choose(row);
                        setAnchor(row.draft.planDate);
                      }}
                    >
                      {nameOf(row)}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
          <p className="erp-wo-plan-total">
            {t.total(formatQty(total), formatQty(orderQty), uomLabel)}
          </p>
        </section>
        <section className="pane erp-wo-plan-editor" id={editorId} aria-label={ui.editor}>
          <h2 className="section-title">{ui.editor}</h2>
          {selected === undefined ? (
            <p className="empty-line">{ui.selectPrompt}</p>
          ) : (
            <>
              {orderNameOf && (
                <p className="field-note erp-wo-plan-order">{orderNameOf(selected)}</p>
              )}
              <div className="erp-wo-plan-editor-title">
                <span className="mono-cell">{nameOf(selected)}</span>
                <Chip size="sm" variant="status" status={selected.confirmed ? 'success' : 'idle'}>
                  {selected.confirmed ? statusNameOf(selected.statusCode) : ui.unconfirmed}
                </Chip>
              </div>
              {selected.confirmed && <p className="field-note">{ui.readonly}</p>}
              <div className="field-cell">
                <label className="field-label">{t.columns.planDate}</label>
                <DatePicker
                  size="sm"
                  aria-label={t.fieldLabel(nameOf(selected), t.columns.planDate)}
                  value={selected.draft.planDate || null}
                  invalid={errorText(selected.errors, 'planDate') !== undefined}
                  disabled={editDisabled}
                  onChange={(value) => onChange(selected.key, 'planDate', value)}
                />
              </div>
              <div className="field-cell">
                <span className="field-label">{t.columns.line}</span>
                <ReferenceField
                  hideLabel
                  size="sm"
                  label={t.fieldLabel(nameOf(selected), t.columns.line)}
                  valueLabel={
                    selected.draft.plannedLineId === ''
                      ? ''
                      : lineName(selected.draft.plannedLineId)
                  }
                  source={lineSource}
                  disabled={editDisabled}
                  invalid={errorText(selected.errors, 'plannedLineId') !== undefined}
                  onPick={(line) => onChange(selected.key, 'plannedLineId', String(line.id))}
                  onClear={() => onChange(selected.key, 'plannedLineId', '')}
                />
              </div>
              <TextField
                size="sm"
                label={t.columns.plannedQty}
                aria-label={t.fieldLabel(nameOf(selected), t.columns.plannedQty)}
                inputMode="decimal"
                value={selected.draft.plannedQty}
                error={errorText(selected.errors, 'plannedQty')}
                disabled={editDisabled}
                onChange={(event) => onChange(selected.key, 'plannedQty', event.target.value)}
              />
              {onSplit && !selected.confirmed && (
                <details className="erp-wo-plan-split" key={selected.key}>
                  <summary>계획 분할</summary>
                  <TextField
                    size="sm"
                    label="분할 수량"
                    aria-label="분할 수량"
                    value={splitQty}
                    inputMode="numeric"
                    disabled={disabled}
                    onChange={(event) => {
                      setSplitQty(event.target.value);
                      setSplitError('');
                    }}
                  />
                  <p className="field-note">
                    입력 수량을 새 계획으로 나누며 총수량은 유지합니다. 새 계획의 날짜와 라인은 추가
                    후 수정하세요.
                  </p>
                  <Button
                    size="sm"
                    variant="outlined"
                    disabled={disabled}
                    onClick={() => {
                      const quantity = Number(splitQty);
                      if (
                        !Number.isSafeInteger(quantity) ||
                        quantity <= 0 ||
                        quantity >= Number(selected.draft.plannedQty)
                      ) {
                        setSplitError('원래 계획보다 작은 양의 정수를 입력하세요.');
                        return;
                      }
                      beforeAdded.current = new Set(rows.map((row) => row.key));
                      onSplit(selected, quantity);
                      setSplitQty('');
                      setSplitError('');
                      setSelectAdded(true);
                    }}
                  >
                    분할 적용
                  </Button>
                  {splitError && <p role="alert">{splitError}</p>}
                </details>
              )}
              <details className="erp-wo-plan-remarks">
                <summary>{t.columns.remarks}</summary>
                <TextField
                  size="sm"
                  aria-label={t.fieldLabel(nameOf(selected), t.columns.remarks)}
                  value={selected.draft.remarks}
                  disabled={editDisabled}
                  onChange={(event) => onChange(selected.key, 'remarks', event.target.value)}
                />
              </details>
              {!selected.confirmed && (
                <Button
                  variant="outlined"
                  size="sm"
                  aria-label={t.remove(nameOf(selected))}
                  disabled={disabled}
                  onClick={() => onRemove(selected)}
                >
                  {t.removeShort}
                </Button>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
};

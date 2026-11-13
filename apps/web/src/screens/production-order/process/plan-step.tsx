import { usePlanningDays, planningDayKey, PlanningDayNotice } from './planning-working-days';
import { WeeklyPlanCard } from './weekly-plan-card';
import { useProductionLineReferenceQuery } from '../../production-plan/reference-queries';
import { useWeeklyPlanContext, type WeeklyContextPlan } from './weekly-plan-context';
import { PlanViewSwitch } from './plan-view-switch';
import { planQuantities } from './plan-quantities';
import { PlanCreationTools } from './plan-creation-tools';
import type { PlanSplitPart } from '../../production-plan/quantity-split';
import { PlanSplitDialog } from './plan-split-dialog';
import { AlertBanner, Button, Chip, DatePicker, TextField, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { AdjustableLayout } from './adjustable-layout';
import { AdjustableTable, AdjustableNativeTable } from './adjustable-table';
import { plantToday } from '../../../patterns/plant-time';
import { ReferenceField } from '../../../patterns/reference-picker';
import type {
  ProductionPlanDraftErrors,
  ProductionPlanDraftField,
} from '../../production-plan/editor-model';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import { formatQty } from './process-model';
import { planWeek, shiftPlanDate } from './plan-view-model';
import { useLineSource } from './reference-sources';
import { DistributionControls } from './distribution-controls';
import type { ScheduledDraft } from './segmented-distribution-model';

const t = messages.erpWorkOrderFlow.process.plan;
const ui = t.workspace;

export interface PlanLine {
  id: number;
  code: string;
  name: string;
}
export interface PlanOrderGroup {
  id: string;
  orderNo: string;
  itemCode: string;
  itemName: string;
  rowKeys: readonly string[];
  summary: ReactNode;
  addDisabled: boolean;
  onAdd: () => void;
}
export interface PlanStepProps {
  planningTools?: ReactNode;
  currentOrderIds?: readonly number[];
  contextUnitLabelOf?: (uomId: number) => string;
  rowPlantIdOf?: (row: ProductionPlanEditorStateRow) => number | null;
  rowIdentityOf?: (row: ProductionPlanEditorStateRow) => {
    orderNo: string;
    itemCode: string;
    itemName: string;
  };
  planGroups?: readonly PlanOrderGroup[];
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
  addDisabled?: boolean;
  viewMode?: 'grid' | 'week';
  hideTotals?: boolean;
  hideBoardTotal?: boolean;
  hideTools?: boolean;
  hideHeading?: boolean;
  addRequest?: number;
  onSelectedKeyChange?: (key: string) => void;
  orderNameOf?: (row: ProductionPlanEditorStateRow) => string;
  orderContextOf?: (row: ProductionPlanEditorStateRow) => ReactNode;
  rowDecimalScaleOf?: (row: ProductionPlanEditorStateRow) => number | undefined;
  rowUomLabelOf?: (row: ProductionPlanEditorStateRow) => string;
  onAppend?: (drafts: ScheduledDraft[]) => void;
  distributionOrderLabel?: string;
  distributionStartDate?: string;
  distributionLines?: readonly PlanLine[];
  distributionDecimalScale?: number;
  onDistributionDirtyChange?: (dirty: boolean) => void;
  onSplit?: (row: ProductionPlanEditorStateRow, parts: PlanSplitPart[]) => void;
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
  addDisabled = false,
  onAppend,
  planningTools,
  currentOrderIds = [],
  contextUnitLabelOf,
  rowIdentityOf,
  rowPlantIdOf,
  planGroups,
  distributionOrderLabel,
  distributionStartDate,
  distributionLines,
  distributionDecimalScale,
  onDistributionDirtyChange,
  onSplit,
  hideTotals = false,
  hideBoardTotal = hideTotals,
  hideTools = false,
  hideHeading = false,
  addRequest = 0,
  onSelectedKeyChange,
  viewMode,
  orderNameOf,
  orderContextOf,
  rowUomLabelOf,
  rowDecimalScaleOf,
  onChange,
  onRemove,
}: PlanStepProps) => {
  const [localView, setView] = useState('week');
  const boardRef = useRef<HTMLElement>(null);
  const [compactCalendar, setCompactCalendar] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  useEffect(() => {
    if (!boardRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setCompactCalendar(entries[0].contentRect.width < 760);
    });
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const layout = boardRef.current?.closest<HTMLElement>('.erp-wo-plan-layout');
    const scrollport = layout?.closest<HTMLElement>('.process-page-body, .erp-wo-multi-body');
    if (!layout || !scrollport) return;
    let frame = 0;
    // 바깥 페이지와 본문이 함께 스크롤되어도 현재 보이는 영역 안에 편집기를 둔다.
    const measure = () => {
      const rect = scrollport.getBoundingClientRect();
      layout.style.setProperty('--plan-sticky-top', `${Math.max(12, 12 - rect.top)}px`);
      layout.style.setProperty(
        '--plan-sticky-height',
        `${Math.max(120, Math.min(rect.bottom, window.innerHeight) - Math.max(0, rect.top) - 24)}px`,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(scrollport);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const view = viewMode ?? localView;
  const [showAll, setShowAll] = useState(false);
  const [contextSelection, setContextSelection] = useState<number | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectAdded, setSelectAdded] = useState(false);
  const beforeAdded = useRef<ReadonlySet<string> | null>(null);
  const previousAddRequest = useRef(addRequest);
  const [anchor, setAnchor] = useState<string | null>(null);
  const editorId = useId();
  const lineSource = useLineSource(plantId);
  const displayLines = useProductionLineReferenceQuery(plantId);
  function revealEditor() {
    const editor = document.getElementById(editorId);
    const board = editor?.closest('.erp-wo-plan-layout')?.querySelector('.erp-wo-plan-board');
    if (!editor || !board) return;
    const a = editor.getBoundingClientRect(),
      b = board.getBoundingClientRect();
    if (b.height > 0 && a.top >= b.bottom - 1 && Math.abs(a.left - b.left) < 2)
      editor.scrollIntoView({ block: 'start' });
  }

  const selected =
    rows.find((row) => row.key === selectedKey) ?? rows.find((row) => !row.confirmed) ?? rows[0];
  const selectedRowKey = selected?.key;
  useEffect(() => {
    if (selectedRowKey) onSelectedKeyChange?.(selectedRowKey);
  }, [selectedRowKey, onSelectedKeyChange]);
  useEffect(() => {
    if (previousAddRequest.current === addRequest) return;
    previousAddRequest.current = addRequest;
    beforeAdded.current = new Set(rows.map((row) => row.key));
    setSelectAdded(true);
  }, [addRequest, rows]);
  useEffect(() => {
    if (!selectAdded || beforeAdded.current === null) return;
    const added = rows.find((row) => !beforeAdded.current?.has(row.key));
    if (!added) return;
    setContextSelection(null);
    setSelectedKey(added.key);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(revealEditor);
    setSelectAdded(false);
    beforeAdded.current = null;
  }, [rows, selectAdded]);

  const unitOf = (row: ProductionPlanEditorStateRow) => rowUomLabelOf?.(row) ?? uomLabel;
  const nameOf = (row: ProductionPlanEditorStateRow) => row.planNo ?? t.newRow(row.displayNo);
  const lineName = (value: string) => {
    const line = lines.find((line) => String(line.id) === value);
    const known = displayLines.data?.items.find((line) => String(line.productionLineId) === value);
    return line
      ? named(line.name, line.code)
      : known
        ? named(known.lineName, known.lineCode)
        : value
          ? `생산 라인 ID ${value}`
          : ui.unassigned;
  };
  const week = planWeek(anchor ?? (selected?.draft.planDate || plantToday()));
  const visibleWeek = compactCalendar ? week.slice(dayOffset, dayOffset + 3) : week;
  const selectedDate = selected?.draft.planDate;
  const weekStart = week[0];
  useEffect(() => {
    if (!compactCalendar || !selectedDate) return;
    const index = planWeek(weekStart ?? plantToday()).indexOf(selectedDate);
    if (index >= 0)
      setDayOffset((offset) =>
        index < offset || index > offset + 2 ? Math.min(4, Math.max(0, index - 1)) : offset,
      );
  }, [compactCalendar, selectedDate, selectedRowKey, weekStart]);

  const context = useWeeklyPlanContext(
    plantId,
    week[0]!,
    week[6]!,
    showAll && view === 'week',
    currentOrderIds,
  );
  const contextRows =
    showAll && view === 'week'
      ? (context.data ?? []).filter(
          (plan) => !rows.some((row) => row.productionPlanId === plan.productionPlanId),
        )
      : [];
  const contextPlan = contextRows.find((plan) => plan.productionPlanId === contextSelection);
  const contextUnit = (plan: WeeklyContextPlan) =>
    contextUnitLabelOf?.(plan.uomId) || `단위 ${plan.uomId}`;
  const groups = [
    ...new Set([
      ...rows.map((row) => row.draft.plannedLineId),
      ...contextRows.map((row) => (row.plannedLineId === null ? '' : String(row.plannedLineId))),
    ]),
  ];

  const plantOf = (row: ProductionPlanEditorStateRow) => rowPlantIdOf?.(row) ?? plantId;
  const plantOfGroup = (group: string) => {
    const row = rows.find((row) => row.draft.plannedLineId === group);
    return row ? plantOf(row) : plantId;
  };
  const calendarTargets = groups.flatMap((group) => {
    const id = plantOfGroup(group);
    return id && weekStart && week[6]
      ? [
          {
            plantId: id,
            productionLineId: group ? Number(group) : null,
            from: weekStart,
            to: week[6],
          },
        ]
      : [];
  });
  if (selected && plantOf(selected) && selected.draft.planDate)
    calendarTargets.push({
      plantId: plantOf(selected)!,
      productionLineId: selected.draft.plannedLineId ? Number(selected.draft.plannedLineId) : null,
      from: selected.draft.planDate,
      to: selected.draft.planDate,
    });
  const workingDays = usePlanningDays(calendarTargets);
  const dayOfGroup = (group: string, date: string) => {
    const id = plantOfGroup(group);
    return id
      ? workingDays.data?.get(planningDayKey(id, group ? Number(group) : null, date))
      : undefined;
  };

  const quantities = planQuantities(orderQty, confirmedQty, rows);
  const total = quantities.confirmed + quantities.draft;
  const draftQty = quantities.draft;
  const remaining = quantities.remaining;
  const displayQty = (qty: number | null | undefined) =>
    qty == null ? '—' : `${formatQty(qty)} ${uomLabel}`;
  const choose = (row: ProductionPlanEditorStateRow) => {
    setContextSelection(null);
    setSelectedKey(row.key);
    onSelectedKeyChange?.(row.key);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(revealEditor);
  };
  const columns: Column<ProductionPlanEditorStateRow>[] = [
    ...(orderNameOf && !planGroups
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
        <span className="erp-wo-complete-value" title={nameOf(row)}>
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
      render: (row) => `${formatQty(Number(row.draft.plannedQty) || 0)} ${unitOf(row)}`,
    },
    {
      key: 'line',
      header: t.columns.line,
      render: (row) => (
        <span className="erp-wo-complete-value" title={lineName(row.draft.plannedLineId)}>
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

  const outsideWeek = rows.filter((row) => !week.includes(row.draft.planDate));
  const editDisabled = disabled || selected?.confirmed === true;

  return (
    <section className="erp-wo-plan-workspace" aria-label={t.heading}>
      {!hideHeading && (
        <div className="erp-wo-plan-toolbar">
          <h2 className="section-title">{t.heading}</h2>
        </div>
      )}
      {!hideTotals && (
        <dl className="erp-wo-plan-totals">
          {[
            [ui.orderQty, orderQty],
            [ui.confirmedQty, quantities.confirmed],
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
      {!hideTotals && quantities.excess > 0 && (
        <AlertBanner variant="error">초과 수량 {displayQty(quantities.excess)}</AlertBanner>
      )}
      {!hideTools && (
        <PlanCreationTools
          disabled={disabled}
          addDisabled={addDisabled || (!hideTotals && remaining <= 0)}
          onAdd={() => {
            beforeAdded.current = new Set(rows.map((row) => row.key));
            onAdd();
            setSelectAdded(true);
          }}
        >
          {planningTools ??
            (onAppend && (
              <DistributionControls
                orders={[
                  {
                    id: 'single',
                    ...(plantId !== null ? { plantId } : {}),
                    label: distributionOrderLabel ?? '현재 ERP W/O',
                    unit: uomLabel,
                    decimalScale: distributionDecimalScale,
                    pending: Math.max(0, remaining ?? orderQty - total),
                    lines: distributionLines ?? lines,
                    startDate: distributionStartDate,
                    lineId: rows.at(-1)?.draft.plannedLineId,
                  },
                ]}
                existing={rows.map((row) => ({ ...row.draft, owner: 'single' }))}
                disabled={disabled}
                onDirtyChange={onDistributionDirtyChange}
                onApply={(drafts) => onAppend(drafts)}
              />
            ))}
        </PlanCreationTools>
      )}
      {rows.some((row) => row.isDirty) && (
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
      {!viewMode && <PlanViewSwitch value={view} onChange={setView} />}
      <AdjustableLayout
        storageKey="omf-mes:work-planning:plan-layout"
        label="생산계획"
        ratio={0.65}
        className="erp-wo-plan-layout"
      >
        <section
          className="pane erp-wo-plan-board"
          ref={boardRef}
          aria-label={view === 'week' ? ui.week : ui.grid}
        >
          <h2 className="section-title erp-wo-plan-board-title">
            {view === 'week' ? ui.weekHeading : ui.gridHeading}
          </h2>
          {view === 'grid' ? (
            planGroups ? (
              <div className="erp-wo-grouped-plans">
                {planGroups.map((group) => {
                  const groupRows = rows.filter((row) => group.rowKeys.includes(row.key));
                  const expanded = !collapsedGroups.has(group.id);
                  return (
                    <section
                      key={group.id}
                      className="erp-wo-plan-order-group"
                      aria-label={`${group.orderNo} 생산계획`}
                    >
                      <div className="erp-wo-plan-group-heading">
                        <Button
                          size="sm"
                          variant="text"
                          aria-expanded={expanded}
                          aria-label={`${group.orderNo} 계획 ${expanded ? '접기' : '펼치기'}`}
                          onClick={() =>
                            setCollapsedGroups((current) => {
                              const next = new Set(current);
                              if (next.has(group.id)) next.delete(group.id);
                              else next.add(group.id);
                              return next;
                            })
                          }
                        >
                          {expanded ? '▾' : '▸'} {group.orderNo}
                        </Button>
                        <span className="field-note">계획 {groupRows.length}건</span>
                        <Button
                          size="sm"
                          variant="outlined"
                          aria-label={`${group.orderNo} 계획 추가`}
                          disabled={disabled || group.addDisabled}
                          onClick={group.onAdd}
                        >
                          계획 추가
                        </Button>
                      </div>
                      <dl className="erp-wo-selected-item-fields">
                        <div>
                          <dt>품목 코드</dt>
                          <dd>{group.itemCode}</dd>
                        </div>
                        <div>
                          <dt>품목명</dt>
                          <dd>{group.itemName}</dd>
                        </div>
                      </dl>
                      {group.summary}
                      {expanded && (
                        <AdjustableTable
                          storageKey="omf-mes:work-planning:group-plan-columns:v1"
                          className="erp-wo-plan-grid"
                          columns={columns}
                          rows={groupRows}
                          getRowId={(row) => row.key}
                          activeId={selected?.key}
                          rowLabel={(row) => nameOf(row)}
                          onActivate={choose}
                          empty={<p className="empty-line">{t.empty}</p>}
                        />
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <AdjustableTable
                storageKey="omf-mes:work-planning:plan-columns"
                className="erp-wo-plan-grid"
                columns={columns}
                rows={rows}
                getRowId={(row) => row.key}
                activeId={selected?.key}
                rowLabel={(row) => nameOf(row)}
                onActivate={choose}
                empty={<p className="empty-line">{t.empty}</p>}
              />
            )
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
                    aria-pressed={showAll}
                    disabled={plantId === null}
                    onClick={() => {
                      setShowAll((value) => !value);
                      setContextSelection(null);
                    }}
                  >
                    전체 편성 보기
                  </Button>

                  <Button
                    size="sm"
                    variant="outlined"
                    aria-label={ui.previousWeek}
                    onClick={() => {
                      setAnchor(shiftPlanDate(week[0] ?? plantToday(), -7));
                      setDayOffset(0);
                      setContextSelection(null);
                    }}
                  >
                    ‹
                  </Button>
                  <Button
                    size="sm"
                    variant="outlined"
                    aria-label={ui.nextWeek}
                    onClick={() => {
                      setAnchor(shiftPlanDate(week[0] ?? plantToday(), 7));
                      setDayOffset(0);
                      setContextSelection(null);
                    }}
                  >
                    ›
                  </Button>
                </div>
              </div>
              {compactCalendar && (
                <div className="erp-wo-week-day-navigation">
                  <Button
                    size="sm"
                    variant="text"
                    aria-label="이전 날짜"
                    disabled={dayOffset === 0}
                    onClick={() => setDayOffset((offset) => Math.max(0, offset - 2))}
                  >
                    ‹
                  </Button>
                  <span>
                    {visibleWeek[0]?.slice(5)} — {visibleWeek.at(-1)?.slice(5)}
                  </span>
                  <Button
                    size="sm"
                    variant="text"
                    aria-label="다음 날짜"
                    disabled={dayOffset === 4}
                    onClick={() => setDayOffset((offset) => Math.min(4, offset + 2))}
                  >
                    ›
                  </Button>
                </div>
              )}
              {showAll && (
                <div className="erp-wo-week-legend">
                  <span>현재 편성</span>
                  <span className="is-other">다른 ERP W/O</span>
                </div>
              )}
              {showAll && context.isPending && (
                <p role="status" className="field-note">
                  전체 편성 조회 중
                </p>
              )}
              {showAll && context.isError && (
                <AlertBanner
                  variant="error"
                  title="전체 편성을 조회하지 못했습니다"
                  action={
                    <Button size="sm" variant="outlined" onClick={() => void context.refetch()}>
                      다시 조회
                    </Button>
                  }
                >
                  현재 편성은 계속 편집할 수 있습니다.
                </AlertBanner>
              )}
              <div className={`erp-wo-week-scroll${compactCalendar ? ' is-compact' : ''}`}>
                <AdjustableNativeTable
                  storageKey={`omf-mes:work-planning:week-columns:v4:${compactCalendar ? 'compact' : 'wide'}`}
                  className="erp-wo-week-table"
                  widths={
                    compactCalendar
                      ? [120, 144, 144, 144]
                      : [160, 160, 160, 160, 160, 160, 160, 160]
                  }
                  labels={[
                    t.columns.line,
                    ...visibleWeek.map((date) => (
                      <span key={date}>
                        {date.slice(5)}
                        <span>{ui.weekdays[week.indexOf(date)]}</span>
                      </span>
                    )),
                  ]}
                >
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group}>
                        <th>
                          <span title={lineName(group)}>{lineName(group)}</span>
                        </th>
                        {visibleWeek.map((date) => (
                          <td
                            key={date}
                            className={
                              dayOfGroup(group, date)?.statusCode === 'HOLIDAY'
                                ? 'erp-wo-holiday-day'
                                : undefined
                            }
                          >
                            {dayOfGroup(group, date)?.statusCode === 'HOLIDAY' && (
                              <span className="erp-wo-holiday-day-label">휴일</span>
                            )}
                            {rows
                              .filter(
                                (row) =>
                                  row.draft.plannedLineId === group && row.draft.planDate === date,
                              )
                              .map((row) => (
                                <WeeklyPlanCard
                                  key={row.key}
                                  planNo={nameOf(row)}
                                  orderNo={rowIdentityOf?.(row).orderNo ?? orderNameOf?.(row)}
                                  itemCode={rowIdentityOf?.(row).itemCode}
                                  itemName={rowIdentityOf?.(row).itemName}
                                  quantity={`${formatQty(Number(row.draft.plannedQty) || 0)} ${unitOf(row)}`}
                                  status={
                                    row.confirmed ? statusNameOf(row.statusCode) : ui.unconfirmed
                                  }
                                  confirmed={row.confirmed}
                                  selected={!contextPlan && selected?.key === row.key}
                                  label={ui.selectPlan(nameOf(row))}
                                  controls={editorId}
                                  onSelect={() => choose(row)}
                                />
                              ))}
                            {contextRows
                              .filter(
                                (plan) =>
                                  (plan.plannedLineId === null
                                    ? ''
                                    : String(plan.plannedLineId)) === group &&
                                  plan.planDate === date,
                              )
                              .map((plan) => (
                                <WeeklyPlanCard
                                  key={`context-${plan.productionPlanId}`}
                                  planNo={plan.planNo}
                                  orderNo={plan.orderNo}
                                  itemCode={plan.itemCode}
                                  itemName={plan.itemName}
                                  quantity={`${formatQty(plan.plannedQty)} ${contextUnit(plan)}`}
                                  status={
                                    plan.confirmedAt
                                      ? statusNameOf(plan.statusCode)
                                      : ui.unconfirmed
                                  }
                                  confirmed={!!plan.confirmedAt}
                                  other
                                  selected={contextPlan?.productionPlanId === plan.productionPlanId}
                                  label={`${plan.planNo} 상세 확인`}
                                  controls={editorId}
                                  onSelect={() => {
                                    setContextSelection(plan.productionPlanId);
                                    requestAnimationFrame(revealEditor);
                                  }}
                                />
                              ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </AdjustableNativeTable>
              </div>
              {rows.length === 0 && contextRows.length === 0 && !context.isFetching && (
                <p className="empty-line">{t.empty}</p>
              )}
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
          {!hideBoardTotal && (
            <p className="erp-wo-plan-total">
              {t.total(formatQty(total), formatQty(orderQty), uomLabel)}
            </p>
          )}
        </section>
        <section
          className="pane erp-wo-plan-editor"
          id={editorId}
          aria-label={contextPlan ? '생산계획 상세' : ui.editor}
        >
          <h2 className="section-title">{contextPlan ? '생산계획 상세' : ui.editor}</h2>
          {contextPlan ? (
            <>
              <div className="erp-wo-plan-editor-title">
                <span>{contextPlan.planNo}</span>
                <Chip
                  size="sm"
                  variant="status"
                  status={contextPlan.confirmedAt ? 'success' : 'idle'}
                >
                  {contextPlan.confirmedAt ? statusNameOf(contextPlan.statusCode) : ui.unconfirmed}
                </Chip>
                <span className="field-note">다른 ERP W/O</span>
              </div>
              <dl className="erp-wo-context-plan-facts">
                {[
                  ['ERP W/O', contextPlan.orderNo],
                  ['품목 코드', contextPlan.itemCode],
                  ['품목명', contextPlan.itemName],
                  ['계획일', contextPlan.planDate],
                  [
                    '생산 라인',
                    lineName(
                      contextPlan.plannedLineId === null ? '' : String(contextPlan.plannedLineId),
                    ),
                  ],
                  ['생산량', `${formatQty(contextPlan.plannedQty)} ${contextUnit(contextPlan)}`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : selected === undefined ? (
            <p className="empty-line">{ui.selectPrompt}</p>
          ) : (
            <>
              {orderContextOf ? (
                orderContextOf(selected)
              ) : rowIdentityOf ? (
                <dl className="erp-wo-context-plan-facts">
                  {[
                    ['ERP W/O', rowIdentityOf(selected).orderNo],
                    ['품목 코드', rowIdentityOf(selected).itemCode],
                    ['품목명', rowIdentityOf(selected).itemName],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                orderNameOf && (
                  <p className="field-note erp-wo-plan-order">{orderNameOf(selected)}</p>
                )
              )}
              <div className="erp-wo-plan-editor-title">
                <span className="mono-cell">{nameOf(selected)}</span>
                <Chip size="sm" variant="status" status={selected.confirmed ? 'success' : 'idle'}>
                  {selected.confirmed ? statusNameOf(selected.statusCode) : ui.unconfirmed}
                </Chip>
              </div>
              {selected.confirmed && <p className="field-note">{ui.readonly}</p>}
              <div className="erp-wo-plan-edit-fields">
                {' '}
                <div className="field-cell">
                  <label className="field-label">{t.columns.planDate}</label>
                  <DatePicker
                    size="md"
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
                    wrapValue
                    hideLabel
                    size="md"
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
                  containerClassName="erp-wo-plan-quantity-field"
                  size="md"
                  label={t.columns.plannedQty}
                  aria-label={t.fieldLabel(nameOf(selected), t.columns.plannedQty)}
                  inputMode="decimal"
                  helperText={rowUomLabelOf ? `단위 ${unitOf(selected)}` : undefined}
                  value={selected.draft.plannedQty}
                  error={errorText(selected.errors, 'plannedQty')}
                  disabled={editDisabled}
                  onChange={(event) => onChange(selected.key, 'plannedQty', event.target.value)}
                />
              </div>
              {workingDays.isError ? (
                <p className="erp-wo-planning-day-notice" role="status">
                  근무일 정보를 조회하지 못했습니다. 날짜 입력은 유지됩니다.
                </p>
              ) : (
                <PlanningDayNotice
                  day={
                    plantOf(selected)
                      ? workingDays.data?.get(
                          planningDayKey(
                            plantOf(selected)!,
                            selected.draft.plannedLineId
                              ? Number(selected.draft.plannedLineId)
                              : null,
                            selected.draft.planDate,
                          ),
                        )
                      : undefined
                  }
                />
              )}
              {!selected.confirmed && (
                <div className="erp-wo-plan-editor-actions">
                  {onSplit && (
                    <Button
                      size="md"
                      variant="tonal"
                      disabled={editDisabled || selected.isPending}
                      onClick={() => setSplitOpen(true)}
                    >
                      계획 분할
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="md"
                    aria-label={t.remove(nameOf(selected))}
                    disabled={disabled || selected.isPending}
                    onClick={() => onRemove(selected)}
                  >
                    {t.removeShort}
                  </Button>
                </div>
              )}
              {onSplit && !selected.confirmed && (
                <>
                  {splitOpen && (
                    <PlanSplitDialog
                      key={selected.key}
                      row={selected}
                      plantId={plantOf(selected)}
                      planName={nameOf(selected)}
                      identity={rowIdentityOf?.(selected)}
                      lineName={lineName(selected.draft.plannedLineId)}
                      unit={unitOf(selected)}
                      decimalScale={rowDecimalScaleOf?.(selected) ?? distributionDecimalScale ?? 6}
                      onClose={() => setSplitOpen(false)}
                      onApply={(parts) => {
                        beforeAdded.current = new Set(rows.map((row) => row.key));
                        onSplit(selected, parts);
                        setSplitOpen(false);
                        setSelectAdded(true);
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}
        </section>
      </AdjustableLayout>
    </section>
  );
};

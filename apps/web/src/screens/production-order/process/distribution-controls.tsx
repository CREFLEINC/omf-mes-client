import { formatQty } from './process-model';
import { useApiClient } from '../../../patterns/api-context';
import {
  resolvePlanningDays,
  usePlanningDays,
  planningDayKey,
  planningDayMessage,
  planningHolidayLabel,
  type PlanningDay,
  type PlanningDayTarget,
} from './planning-working-days';
import { useEffect, useId, useRef, useState } from 'react';
import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import { DistributionPeriodPicker } from './distribution-period-picker';
import { PageNav } from '../../../patterns/page-nav';
import { Select } from '../../../patterns/select';
import { DistributionHelp } from './distribution-help';
import { DistributionLinePicker } from './distribution-line-picker';
import { plantToday } from '../../../patterns/plant-time';
import { recommendedPlanDate } from './manual-plan-defaults';
import { shiftPlanDate } from './plan-view-model';
import {
  expandSegment,
  previewSegments,
  segmentDates,
  type DistributionSegment,
  type DistributionTarget,
  type OwnedDraft,
  type SegmentPreview,
} from './segmented-distribution-model';

interface CalendarNote {
  owner: string;
  summary: string;
  dates?: string[];
}

export interface DistributionControlsProps {
  orders: readonly DistributionTarget[];
  existing: readonly OwnedDraft[];
  disabled: boolean;
  onApply: (drafts: OwnedDraft[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
}
const capacityFor = (
  row: DistributionSegment,
  order: DistributionTarget,
): PlanningDayTarget['capacity'] =>
  row.mode !== 'equal' || order.bottleneckCycleTimeSec == null
    ? undefined
    : { cycleTimeSec: order.bottleneckCycleTimeSec, decimalScale: order.decimalScale ?? 0 };

const dateRange = (row: DistributionSegment) => {
  try {
    return segmentDates(row.start, row.end);
  } catch {
    return [];
  }
};
const dailyTotal = (row: DistributionSegment) =>
  Number(
    dateRange(row)
      .reduce((sum, date) => sum + (Number(row.daily[date]) || 0), 0)
      .toFixed(6),
  );
export const DistributionControls = ({
  orders,
  existing,
  disabled,
  onApply,
  onDirtyChange,
}: DistributionControlsProps) => {
  const id = useId();
  const { client } = useApiClient();
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [resultQuantities, setResultQuantities] = useState<Record<string, string>>({});
  const resultKey = (row: OwnedDraft) => `${row.owner}:${row.planDate}:${row.plannedLineId}`;
  const [holidayLabels, setHolidayLabels] = useState(new Map<string, string>());
  const latestSignature = useRef('');
  const sequence = useRef(0);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const previewEpoch = useRef(0);
  const [activeId, setActiveId] = useState('');
  const [activeOwner, setActiveOwner] = useState('');
  const [resultPage, setResultPage] = useState(1);
  const [dailyPages, setDailyPages] = useState<Record<string, number>>({});
  const [editingResultKey, setEditingResultKey] = useState<string | null>(null);
  const [rows, setRows] = useState<DistributionSegment[]>([]);
  const baseline = useRef<DistributionSegment[]>([]);
  const canBulkEdit = rows.length > 1;
  const [selected, setSelected] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ signature: string; result: SegmentPreview } | null>(
    null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [commonOpen, setCommonOpen] = useState(false);
  const [commonStart, setCommonStart] = useState(plantToday());
  const [commonEnd, setCommonEnd] = useState(shiftPlanDate(plantToday(), 6));
  const [commonLine, setCommonLine] = useState('');
  const [commonPeriodChanged, setCommonPeriodChanged] = useState(false);
  const [commonHoliday, setCommonHoliday] = useState('');
  const [commonStatus, setCommonStatus] = useState('');
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const createRow = (owner: string, quantity = ''): DistributionSegment => {
    const target = orders.find((order) => order.id === owner);
    const start = recommendedPlanDate(target?.startDate, plantToday());
    const previousLine = [...existing].reverse().find((row) => row.owner === owner)?.plannedLineId;
    const preferredLine = target?.lineId || previousLine;
    const lines = target?.lines ?? [];
    return {
      id: `${id}-${++sequence.current}`,
      owner,
      start,
      end: shiftPlanDate(start, 6),
      lineId: lines.some((line) => String(line.id) === preferredLine)
        ? preferredLine!
        : lines.length === 1
          ? String(lines[0]!.id)
          : '',
      mode: 'equal',
      includeHolidays: false,
      quantity,
      daily: {},
    };
  };
  const signature = JSON.stringify({
    rows,
    orders: orders.map((order) => ({
      id: order.id,
      pending: order.pending,
      unit: order.unit,
      lines: order.lines.map((line) => line.id),
      decimalScale: order.decimalScale,
      bottleneckCycleTimeSec: order.bottleneckCycleTimeSec,
      cycleTimeUnavailable: order.cycleTimeUnavailable,
      plantId: order.plantId,
    })),
    existing,
  });
  latestSignature.current = signature;
  const activeRow = rows.find((row) => row.id === activeId) ?? rows[0];
  const focusedOrder =
    orders.find((order) => order.id === activeOwner) ??
    orders.find((order) => order.id === activeRow?.owner) ??
    orders[0];
  const allocatedOf = (owner: string) =>
    rows
      .filter((row) => row.owner === owner && !row.applied)
      .reduce(
        (sum, row) => sum + (row.mode === 'daily' ? dailyTotal(row) : Number(row.quantity) || 0),
        0,
      );
  const workingDays = usePlanningDays(
    rows.flatMap((row) => {
      const order = orders.find((order) => order.id === row.owner);
      return order?.plantId
        ? [
            {
              plantId: order.plantId,
              productionLineId: row.lineId ? Number(row.lineId) : null,
              from: row.start,
              to: row.end,
            },
          ]
        : [];
    }),
  );
  const stale = preview !== null && preview.signature !== signature;
  const previewRows = preview
    ? preview.result.drafts
        .map((row) => ({
          ...row,
          plannedQty: resultQuantities[resultKey(row)] ?? row.plannedQty,
          holidayLabel: holidayLabels.get(resultKey(row)),
        }))
        .sort(
          (a, b) =>
            a.owner.localeCompare(b.owner) ||
            a.planDate.localeCompare(b.planDate) ||
            a.plannedLineId.localeCompare(b.plannedLineId),
        )
    : [];
  const visibleResultRows = previewRows.filter(
    (row) => Number(row.plannedQty) !== 0 || resultKey(row) === editingResultKey,
  );
  const visibleResultPage = Math.min(
    resultPage,
    Math.max(1, Math.ceil(visibleResultRows.length / 10)),
  );
  const resultRowsByOrder = new Map<string, typeof visibleResultRows>();
  for (const row of visibleResultRows.slice((visibleResultPage - 1) * 10, visibleResultPage * 10)) {
    const orderRows = resultRowsByOrder.get(row.owner) ?? [];
    orderRows.push(row);
    resultRowsByOrder.set(row.owner, orderRows);
  }
  const existingByResultKey = new Map<string, number>();
  for (const row of existing) {
    const key = resultKey(row);
    existingByResultKey.set(key, (existingByResultKey.get(key) ?? 0) + Number(row.plannedQty));
  }
  let reviewResult = preview?.result;
  let resultError = '';
  if (preview && Object.keys(resultQuantities).length) {
    try {
      const grouped = new Map<string, DistributionSegment>();
      for (const row of previewRows) {
        const key = `${row.owner}:${row.plannedLineId}`;
        const group = grouped.get(key) ?? {
          id: key,
          owner: row.owner,
          start: row.planDate,
          end: row.planDate,
          lineId: row.plannedLineId,
          mode: 'daily',
          quantity: '0',
          daily: {},
        };
        group.start = group.start < row.planDate ? group.start : row.planDate;
        group.end = group.end > row.planDate ? group.end : row.planDate;
        group.daily[row.planDate] = row.plannedQty;
        grouped.set(key, group);
      }
      reviewResult = previewSegments(
        orders,
        [...grouped.values()].filter((group) =>
          Object.values(group.daily).some((qty) => Number(qty) !== 0),
        ),
        existing,
        undefined,
        plantToday(),
      );
      if (
        reviewResult.orders.some(
          (order) =>
            Math.abs(
              order.added -
                (preview.result.orders.find((item) => item.id === order.id)?.added ?? 0),
            ) > 0.0000005,
        )
      )
        resultError = 'ERP W/O별 생산량 합계를 기존 분배 수량과 맞추세요.';
      reviewResult = {
        ...reviewResult,
        warnings: [...new Set([...preview.result.warnings, ...reviewResult.warnings])],
        drafts: reviewResult.drafts.map((row) => ({
          ...row,
          planDateSourceCode:
            resultQuantities[resultKey(row)] !== undefined
              ? ('USER' as const)
              : (preview.result.drafts.find((original) => resultKey(original) === resultKey(row))
                  ?.planDateSourceCode ?? 'USER'),
        })),
      };
    } catch (error) {
      resultError = error instanceof Error ? error.message : '수량을 확인하세요.';
    }
  }
  const change = (key: string, patch: Partial<DistributionSegment>) => {
    setRows((current) =>
      current.map((row) => (row.id === key ? { ...row, ...patch, applied: false } : row)),
    );
    setDirty(true);
    setPreview(null);
    setMessage('');
    setAcknowledged(false);
  };
  const toggleOpen = () => {
    if (!open && rows.length === 0) {
      const initial = orders
        .filter((order) => order.pending > 0)
        .map((order) => createRow(order.id, String(order.pending)));
      setRows(initial);
      setActiveId(initial[0]?.id ?? '');
      baseline.current = initial;
    }
    setOpen(!open);
  };
  const selectedOrders = rows
    .filter((row) => selected.includes(row.id))
    .map((row) => orders.find((order) => order.id === row.owner))
    .filter((order): order is DistributionTarget => !!order);
  const commonLines = orders
    .flatMap((order) => order.lines)
    .filter((line, index, all) => all.findIndex((item) => item.id === line.id) === index)
    .filter((line) =>
      selectedOrders.every((order) => order.lines.some((item) => item.id === line.id)),
    );
  return (
    <section className="erp-wo-distribution">
      <div className="erp-wo-distribution-actions">
        <Button
          variant="outlined"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`${id}-conditions`}
          disabled={disabled}
          onClick={toggleOpen}
        >
          자동 분배
        </Button>
        <Button
          size="md"
          variant="text"
          className="erp-wo-distribution-help-trigger"
          aria-label="자동 분배 도움말"
          aria-haspopup="dialog"
          onClick={() => setHelpOpen(true)}
        >
          ?
        </Button>
      </div>
      {helpOpen && <DistributionHelp onClose={() => setHelpOpen(false)} />}
      {open && (
        <Dialog
          open
          size="lg"
          title="자동 분배"
          className="erp-wo-distribution-dialog"
          closeOnBackdropClick={false}
          onClose={() => {
            latestSignature.current = 'closed';
            previewEpoch.current++;
            setOpen(false);
          }}
        >
          <div id={`${id}-conditions`} className="erp-wo-distribution-settings">
            <ol className="erp-wo-distribution-steps" aria-label="자동 분배 진행 단계">
              <li aria-current={!preview ? 'step' : undefined}>1 분배 조건</li>
              <li aria-current={preview ? 'step' : undefined}>2 결과 검토</li>
            </ol>
            {!preview && (
              <>
                <div className="erp-wo-distribution-heading">
                  <h2 className="section-title">
                    ERP W/O별 분배 조건 <span className="field-note">{orders.length}건</span>
                  </h2>
                  {canBulkEdit && (
                    <label className="erp-wo-checkbox">
                      <input
                        type="checkbox"
                        aria-label="분배 조건 전체 선택"
                        checked={rows.length > 0 && rows.every((row) => selected.includes(row.id))}
                        disabled={disabled || !rows.length}
                        ref={(input) => {
                          if (input)
                            input.indeterminate =
                              rows.some((row) => selected.includes(row.id)) &&
                              !rows.every((row) => selected.includes(row.id));
                        }}
                        onChange={(event) =>
                          setSelected(event.target.checked ? rows.map((row) => row.id) : [])
                        }
                      />
                      전체 선택
                    </label>
                  )}
                </div>
                <div className="erp-wo-preview-scroll">
                  <table className="erp-wo-distribution-owner-table">
                    <caption className="visually-hidden">ERP W/O별 분배 수량</caption>
                    <thead>
                      <tr>
                        {canBulkEdit && orders.length > 1 && <th>선택</th>}
                        <th>ERP W/O</th>
                        <th>미계획 수량</th>
                        <th>분배 수량 합계</th>
                        <th>미배분 수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => {
                        const owned = rows.filter((row) => row.owner === order.id),
                          allocated = allocatedOf(order.id),
                          left = order.pending - allocated;
                        return (
                          <tr
                            key={order.id}
                            data-active={order.id === focusedOrder?.id}
                            aria-label={`${order.label} 분배 조건`}
                            aria-current={order.id === focusedOrder?.id || undefined}
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return;
                              if (event.key !== 'Enter' && event.key !== ' ') return;
                              event.preventDefault();
                              setActiveOwner(order.id);
                            }}
                            onClick={(event) => {
                              if (!(event.target as HTMLElement).closest('input'))
                                setActiveOwner(order.id);
                            }}
                          >
                            {canBulkEdit && orders.length > 1 && (
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`${order.label} 전체 선택`}
                                  disabled={disabled || !owned.length}
                                  checked={
                                    owned.length > 0 &&
                                    owned.every((row) => selected.includes(row.id))
                                  }
                                  ref={(input) => {
                                    if (input)
                                      input.indeterminate =
                                        owned.some((row) => selected.includes(row.id)) &&
                                        !owned.every((row) => selected.includes(row.id));
                                  }}
                                  onChange={(event) =>
                                    setSelected((current) =>
                                      event.target.checked
                                        ? [...new Set([...current, ...owned.map((row) => row.id)])]
                                        : current.filter(
                                            (key) => !owned.some((row) => row.id === key),
                                          ),
                                    )
                                  }
                                />
                              </td>
                            )}
                            <td className="erp-wo-distribution-owner-number">
                              {order.orderNo ?? order.label}
                            </td>
                            <td>
                              {formatQty(order.availableQty ?? order.pending)} {order.unit}
                              {order.availableQty !== undefined &&
                                order.pending < order.availableQty && (
                                  <span className="field-note">
                                    이번 분배 한도 {formatQty(order.pending)} {order.unit}
                                  </span>
                                )}
                            </td>
                            <td>
                              {formatQty(allocated)} {order.unit}
                            </td>
                            <td>
                              {left < 0 ? '초과 ' : ''}
                              {formatQty(Math.abs(left))} {order.unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {canBulkEdit && (
                  <section className="erp-wo-common-conditions" aria-label="선택 조건 공통 입력">
                    <div className="erp-wo-common-conditions-header">
                      <span>선택한 조건 {selected.length}건</span>
                      <Button
                        variant="outlined"
                        size="sm"
                        aria-expanded={commonOpen && selected.length > 0}
                        aria-controls={`${id}-common-fields`}
                        disabled={disabled || selected.length === 0}
                        onClick={() => setCommonOpen(!commonOpen)}
                      >
                        {commonOpen ? '접기' : '일괄 변경'}
                      </Button>
                    </div>
                    {commonOpen && selected.length > 0 && (
                      <>
                        <div className="erp-wo-distribution-fields" id={`${id}-common-fields`}>
                          <div className="field-cell erp-wo-distribution-period">
                            <span className="field-label">공통 분배 기간</span>
                            <DistributionPeriodPicker
                              label="공통 분배 기간"
                              value={commonPeriodChanged ? [commonStart, commonEnd] : ['', '']}
                              placeholder="변경하지 않음"
                              disabled={disabled || !selected.length}
                              onChange={([start, end]) => {
                                setCommonPeriodChanged(true);
                                setCommonStart(start);
                                setCommonEnd(end);
                              }}
                            />
                            {commonPeriodChanged && (
                              <Button
                                variant="text"
                                size="sm"
                                onClick={() => setCommonPeriodChanged(false)}
                              >
                                기간 변경 해제
                              </Button>
                            )}
                          </div>
                          <div className="field-cell">
                            <span className="field-label">공통 생산 라인</span>
                            <DistributionLinePicker
                              label="공통 생산 라인"
                              lines={commonLines}
                              value={commonLine}
                              emptyLabel="변경하지 않음"
                              disabled={disabled || !selected.length}
                              optional
                              combined
                              onChange={setCommonLine}
                            />
                          </div>
                          <div className="field-cell">
                            <span className="field-label">공통 휴일 편성</span>
                            <Select
                              aria-label="공통 휴일 편성"
                              size="md"
                              value={commonHoliday}
                              disabled={disabled || !selected.length}
                              options={[
                                { value: '', label: '변경하지 않음' },
                                { value: 'no', label: '미포함' },
                                { value: 'yes', label: '포함' },
                              ]}
                              onChange={setCommonHoliday}
                            />
                          </div>
                        </div>
                        {commonStatus && (
                          <p className="field-note" role="status">
                            {commonStatus}
                          </p>
                        )}
                        <Button
                          variant="outlined"
                          disabled={
                            disabled ||
                            !selected.length ||
                            (!commonPeriodChanged && !commonLine && !commonHoliday)
                          }
                          onClick={() => {
                            try {
                              if (commonPeriodChanged) segmentDates(commonStart, commonEnd);
                              if (
                                commonLine &&
                                selectedOrders.some(
                                  (order) =>
                                    !order.lines.some((line) => String(line.id) === commonLine),
                                )
                              )
                                throw new Error(
                                  '선택 조건에 공통으로 사용할 수 있는 라인을 고르세요.',
                                );
                              setRows((current) =>
                                current.map((row) =>
                                  selected.includes(row.id)
                                    ? {
                                        ...row,
                                        ...(commonPeriodChanged
                                          ? { start: commonStart, end: commonEnd }
                                          : {}),
                                        ...(commonHoliday
                                          ? { includeHolidays: commonHoliday === 'yes' }
                                          : {}),
                                        ...(commonLine ? { lineId: commonLine } : {}),
                                        applied: false,
                                      }
                                    : row,
                                ),
                              );
                              setDirty(true);
                              setPreview(null);
                              setMessage('');
                              setCommonStatus(`선택 ${selected.length}건에 적용했습니다.`);
                              setCommonPeriodChanged(false);
                              setCommonLine('');
                              setCommonHoliday('');
                            } catch (error) {
                              setMessage(
                                error instanceof Error ? error.message : '공통 조건을 확인하세요.',
                              );
                            }
                          }}
                        >
                          선택 항목에 적용
                        </Button>
                      </>
                    )}
                  </section>
                )}
                {focusedOrder && (
                  <div className="erp-wo-distribution-focused-order">
                    <div className="erp-wo-distribution-heading">
                      <h3 className="section-title">
                        {focusedOrder.orderNo ?? focusedOrder.label}
                      </h3>
                      <Button
                        variant="outlined"
                        disabled={disabled || focusedOrder.pending <= 0}
                        onClick={() => {
                          const created = createRow(
                            focusedOrder.id,
                            String(
                              Math.max(0, focusedOrder.pending - allocatedOf(focusedOrder.id)),
                            ),
                          );
                          setRows((current) => [...current, created]);
                          setActiveId(created.id);
                          setDirty(true);
                          setPreview(null);
                        }}
                      >
                        분배 조건 추가
                      </Button>
                    </div>
                    {focusedOrder.itemCode && (
                      <dl>
                        <div>
                          <dt>품목 코드</dt>
                          <dd>{focusedOrder.itemCode}</dd>
                        </div>
                        <div>
                          <dt>품목명</dt>
                          <dd>{focusedOrder.itemName ?? '—'}</dd>
                        </div>
                      </dl>
                    )}
                    {allocatedOf(focusedOrder.id) > focusedOrder.pending && (
                      <AlertBanner variant="error">
                        분배 수량이 이번 분배 가능 수량을 초과했습니다.
                      </AlertBanner>
                    )}
                  </div>
                )}
                <div className="erp-wo-distribution-segments">
                  {focusedOrder && !rows.some((row) => row.owner === focusedOrder.id) && (
                    <p className="field-note">이 ERP W/O에 분배 조건이 없습니다.</p>
                  )}
                  {rows.map((row, index) => {
                    if (row.owner !== focusedOrder?.id) return null;
                    const target = orders.find((order) => order.id === row.owner);
                    const dates = dateRange(row);
                    const total =
                      row.mode === 'daily' ? dailyTotal(row) : Number(row.quantity) || 0;
                    const resolvedDays = dates.map((date) =>
                      target?.plantId
                        ? workingDays.data?.get(
                            planningDayKey(
                              target.plantId,
                              row.lineId ? Number(row.lineId) : null,
                              date,
                            ),
                          )
                        : undefined,
                    );
                    const resolved =
                      dates.length > 0 && resolvedDays.every((day) => day !== undefined);
                    const undeterminedCount = resolvedDays.filter(
                      (day) => day?.statusCode === 'UNDETERMINED',
                    ).length;
                    const holidayCount = resolvedDays.filter(
                      (day) => day?.statusCode === 'HOLIDAY',
                    ).length;
                    const dayCount = dates.length - (row.includeHolidays ? 0 : holidayCount);
                    const scale = 10 ** (target?.decimalScale ?? 6),
                      totalUnits = Math.round(total * scale);
                    const dailyBase = dayCount > 0 ? Math.floor(totalUnits / dayCount) / scale : 0;
                    const remainder = dayCount > 0 ? totalUnits % dayCount : 0;
                    const visibleDailyPage = Math.min(
                      dailyPages[row.id] ?? 1,
                      Math.max(1, Math.ceil(dates.length / 7)),
                    );
                    return (
                      <div
                        className="erp-wo-distribution-segment"
                        key={row.id}
                        role="group"
                        aria-label={`분배 조건 ${index + 1}`}
                      >
                        <div>
                          <div className="erp-wo-distribution-row-head">
                            <label className="erp-wo-distribution-condition-title erp-wo-checkbox">
                              {canBulkEdit && (
                                <input
                                  type="checkbox"
                                  aria-label={`분배 조건 ${index + 1} 선택`}
                                  checked={selected.includes(row.id)}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    setSelected((current) =>
                                      event.target.checked
                                        ? [...new Set([...current, row.id])]
                                        : current.filter((key) => key !== row.id),
                                    )
                                  }
                                />
                              )}
                              분배 조건 {index + 1}
                              {row.applied && <span className="field-note">편성안 반영됨</span>}
                            </label>
                            <div className="erp-wo-distribution-condition-actions">
                              <Button
                                variant="outlined"
                                size="md"
                                disabled={disabled}
                                aria-label={`조건 ${index + 1} 삭제`}
                                onClick={() => {
                                  const remainingRows = rows.filter((item) => item.id !== row.id);
                                  setRows(remainingRows);
                                  if (!remainingRows.some((item) => !item.applied)) {
                                    baseline.current = remainingRows;
                                    setDirty(false);
                                  } else setDirty(true);
                                  setSelected((current) => current.filter((key) => key !== row.id));
                                  setPreview(null);
                                }}
                              >
                                삭제
                              </Button>
                            </div>
                          </div>
                          <div className="erp-wo-segment-fields">
                            <div className="field-cell erp-wo-segment-date erp-wo-distribution-period">
                              <span className="field-label">분배 기간</span>
                              <DistributionPeriodPicker
                                label={`조건 ${index + 1} 분배 기간`}
                                value={[row.start, row.end]}
                                disabled={disabled}
                                onChange={([start, end]) => change(row.id, { start, end })}
                              />
                            </div>
                            <div className="field-cell erp-wo-segment-line">
                              <span className="field-label">생산 라인</span>
                              <DistributionLinePicker
                                label={`조건 ${index + 1} 생산 라인`}
                                lines={target?.lines ?? []}
                                combined
                                value={row.lineId}
                                disabled={disabled}
                                onChange={(lineId) => change(row.id, { lineId })}
                              />
                            </div>
                            <div className="field-cell erp-wo-segment-mode">
                              <span className="field-label">배분 방식</span>
                              <Select
                                size="md"
                                aria-label={`조건 ${index + 1} 배분 방식`}
                                value={row.mode}
                                options={[
                                  {
                                    value: 'equal',
                                    label:
                                      target?.bottleneckCycleTimeSec == null
                                        ? '균등 배분'
                                        : `표준 C/T (${formatQty(target.bottleneckCycleTimeSec)}초/${target.unit === 'EA' ? '개' : target.unit})`,
                                  },
                                  { value: 'daily', label: '날짜별 직접 입력' },
                                ]}
                                disabled={disabled}
                                onChange={(value) => {
                                  let daily = row.daily;
                                  if (value === 'daily' && !Object.keys(daily).length) {
                                    try {
                                      daily = Object.fromEntries(
                                        expandSegment(
                                          { ...row, mode: 'equal' },
                                          target?.decimalScale,
                                        ).map((piece) => [piece.date, piece.quantity]),
                                      );
                                    } catch {
                                      daily = {};
                                    }
                                  }
                                  change(row.id, {
                                    mode: value === 'daily' ? 'daily' : 'equal',
                                    daily,
                                    ...(value === 'equal' && row.mode === 'daily'
                                      ? { quantity: String(dailyTotal(row)) }
                                      : {}),
                                  });
                                }}
                              />
                            </div>
                            {row.mode === 'equal' ? (
                              <TextField
                                size="md"
                                className="erp-wo-segment-quantity"
                                label={`분배 수량 (${target?.unit ?? ''})`}
                                aria-label={`조건 ${index + 1} 수량`}
                                value={row.quantity}
                                inputMode="decimal"
                                disabled={disabled}
                                onChange={(event) =>
                                  change(row.id, { quantity: event.target.value })
                                }
                              />
                            ) : (
                              <p className="field-note">
                                날짜별 합계 {total} {target?.unit}
                              </p>
                            )}
                          </div>
                          <label className="erp-wo-distribution-holiday-option">
                            <input
                              type="checkbox"
                              aria-label={`분배 조건 ${index + 1} 휴일 포함`}
                              checked={row.includeHolidays ?? false}
                              disabled={disabled || row.mode === 'daily'}
                              onChange={(event) =>
                                change(row.id, { includeHolidays: event.target.checked })
                              }
                            />
                            휴일 포함
                          </label>
                          {row.mode === 'daily' && (
                            <div className="erp-wo-daily-quantities">
                              {dates.length ? (
                                dates
                                  .slice((visibleDailyPage - 1) * 7, visibleDailyPage * 7)
                                  .map((date) => (
                                    <TextField
                                      key={date}
                                      size="md"
                                      label={date}
                                      aria-label={`조건 ${index + 1} ${date} 수량`}
                                      inputMode="decimal"
                                      value={row.daily[date] ?? ''}
                                      disabled={disabled}
                                      onChange={(event) =>
                                        change(row.id, {
                                          daily: { ...row.daily, [date]: event.target.value },
                                        })
                                      }
                                    />
                                  ))
                              ) : (
                                <p>시작일과 종료일을 확인하세요.</p>
                              )}
                            </div>
                          )}
                          {row.mode === 'daily' && dates.length > 7 && (
                            <PageNav
                              meta={{ page: visibleDailyPage, size: 7, total: dates.length }}
                              onChangePage={(page) =>
                                setDailyPages((current) => ({ ...current, [row.id]: page }))
                              }
                            />
                          )}
                          {resolved && (
                            <p className="erp-wo-distribution-calendar-summary" role="status">
                              분배일 {dayCount}일 · 휴일 {holidayCount}일{' '}
                              {row.includeHolidays ? '포함' : '제외'}
                              {undeterminedCount > 0 && (
                                <> · 판정 불가 {undeterminedCount}일 포함</>
                              )}
                              {row.mode === 'equal' && target?.bottleneckCycleTimeSec != null && (
                                <> · 일별 상한은 분배 미리보기에서 계산</>
                              )}
                              {row.mode === 'equal' && target?.bottleneckCycleTimeSec == null && (
                                <>
                                  {' '}
                                  · 일별 {formatQty(dailyBase)} {target?.unit}
                                  {remainder > 0 && (
                                    <>
                                      {' '}
                                      · 앞 {remainder}일 +{formatQty(1 / scale)} {target?.unit}
                                    </>
                                  )}
                                </>
                              )}
                            </p>
                          )}
                          {workingDays.isError && (
                            <p className="field-note">
                              근무일 정보를 조회하지 못했습니다. 미리보기에서 다시 확인하세요.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!rows.length && (
                  <p className="field-note">
                    편성할 조건이 없습니다. 조건을 추가하거나 ERP W/O별 편성 수량 설정의 이번 계획
                    수량을 확인하세요.
                  </p>
                )}
                <div className="erp-wo-distribution-actions">
                  <Button
                    aria-describedby={`${id}-note`}
                    disabled={disabled || calendarBusy || !rows.some((row) => !row.applied)}
                    onClick={async () => {
                      const requestedSignature = signature;
                      const epoch = ++previewEpoch.current;
                      setCalendarBusy(true);
                      try {
                        const active = rows.filter((row) => !row.applied);
                        const targets = active.flatMap((row) => {
                          const order = orders.find((order) => order.id === row.owner);
                          return order?.plantId
                            ? [
                                {
                                  plantId: order.plantId,
                                  productionLineId: row.lineId ? Number(row.lineId) : null,
                                  capacity: capacityFor(row, order),
                                  from: row.start,
                                  to: row.end,
                                },
                              ]
                            : [];
                        });
                        const calendar = await resolvePlanningDays(client, targets);
                        if (
                          latestSignature.current !== requestedSignature ||
                          previewEpoch.current !== epoch
                        )
                          return;
                        const bySegment = new Map<string, PlanningDay[]>();
                        const notes: CalendarNote[] = [];
                        const holidayDisplay = new Map<string, string>();
                        for (const row of active) {
                          const order = orders.find((order) => order.id === row.owner);
                          if (!order?.plantId) {
                            notes.push({
                              owner: row.owner,
                              summary: '근무일 판정 불가 (공장 미지정)',
                            });
                            continue;
                          }
                          const days = segmentDates(row.start, row.end).map((date) =>
                            calendar.get(
                              planningDayKey(
                                order.plantId!,
                                row.lineId ? Number(row.lineId) : null,
                                date,
                                capacityFor(row, order),
                              ),
                            )!,
                          );
                          bySegment.set(row.id, days);
                          if (row.mode === 'equal' && order.bottleneckCycleTimeSec === null)
                            notes.push({ owner: row.owner, summary: '표준 C/T 미설정' });
                          const holidays = days.filter((day) => day.statusCode === 'HOLIDAY');
                          for (const day of holidays) {
                            holidayDisplay.set(
                              `${row.owner}:${day.date}:${row.lineId}`,
                              planningHolidayLabel(day),
                            );
                          }
                          if (row.mode === 'equal' && holidays.length)
                            notes.push({
                              owner: row.owner,
                              summary: `휴일 ${holidays.length}일 ${row.includeHolidays ? '포함' : '제외'}`,
                              dates: holidays.map((day) => day.date),
                            });
                          if (row.mode === 'daily')
                            holidays
                              .filter((day) => Number(row.daily[day.date]) > 0)
                              .forEach((day) =>
                                notes.push({
                                  owner: row.owner,
                                  summary: planningDayMessage(day) ?? '휴일',
                                  dates: [day.date],
                                }),
                              );
                          const unknown = days.filter(
                            (day) => day.statusCode === 'UNDETERMINED',
                          ).length;
                          if (unknown)
                            notes.push({
                              owner: row.owner,
                              summary: `근무일 판정 불가 ${unknown}일 (미설정)`,
                            });
                        }
                        const result = previewSegments(
                          orders,
                          rows,
                          existing,
                          bySegment,
                          plantToday(),
                        );
                        setCalendarNotes([
                          ...new Map(notes.map((note) => [JSON.stringify(note), note])).values(),
                        ]);
                        setHolidayLabels(holidayDisplay);
                        setResultQuantities({});
                        setPreview({ signature, result });
                        setAcknowledged(false);
                        setResultPage(1);
                        setEditingResultKey(null);
                        setMessage('');
                      } catch (error) {
                        setPreview(null);
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : '휴일을 조회하지 못했습니다. 다시 확인하세요.',
                        );
                      } finally {
                        setCalendarBusy(false);
                      }
                    }}
                  >
                    {calendarBusy ? '휴일 확인 중' : '분배 미리보기'}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={disabled || !dirty}
                    onClick={() => {
                      setRows(baseline.current);
                      setPreview(null);
                      setMessage('');
                      setDirty(false);
                      setAcknowledged(false);
                    }}
                  >
                    조건 초기화
                  </Button>
                </div>
              </>
            )}
            {message && <AlertBanner variant="error">{message}</AlertBanner>}
            {preview && (
              <section className="erp-wo-distribution-preview" aria-label="분배 미리보기 결과">
                <div className="erp-wo-distribution-heading">
                  <h2 className="section-title">분배 결과</h2>
                  <Button
                    disabled={disabled}
                    onClick={() => {
                      setPreview(null);
                      setMessage('');
                      setAcknowledged(false);
                    }}
                  >
                    분배 조건 수정
                  </Button>
                </div>
                {resultError && <AlertBanner variant="error">{resultError}</AlertBanner>}
                {stale && (
                  <AlertBanner variant="warning">
                    계획이나 대상 수량이 바뀌었습니다. 미리보기를 다시 만드세요.
                  </AlertBanner>
                )}
                <div className="erp-wo-preview-scroll">
                  <table className="erp-wo-distribution-result-table">
                    <caption>날짜와 라인별 결과</caption>
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>생산 라인</th>
                        <th className="erp-wo-result-quantity">기존 수량</th>
                        <th className="erp-wo-result-quantity erp-wo-result-added">추가 수량</th>
                        <th className="erp-wo-result-quantity">적용 후 합계</th>
                      </tr>
                    </thead>
                    {Array.from(resultRowsByOrder, ([owner, orderRows]) => {
                      const order = orders.find((entry) => entry.id === owner);
                      const summary = reviewResult?.orders.find((entry) => entry.id === owner);
                      const notes = calendarNotes.filter((note) => note.owner === owner);
                      const unit = order?.unit;
                      return (
                        <tbody key={owner} aria-label={order?.orderNo ?? order?.label ?? owner}>
                          <tr className="erp-wo-result-order">
                            <td colSpan={5}>
                              <div className="erp-wo-result-order-header">
                                <div>
                                  <strong>{order?.orderNo ?? order?.label ?? owner}</strong>
                                  {order?.itemCode && <span>{order.itemCode}</span>}
                                </div>
                                {summary && (
                                  <div>
                                    <span>
                                      이번 분배{' '}
                                      <strong>
                                        {formatQty(summary.added)} {unit}
                                      </strong>
                                    </span>
                                    <span>
                                      미배분{' '}
                                      <strong>
                                        {formatQty(summary.pending)} {unit}
                                      </strong>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                          {orderRows.map((row) => {
                            const key = resultKey(row);
                            const existingQty = existingByResultKey.get(key) ?? 0;
                            const addedQty = Number(row.plannedQty);
                            return (
                              <tr key={key}>
                                <td>
                                  {row.planDate}
                                  {row.holidayLabel && (
                                    <span className="erp-wo-holiday-day-label">
                                      {row.holidayLabel}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {
                                    order?.lines.find(
                                      (line) => String(line.id) === row.plannedLineId,
                                    )?.name
                                  }
                                </td>
                                <td className="erp-wo-result-quantity">
                                  {formatQty(existingQty)} {unit}
                                </td>
                                <td className="erp-wo-result-quantity erp-wo-result-added">
                                  <div className="erp-wo-result-quantity-editor">
                                    <TextField
                                      size="md"
                                      inputMode="decimal"
                                      aria-label={`${row.owner} ${row.planDate} ${row.plannedLineId} 생산량`}
                                      value={row.plannedQty}
                                      onFocus={() => setEditingResultKey(key)}
                                      onBlur={() => setEditingResultKey(null)}
                                      onChange={(event) => {
                                        setResultQuantities((current) => ({
                                          ...current,
                                          [key]: event.target.value,
                                        }));
                                        setAcknowledged(false);
                                      }}
                                    />
                                    <span>{unit}</span>
                                  </div>
                                </td>
                                <td className="erp-wo-result-quantity">
                                  <strong>
                                    {Number.isFinite(addedQty)
                                      ? `${formatQty(existingQty + addedQty)} ${unit ?? ''}`
                                      : '—'}
                                  </strong>
                                </td>
                              </tr>
                            );
                          })}
                          {notes.length > 0 && (
                            <tr className="erp-wo-result-order-notes">
                              <td colSpan={5}>
                                {notes.map((note) => (
                                  <div
                                    className="erp-wo-calendar-result-dates"
                                    key={JSON.stringify(note)}
                                  >
                                    <strong>{note.summary}</strong>
                                    {note.dates?.map((date) => (
                                      <time key={date} dateTime={date}>
                                        {date}
                                      </time>
                                    ))}
                                  </div>
                                ))}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      );
                    })}
                  </table>
                </div>
                {visibleResultRows.length > 10 && (
                  <PageNav
                    meta={{ page: visibleResultPage, size: 10, total: visibleResultRows.length }}
                    onChangePage={setResultPage}
                  />
                )}
                {!!reviewResult!.warnings.length && (
                  <>
                    <AlertBanner variant="warning">
                      <ul>
                        {reviewResult!.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </AlertBanner>
                    <label className="erp-wo-checkbox">
                      <input
                        type="checkbox"
                        disabled={disabled || stale}
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                      />
                      중복 분배 조건과 기존 편성 내용을 확인했습니다.
                    </label>
                  </>
                )}
                <div className="erp-wo-distribution-footer">
                  <Button
                    aria-describedby={`${id}-note`}
                    disabled={
                      disabled ||
                      stale ||
                      !!resultError ||
                      (!acknowledged && reviewResult!.warnings.length > 0)
                    }
                    onClick={() => {
                      if (lock.current || stale || resultError) return;
                      lock.current = true;
                      try {
                        if (reviewResult!.drafts.some((row) => row.planDate < plantToday()))
                          throw new Error('계획일이 지났습니다. 분배 기간을 다시 확인하세요.');
                        onApply(reviewResult!.drafts);
                        const applied = rows.map((row) => ({ ...row, applied: true }));
                        setRows(applied);
                        baseline.current = applied;
                        setDirty(false);
                        setPreview(null);
                        setMessage('');
                        setSelected([]);
                        setOpen(false);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : '적용하지 못했습니다.');
                        setPreview(null);
                      } finally {
                        lock.current = false;
                      }
                    }}
                  >
                    분배안 적용
                  </Button>
                </div>
              </section>
            )}
            <p id={`${id}-note`} className="visually-hidden">
              미리보기만으로 계획은 바뀌지 않습니다. 적용한 결과는 미저장 계획이며 하단에서
              저장하세요. 분배 조건은 현재 생산계획 편집 중에만 유지됩니다.
            </p>
          </div>
        </Dialog>
      )}
    </section>
  );
};

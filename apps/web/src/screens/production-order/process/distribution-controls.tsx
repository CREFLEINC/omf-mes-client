import { useApiClient } from '../../../patterns/api-context';
import {
  resolvePlanningDays,
  planningDayKey,
  planningDayMessage,
  planningHolidayLabel,
  type PlanningDay,
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

export interface DistributionControlsProps {
  orders: readonly DistributionTarget[];
  existing: readonly OwnedDraft[];
  disabled: boolean;
  onApply: (drafts: OwnedDraft[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
}
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
  const [calendarNotes, setCalendarNotes] = useState<string[]>([]);
  const [resultQuantities, setResultQuantities] = useState<Record<string, string>>({});
  const resultKey = (row: OwnedDraft) => `${row.owner}:${row.planDate}:${row.plannedLineId}`;
  const [holidayRows, setHolidayRows] = useState<(OwnedDraft & { holidayLabel: string })[]>([]);
  const latestSignature = useRef('');
  const sequence = useRef(0);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const previewEpoch = useRef(0);
  const [activeId, setActiveId] = useState('');
  const [conditionPage, setConditionPage] = useState(1);
  const [resultPage, setResultPage] = useState(1);
  const [dailyPage, setDailyPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [totalsPage, setTotalsPage] = useState(1);
  const [rows, setRows] = useState<DistributionSegment[]>([]);
  const baseline = useRef<DistributionSegment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ signature: string; result: SegmentPreview } | null>(
    null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [commonStart, setCommonStart] = useState(plantToday());
  const [commonEnd, setCommonEnd] = useState(shiftPlanDate(plantToday(), 6));
  const [commonLine, setCommonLine] = useState('');
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
      plantId: order.plantId,
    })),
    existing,
  });
  latestSignature.current = signature;
  const activeRow = rows.find((row) => row.id === activeId) ?? rows[0];
  const visibleConditionPage = Math.min(conditionPage, Math.max(1, Math.ceil(rows.length / 5)));
  const stale = preview !== null && preview.signature !== signature;
  const previewRows = preview
    ? [
        ...preview.result.drafts,
        ...new Map(
          holidayRows
            .filter(
              (row) =>
                !preview.result.drafts.some(
                  (draft) =>
                    draft.owner === row.owner &&
                    draft.planDate === row.planDate &&
                    draft.plannedLineId === row.plannedLineId,
                ),
            )
            .map((row) => [`${row.owner}:${row.planDate}:${row.plannedLineId}`, row]),
        ).values(),
      ]
        .map((row) => ({
          ...row,
          plannedQty: resultQuantities[resultKey(row)] ?? row.plannedQty,
          ...(holidayRows.find((holiday) => resultKey(holiday) === resultKey(row))
            ? {
                holidayLabel: holidayRows.find((holiday) => resultKey(holiday) === resultKey(row))!
                  .holidayLabel,
              }
            : {}),
        }))
        .sort(
          (a, b) =>
            a.owner.localeCompare(b.owner) ||
            a.planDate.localeCompare(b.planDate) ||
            a.plannedLineId.localeCompare(b.plannedLineId),
        )
    : [];
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
          footer={
            <Button
              variant="outlined"
              onClick={() => {
                previewEpoch.current++;
                setOpen(false);
              }}
            >
              편성 화면으로
            </Button>
          }
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
                    ERP W/O별 분배 조건 <span className="field-note">{rows.length}건</span>
                  </h2>
                  <Button
                    variant="outlined"
                    disabled={disabled || orders.length === 0}
                    onClick={() => {
                      const order = orders.find((order) => order.pending > 0) ?? orders[0];
                      if (order) {
                        const created = createRow(order.id);
                        setRows((current) => [...current, created]);
                        setActiveId(created.id);
                        setConditionPage(Math.floor(rows.length / 5) + 1);
                        setDailyPage(1);
                        setDirty(true);
                        setPreview(null);
                      }
                    }}
                  >
                    분배 조건 추가
                  </Button>
                </div>
                <section className="erp-wo-common-conditions" aria-label="선택 조건 공통 입력">
                  <h3 className="section-title">선택 조건에 공통 기간과 라인 입력</h3>
                  <p className="field-note">선택 {selected.length}건</p>
                  <div className="erp-wo-distribution-fields">
                    <div className="field-cell erp-wo-distribution-period">
                      <span className="field-label">공통 분배 기간</span>
                      <DistributionPeriodPicker
                        label="공통 분배 기간"
                        value={[commonStart, commonEnd]}
                        disabled={disabled}
                        onChange={([start, end]) => {
                          setCommonStart(start);
                          setCommonEnd(end);
                        }}
                      />
                    </div>
                    <div className="field-cell">
                      <span className="field-label">공통 생산 라인 (선택)</span>
                      <DistributionLinePicker
                        label="공통 생산 라인"
                        lines={commonLines}
                        value={commonLine}
                        disabled={disabled}
                        optional
                        combined
                        onChange={setCommonLine}
                      />
                    </div>
                  </div>
                  <Button
                    variant="outlined"
                    disabled={disabled || !selected.length}
                    onClick={() => {
                      try {
                        segmentDates(commonStart, commonEnd);
                        if (
                          commonLine &&
                          selectedOrders.some(
                            (order) => !order.lines.some((line) => String(line.id) === commonLine),
                          )
                        )
                          throw new Error('선택 조건에 공통으로 사용할 수 있는 라인을 고르세요.');
                        setRows((current) =>
                          current.map((row) =>
                            selected.includes(row.id)
                              ? {
                                  ...row,
                                  start: commonStart,
                                  end: commonEnd,
                                  ...(commonLine ? { lineId: commonLine } : {}),
                                  applied: false,
                                }
                              : row,
                          ),
                        );
                        setDirty(true);
                        setPreview(null);
                        setMessage('');
                      } catch (error) {
                        setMessage(
                          error instanceof Error ? error.message : '공통 조건을 확인하세요.',
                        );
                      }
                    }}
                  >
                    선택 항목에 적용
                  </Button>
                </section>
                <div className="erp-wo-distribution-condition-list">
                  <div className="erp-wo-preview-scroll">
                    <table>
                      <caption className="visually-hidden">분배 조건 목록</caption>
                      <thead>
                        <tr>
                          <th scope="col">
                            <input
                              type="checkbox"
                              aria-label="분배 조건 전체 선택"
                              checked={
                                rows.length > 0 && rows.every((row) => selected.includes(row.id))
                              }
                              ref={(input) => {
                                if (input)
                                  input.indeterminate =
                                    rows.some((row) => selected.includes(row.id)) &&
                                    !rows.every((row) => selected.includes(row.id));
                              }}
                              disabled={disabled || rows.length === 0}
                              onChange={(event) =>
                                setSelected(event.target.checked ? rows.map((row) => row.id) : [])
                              }
                            />
                          </th>
                          <th>ERP W/O / 품목</th>
                          <th>기간</th>
                          <th>생산 라인</th>
                          <th>분배 수량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows
                          .slice((visibleConditionPage - 1) * 5, visibleConditionPage * 5)
                          .map((row, offset) => {
                            const index = (visibleConditionPage - 1) * 5 + offset;
                            const target = orders.find((order) => order.id === row.owner);
                            const line = target?.lines.find(
                              (line) => String(line.id) === row.lineId,
                            );
                            const total =
                              row.mode === 'daily' ? dailyTotal(row) : Number(row.quantity) || 0;
                            return (
                              <tr
                                key={row.id}
                                aria-label={`분배 조건 ${index + 1}`}
                                tabIndex={disabled ? -1 : 0}
                                onClick={(event) => {
                                  if (disabled || (event.target as HTMLElement).closest('input'))
                                    return;
                                  setActiveId(row.id);
                                  setDailyPage(1);
                                }}
                                onKeyDown={(event) => {
                                  if (disabled || event.target !== event.currentTarget) return;
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setActiveId(row.id);
                                    setDailyPage(1);
                                  }
                                }}
                                data-active={row.id === activeRow?.id ? 'true' : undefined}
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    aria-label={`분배 조건 ${index + 1} 선택`}
                                    checked={selected.includes(row.id)}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      setSelected((current) =>
                                        event.target.checked
                                          ? [...current, row.id]
                                          : current.filter((key) => key !== row.id),
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  {target?.label ?? 'ERP W/O 선택 필요'}
                                  {row.applied && <span className="field-note">편성안 반영됨</span>}
                                </td>
                                <td className="erp-wo-condition-period">
                                  {row.start} ~ {row.end}
                                </td>
                                <td>{line?.name ?? '생산 라인 미지정'}</td>
                                <td>
                                  {total} {target?.unit}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && (
                    <PageNav
                      meta={{ page: visibleConditionPage, size: 5, total: rows.length }}
                      onChangePage={(page) => {
                        setConditionPage(page);
                        setActiveId(rows[(page - 1) * 5]?.id ?? '');
                        setDailyPage(1);
                      }}
                    />
                  )}
                </div>
                <div className="erp-wo-distribution-segments">
                  {rows.map((row, index) => {
                    if (row.id !== activeRow?.id) return null;
                    const target = orders.find((order) => order.id === row.owner);
                    const dates = dateRange(row);
                    const total =
                      row.mode === 'daily' ? dailyTotal(row) : Number(row.quantity) || 0;
                    const visibleDailyPage = Math.min(
                      dailyPage,
                      Math.max(1, Math.ceil(dates.length / 7)),
                    );
                    return (
                      <div
                        className="erp-wo-distribution-segment"
                        key={row.id}
                        role="group"
                        aria-label={`분배 조건 ${index + 1}`}
                      >
                        <h3 className="section-title">분배 조건 편집</h3>
                        <div>
                          <div className="erp-wo-distribution-row-head">
                            <div className="field-cell">
                              <span className="field-label">ERP W/O / 품목</span>
                              <Select
                                size="md"
                                aria-label={`조건 ${index + 1} ERP W/O`}
                                value={row.owner}
                                disabled={disabled}
                                options={orders.map((order) => ({
                                  value: order.id,
                                  label: order.label,
                                }))}
                                onChange={(owner) =>
                                  change(row.id, {
                                    owner,
                                    lineId: orders
                                      .find((order) => order.id === owner)
                                      ?.lines.some((line) => String(line.id) === row.lineId)
                                      ? row.lineId
                                      : '',
                                  })
                                }
                              />
                            </div>
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
                              조건 삭제
                            </Button>
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
                                  { value: 'equal', label: '균등 배분' },
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
                              onChangePage={setDailyPage}
                            />
                          )}
                          <p className="field-note">
                            ERP W/O 편성 대기 {target?.pending ?? 0} {target?.unit}.{' '}
                            {row.mode === 'equal'
                              ? '균등 배분의 나머지는 앞 날짜부터 배정합니다.'
                              : '현재 기간의 날짜별 수량만 합산합니다.'}
                          </p>
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
                        const notes: string[] = [];
                        const holidayDisplay: (OwnedDraft & { holidayLabel: string })[] = [];
                        for (const row of active) {
                          const order = orders.find((order) => order.id === row.owner);
                          if (!order?.plantId) {
                            notes.push(`${order?.label ?? ''}: 근무일 판정 불가 (공장 미지정)`);
                            continue;
                          }
                          const days = segmentDates(row.start, row.end).map((date) =>
                            calendar.get(
                              planningDayKey(
                                order.plantId!,
                                row.lineId ? Number(row.lineId) : null,
                                date,
                              ),
                            )!,
                          );
                          bySegment.set(row.id, days);
                          const holidays = days.filter((day) => day.statusCode === 'HOLIDAY');
                          for (const day of holidays) {
                            holidayDisplay.push({
                              owner: row.owner,
                              planDate: day.date,
                              plannedLineId: row.lineId,
                              plannedQty: '0',
                              holidayLabel: planningHolidayLabel(day),
                            });
                          }
                          if (row.mode === 'equal' && holidays.length)
                            notes.push(
                              `${order.label}: 휴일 ${holidays.length}일 ${row.includeHolidays ? '포함' : '기본 수량 0'} (${holidays.map((day) => day.date).join(', ')})`,
                            );
                          if (row.mode === 'daily')
                            holidays
                              .filter((day) => Number(row.daily[day.date]) > 0)
                              .forEach((day) =>
                                notes.push(
                                  `${order.label} / ${day.date}: ${planningDayMessage(day)}`,
                                ),
                              );
                          const unknown = days.filter(
                            (day) => day.statusCode === 'UNDETERMINED',
                          ).length;
                          if (unknown)
                            notes.push(`${order.label}: 근무일 판정 불가 ${unknown}일 (미설정)`);
                        }
                        const result = previewSegments(orders, rows, existing, bySegment);
                        setCalendarNotes(notes);
                        setHolidayRows(holidayDisplay);
                        setResultQuantities({});
                        setPreview({ signature, result });
                        setAcknowledged(false);
                        setResultPage(1);
                        setOrderPage(1);
                        setTotalsPage(1);
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
                    조건 변경 취소
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
                    variant="outlined"
                    disabled={disabled}
                    onClick={() => {
                      setPreview(null);
                      setMessage('');
                      setAcknowledged(false);
                    }}
                  >
                    조건 수정
                  </Button>
                </div>
                {calendarNotes.length > 0 && (
                  <div className="erp-wo-planning-day-notice" role="status">
                    {calendarNotes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                )}
                {resultError && <AlertBanner variant="error">{resultError}</AlertBanner>}
                {stale && (
                  <AlertBanner variant="warning">
                    계획이나 대상 수량이 바뀌었습니다. 미리보기를 다시 만드세요.
                  </AlertBanner>
                )}
                <div className="erp-wo-preview-scroll">
                  <table>
                    <caption>ERP W/O별 편성 수량</caption>
                    <thead>
                      <tr>
                        <th>ERP W/O / 품목</th>
                        <th>이번 추가</th>
                        <th>적용 후 편성 대기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewResult!.orders
                        .slice((orderPage - 1) * 10, orderPage * 10)
                        .map((order) => (
                          <tr key={order.id}>
                            <td>{order.label}</td>
                            <td>
                              {order.added} {order.unit}
                            </td>
                            <td>
                              {order.pending} {order.unit}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {reviewResult!.orders.length > 10 && (
                  <PageNav
                    meta={{ page: orderPage, size: 10, total: reviewResult!.orders.length }}
                    onChangePage={setOrderPage}
                  />
                )}
                <div className="erp-wo-preview-scroll">
                  <table>
                    <caption>날짜와 라인별 결과</caption>
                    <thead>
                      <tr>
                        <th>ERP W/O</th>
                        <th>날짜</th>
                        <th>생산 라인</th>
                        <th>추가 수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice((resultPage - 1) * 10, resultPage * 10).map((row) => (
                        <tr key={`${row.owner}-${row.planDate}-${row.plannedLineId}`}>
                          <td>{orders.find((order) => order.id === row.owner)?.label}</td>
                          <td>
                            {row.planDate}
                            {'holidayLabel' in row && (
                              <span className="erp-wo-holiday-day-label">
                                {String(row.holidayLabel)}
                              </span>
                            )}
                          </td>
                          <td>
                            {
                              orders
                                .find((order) => order.id === row.owner)
                                ?.lines.find((line) => String(line.id) === row.plannedLineId)?.name
                            }
                          </td>
                          <td>
                            <TextField
                              size="md"
                              inputMode="decimal"
                              aria-label={`${row.owner} ${row.planDate} ${row.plannedLineId} 생산량`}
                              value={row.plannedQty}
                              onChange={(event) => {
                                setResultQuantities((current) => ({
                                  ...current,
                                  [resultKey(row)]: event.target.value,
                                }));
                                setAcknowledged(false);
                              }}
                            />{' '}
                            {orders.find((order) => order.id === row.owner)?.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewRows.length > 10 && (
                  <PageNav
                    meta={{ page: resultPage, size: 10, total: previewRows.length }}
                    onChangePage={setResultPage}
                  />
                )}
                <section aria-label="선택 ERP W/O의 날짜별 라인 합계">
                  <h3 className="section-title">선택 ERP W/O의 날짜별 라인 합계</h3>
                  <div className="erp-wo-preview-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>날짜</th>
                          <th>라인</th>
                          <th>기존</th>
                          <th>추가</th>
                          <th>합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewResult!.totals
                          .slice((totalsPage - 1) * 10, totalsPage * 10)
                          .map((row) => (
                            <tr key={`${row.date}-${row.lineId}-${row.unit}`}>
                              <td>{row.date}</td>
                              <td>{row.lineLabel}</td>
                              <td>
                                {row.existing} {row.unit}
                              </td>
                              <td>
                                {row.added} {row.unit}
                              </td>
                              <td>
                                {Number((row.existing + row.added).toFixed(6))} {row.unit}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {reviewResult!.totals.length > 10 && (
                    <PageNav
                      meta={{ page: totalsPage, size: 10, total: reviewResult!.totals.length }}
                      onChangePage={setTotalsPage}
                    />
                  )}
                  <p className="field-note">
                    선택한 ERP W/O의 계획만 집계합니다. 생산능력 검증 결과는 아닙니다.
                  </p>
                </section>
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
                    조건 변경 취소
                  </Button>
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

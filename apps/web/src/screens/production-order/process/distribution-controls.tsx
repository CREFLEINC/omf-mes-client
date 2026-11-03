import { useEffect, useId, useRef, useState } from 'react';
import { AlertBanner, Button, DatePicker, TextField } from '@crefle/web-ui';
import { Select } from '../../../patterns/select';
import { DistributionLinePicker } from './distribution-line-picker';
import { plantToday } from '../../../patterns/plant-time';
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
  const sequence = useRef(0);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
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
  const createRow = (owner: string, quantity = ''): DistributionSegment => ({
    id: `${id}-${++sequence.current}`,
    owner,
    start: plantToday(),
    end: shiftPlanDate(plantToday(), 6),
    lineId: '',
    mode: 'equal',
    quantity,
    daily: {},
  });
  const signature = JSON.stringify({
    rows,
    orders: orders.map((order) => ({
      id: order.id,
      pending: order.pending,
      unit: order.unit,
      lines: order.lines.map((line) => line.id),
      decimalScale: order.decimalScale,
    })),
    existing,
  });
  const stale = preview !== null && preview.signature !== signature;
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
      <Button
        variant="outlined"
        aria-expanded={open}
        aria-controls={`${id}-conditions`}
        disabled={disabled}
        onClick={toggleOpen}
      >
        자동 분배
      </Button>
      {open && (
        <div id={`${id}-conditions`} className="pane erp-wo-distribution-settings">
          <div className="erp-wo-distribution-heading">
            <h2 className="section-title">오더별 분배 조건</h2>
            <Button
              variant="outlined"
              disabled={disabled || orders.length === 0}
              onClick={() => {
                const order = orders.find((order) => order.pending > 0) ?? orders[0];
                if (order) {
                  const created = createRow(order.id);
                  setRows((current) => [...current, created]);
                  setDirty(true);
                  setPreview(null);
                }
              }}
            >
              구간 추가
            </Button>
          </div>
          <p className="field-note">
            품목은 생산오더에 따라 표시됩니다. 오더마다 기간과 라인을 다르게 지정하고 여러 구간을
            추가할 수 있습니다. 기존 계획은 보존하며, 같은 오더의 날짜와 라인이 겹치는 구간은
            합산합니다.
          </p>
          <details className="erp-wo-common-conditions">
            <summary>선택 구간에 공통 기간과 라인 입력</summary>
            <label className="erp-wo-checkbox">
              <input
                type="checkbox"
                aria-label="분배 구간 전체 선택"
                checked={rows.length > 0 && rows.every((row) => selected.includes(row.id))}
                onChange={(event) =>
                  setSelected(event.target.checked ? rows.map((row) => row.id) : [])
                }
                disabled={disabled}
              />
              전체 선택 ({selected.length}건)
            </label>
            <div className="erp-wo-distribution-fields">
              <div className="field-cell">
                <span className="field-label">공통 시작일</span>
                <DatePicker
                  size="sm"
                  aria-label="공통 시작일"
                  value={commonStart}
                  disabled={disabled}
                  onChange={setCommonStart}
                />
              </div>
              <div className="field-cell">
                <span className="field-label">공통 종료일</span>
                <DatePicker
                  size="sm"
                  aria-label="공통 종료일"
                  value={commonEnd}
                  disabled={disabled}
                  onChange={setCommonEnd}
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
                    throw new Error('선택 구간에 공통으로 사용할 수 있는 라인을 고르세요.');
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
                  setMessage(error instanceof Error ? error.message : '공통 조건을 확인하세요.');
                }
              }}
            >
              선택 구간에 입력
            </Button>
          </details>
          <div className="erp-wo-distribution-segments">
            {rows.map((row, index) => {
              const target = orders.find((order) => order.id === row.owner);
              const dates = dateRange(row);
              const total = row.mode === 'daily' ? dailyTotal(row) : Number(row.quantity) || 0;
              const line = target?.lines.find((line) => String(line.id) === row.lineId);
              return (
                <div
                  className="erp-wo-distribution-segment"
                  key={row.id}
                  role="group"
                  aria-label={`분배 구간 ${index + 1}`}
                >
                  <label className="erp-wo-checkbox">
                    <input
                      type="checkbox"
                      aria-label={`분배 구간 ${index + 1} 선택`}
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
                    구간 {index + 1}
                    {row.applied && <span className="field-note">편성안 반영됨</span>}
                  </label>
                  <details open>
                    <summary>
                      {target?.label ?? '생산오더 선택'} / {row.start} ~ {row.end} /{' '}
                      {line?.name ?? '라인 선택 필요'} / {total} {target?.unit}
                    </summary>
                    <div className="erp-wo-distribution-row-head">
                      <div className="field-cell">
                        <span className="field-label">ERP W/O / 품목</span>
                        <Select
                          size="sm"
                          aria-label={`구간 ${index + 1} 생산오더`}
                          value={row.owner}
                          disabled={disabled}
                          options={orders.map((order) => ({ value: order.id, label: order.label }))}
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
                        variant="text"
                        size="sm"
                        disabled={disabled}
                        aria-label={`구간 ${index + 1} 삭제`}
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
                        구간 삭제
                      </Button>
                    </div>
                    <div className="erp-wo-segment-fields">
                      <div className="field-cell">
                        <span className="field-label">시작일</span>
                        <DatePicker
                          size="sm"
                          aria-label={`구간 ${index + 1} 시작일`}
                          value={row.start}
                          disabled={disabled}
                          onChange={(start) => change(row.id, { start })}
                        />
                      </div>
                      <div className="field-cell">
                        <span className="field-label">종료일</span>
                        <DatePicker
                          size="sm"
                          aria-label={`구간 ${index + 1} 종료일`}
                          value={row.end}
                          disabled={disabled}
                          onChange={(end) => change(row.id, { end })}
                        />
                      </div>
                      <div className="field-cell erp-wo-segment-line">
                        <span className="field-label">생산 라인</span>
                        <DistributionLinePicker
                          label={`구간 ${index + 1} 생산 라인`}
                          lines={target?.lines ?? []}
                          value={row.lineId}
                          disabled={disabled}
                          onChange={(lineId) => change(row.id, { lineId })}
                        />
                      </div>
                      <div className="field-cell">
                        <span className="field-label">배분 방식</span>
                        <Select
                          size="sm"
                          aria-label={`구간 ${index + 1} 배분 방식`}
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
                          size="sm"
                          label={`구간 수량 (${target?.unit ?? ''})`}
                          aria-label={`구간 ${index + 1} 수량`}
                          value={row.quantity}
                          inputMode="decimal"
                          disabled={disabled}
                          onChange={(event) => change(row.id, { quantity: event.target.value })}
                        />
                      ) : (
                        <p className="field-note">
                          날짜별 합계 {total} {target?.unit}
                        </p>
                      )}
                    </div>
                    {row.mode === 'daily' && (
                      <div className="erp-wo-daily-quantities">
                        {dates.length ? (
                          dates.map((date) => (
                            <TextField
                              key={date}
                              size="sm"
                              label={date}
                              aria-label={`구간 ${index + 1} ${date} 수량`}
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
                    <p className="field-note">
                      오더 편성 대기 {target?.pending ?? 0} {target?.unit}.{' '}
                      {row.mode === 'equal'
                        ? '균등 배분의 나머지는 앞 날짜부터 배정합니다.'
                        : '현재 기간의 날짜별 수량만 합산합니다.'}
                    </p>
                  </details>
                </div>
              );
            })}
          </div>
          {!rows.length && (
            <p className="field-note">
              편성할 구간이 없습니다. 구간을 추가하거나 오더 그리드의 이번 계획 수량을 확인하세요.
            </p>
          )}
          <div className="erp-wo-distribution-actions">
            <Button
              aria-describedby={`${id}-note`}
              disabled={disabled || !rows.some((row) => !row.applied)}
              onClick={() => {
                try {
                  const result = previewSegments(orders, rows, existing);
                  setPreview({ signature, result });
                  setAcknowledged(false);
                  setMessage('');
                } catch (error) {
                  setPreview(null);
                  setMessage(error instanceof Error ? error.message : '조건을 확인하세요.');
                }
              }}
            >
              분배 미리보기
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
          {message && <AlertBanner variant="error">{message}</AlertBanner>}
          {preview && (
            <section className="erp-wo-distribution-preview" aria-label="분배 미리보기 결과">
              <h3 className="section-title">분배 미리보기</h3>
              {stale && (
                <AlertBanner variant="warning">
                  계획이나 대상 수량이 바뀌었습니다. 미리보기를 다시 만드세요.
                </AlertBanner>
              )}
              <div className="erp-wo-preview-scroll">
                <table>
                  <caption>오더별 편성 수량</caption>
                  <thead>
                    <tr>
                      <th>생산오더 / 품목</th>
                      <th>이번 추가</th>
                      <th>적용 후 편성 대기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.result.orders.map((order) => (
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
              <div className="erp-wo-preview-scroll">
                <table>
                  <caption>날짜와 라인별 결과</caption>
                  <thead>
                    <tr>
                      <th>생산오더</th>
                      <th>날짜</th>
                      <th>생산 라인</th>
                      <th>추가 수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.result.drafts.map((row) => (
                      <tr key={`${row.owner}-${row.planDate}-${row.plannedLineId}`}>
                        <td>{orders.find((order) => order.id === row.owner)?.label}</td>
                        <td>{row.planDate}</td>
                        <td>
                          {
                            orders
                              .find((order) => order.id === row.owner)
                              ?.lines.find((line) => String(line.id) === row.plannedLineId)?.name
                          }
                        </td>
                        <td>
                          {row.plannedQty} {orders.find((order) => order.id === row.owner)?.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>선택 오더의 날짜별 라인 합계</summary>
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
                      {preview.result.totals.map((row) => (
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
                <p className="field-note">
                  선택한 오더의 계획만 집계합니다. 생산능력 검증 결과는 아닙니다.
                </p>
              </details>
              {!!preview.result.warnings.length && (
                <>
                  <AlertBanner variant="warning">
                    <ul>
                      {preview.result.warnings.map((warning) => (
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
                    중복 구간과 기존 편성 내용을 확인했습니다.
                  </label>
                </>
              )}
              <Button
                aria-describedby={`${id}-note`}
                disabled={
                  disabled || stale || (!acknowledged && preview.result.warnings.length > 0)
                }
                onClick={() => {
                  if (lock.current || stale) return;
                  lock.current = true;
                  try {
                    onApply(preview.result.drafts);
                    const applied = rows.map((row) => ({ ...row, applied: true }));
                    setRows(applied);
                    baseline.current = applied;
                    setDirty(false);
                    setPreview(null);
                    setMessage('');
                    setSelected([]);
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
            </section>
          )}
          <p id={`${id}-note`} className="field-note">
            미리보기만으로 계획은 바뀌지 않습니다. 적용한 결과는 미저장 계획이며 하단에서
            저장하세요. 분배 조건은 현재 생산계획 편집 중에만 유지됩니다.
          </p>
        </div>
      )}
    </section>
  );
};

import { useApiClient } from '../../../patterns/api-context';
import {
  resolvePlanningDays,
  usePlanningDays,
  planningDayKey,
  planningHolidayLabel,
  type PlanningDay,
} from './planning-working-days';
import { useId, useState } from 'react';
import { Button, Chip, DatePicker, Dialog, TextField } from '@crefle/web-ui';
import { Select } from '../../../patterns/select';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import { validPlanSplit, type PlanSplitPart } from '../../production-plan/quantity-split';
import { shiftPlanDate } from './plan-view-model';
import { formatQty } from './process-model';

export const PlanSplitDialog = ({
  row,
  plantId = null,
  planName,
  identity,
  lineName,
  unit,
  decimalScale,
  onClose,
  onApply,
}: {
  row: ProductionPlanEditorStateRow;
  plantId?: number | null;
  planName: string;
  identity?: { orderNo: string; itemCode: string; itemName: string };
  lineName: string;
  unit: string;
  decimalScale: number;
  onClose: () => void;
  onApply: (parts: PlanSplitPart[]) => void;
}) => {
  const validationId = useId();
  const { client } = useApiClient();
  const [calendarBusy, setCalendarBusy] = useState(false);
  const total = Number(row.draft.plannedQty);
  const scale = 10 ** decimalScale;
  const [count, setCount] = useState('1');
  const [method, setMethod] = useState('equal');
  const [per, setPer] = useState('');
  const [dates, setDates] = useState('sequence');
  const [start, setStart] = useState(row.draft.planDate);
  const generate = (number: number, fixed?: number, planDates?: string[]): PlanSplitPart[] => {
    const whole = Math.round(total * scale);
    return Array.from({ length: number }, (_, i) => ({
      plannedQty: String(
        (fixed === undefined
          ? Math.floor(whole / number) + (i < whole % number ? 1 : 0)
          : Math.min(fixed, whole - i * fixed)) / scale,
      ),
      planDate: planDates?.[i] ?? (dates === 'sequence' ? shiftPlanDate(start, i) : start),
      ...(plantId
        ? { planDateSourceCode: dates === 'sequence' ? ('SYSTEM' as const) : ('USER' as const) }
        : {}),
    }));
  };
  const [parts, setParts] = useState<PlanSplitPart[]>(() =>
    generate(1).map((part) => ({
      ...part,
      ...(plantId ? { planDateSourceCode: row.draft.planDateSourceCode ?? 'USER' } : {}),
    })),
  );
  const [holidayDays, setHolidayDays] = useState<PlanningDay[]>([]);
  const [removedHolidays, setRemovedHolidays] = useState<string[]>([]);
  const [holidayDates, setHolidayDates] = useState<Record<string, string>>({});
  const [holidayQuantities, setHolidayQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [conditionsDirty, setConditionsDirty] = useState(false);
  const lastHolidayDate =
    parts
      .map((part) => part.planDate)
      .sort()
      .at(-1) ?? start;
  const visibleHolidays = holidayDays.filter(
    (day) =>
      !removedHolidays.includes(day.date) &&
      dates === 'sequence' &&
      day.date >= start &&
      day.date <= lastHolidayDate &&
      !parts.some((part) => part.planDate === day.date),
  );
  const appliedParts: PlanSplitPart[] = [
    ...parts,
    ...visibleHolidays
      .filter((day) => Number(holidayQuantities[day.date] || '0') !== 0)
      .map((day) => ({
        planDate: holidayDates[day.date] ?? day.date,
        plannedQty: holidayQuantities[day.date]!,
        planDateSourceCode: 'USER' as const,
      })),
  ].sort((a, b) => a.planDate.localeCompare(b.planDate));
  const sumUnits = appliedParts.reduce(
    (sum, part) => sum + Math.round((Number(part.plannedQty) || 0) * scale),
    0,
  );
  const difference = (Math.round(total * scale) - sumUnits) / scale;
  const valid = validPlanSplit(total, appliedParts, decimalScale);
  const preview = async () => {
    const fixed = Math.round(Number(per) * scale);
    const number =
      method === 'fixed' ? Math.ceil(Math.round(total * scale) / fixed) : Number(count);
    if (
      !Number.isInteger(number) ||
      number < 2 ||
      number > 12 ||
      shiftPlanDate(start, 0) === '' ||
      (method === 'fixed' &&
        (!Number.isFinite(fixed) ||
          fixed <= 0 ||
          Number(Number(per).toFixed(decimalScale)) !== Number(per)))
    ) {
      setError('분할 후 계획은 2~12건으로 지정하고 생산량과 편성 시작일을 확인하세요.');
      return;
    }
    setCalendarBusy(true);
    setConditionsDirty(true);
    try {
      let planDates: string[] | undefined;
      let holidays: PlanningDay[] = [];
      if (plantId && dates === 'sequence') {
        const calendar = await resolvePlanningDays(client, [
          {
            plantId,
            productionLineId: row.draft.plannedLineId ? Number(row.draft.plannedLineId) : null,
            from: start,
            to: shiftPlanDate(start, 365),
          },
        ]);
        holidays = [...calendar.values()].filter((day) => day.statusCode === 'HOLIDAY');
        planDates = [];
        for (
          let date = start;
          date <= shiftPlanDate(start, 365) && planDates.length < number;
          date = shiftPlanDate(date, 1)
        ) {
          const day = calendar.get(
            planningDayKey(
              plantId,
              row.draft.plannedLineId ? Number(row.draft.plannedLineId) : null,
              date,
            ),
          );
          if (day?.statusCode !== 'HOLIDAY') planDates.push(date);
        }
        if (planDates.length < number)
          throw new Error('편성 가능한 날짜가 부족합니다. 편성 시작일을 변경하세요.');
      }
      const next = generate(number, method === 'fixed' ? fixed : undefined, planDates);
      setParts(
        method === 'manual'
          ? next.map((part, i) => ({ ...part, plannedQty: parts[i]?.plannedQty ?? '' }))
          : next,
      );
      setHolidayDays(holidays);
      setHolidayQuantities({});
      setHolidayDates({});
      setRemovedHolidays([]);
      setConditionsDirty(false);
      setCount(String(number));
      setError('');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '휴일을 조회하지 못했습니다. 다시 확인하세요.',
      );
    } finally {
      setCalendarBusy(false);
    }
  };
  const calendar = usePlanningDays(
    plantId
      ? [
          ...parts,
          ...visibleHolidays.map((day) => ({ planDate: holidayDates[day.date] ?? day.date })),
        ].map((part) => ({
          plantId,
          productionLineId: row.draft.plannedLineId ? Number(row.draft.plannedLineId) : null,
          from: part.planDate,
          to: part.planDate,
        }))
      : [],
  );
  const dayOf = (date: string) =>
    plantId
      ? calendar.data?.get(
          planningDayKey(
            plantId,
            row.draft.plannedLineId ? Number(row.draft.plannedLineId) : null,
            date,
          ),
        )
      : undefined;
  const displayRows = [
    ...parts.map((part, index) => ({ part, index, day: undefined as PlanningDay | undefined })),
    ...visibleHolidays.map((day) => ({
      part: {
        planDate: holidayDates[day.date] ?? day.date,
        plannedQty: holidayQuantities[day.date] ?? '0',
      },
      index: -1,
      day,
    })),
  ].sort((a, b) => a.part.planDate.localeCompare(b.part.planDate) || a.index - b.index);
  let sequence = 0;
  const numberedRows = displayRows.map((item) => ({
    ...item,
    sequence: Number(item.part.plannedQty) > 0 ? ++sequence : null,
  }));
  const facts = [
    ['분할 계획', planName],
    ['품목명', identity?.itemName ?? '—'],
    ['분할 생산량', `${formatQty(total)} ${unit}`],
    ['ERP W/O', identity?.orderNo ?? '—'],
    ['계획일', row.draft.planDate],
    ['생산 라인', lineName || '—'],
  ];
  return (
    <Dialog
      open
      title="계획 분할"
      className="erp-wo-plan-split-dialog"
      closeOnBackdropClick={false}
      onClose={onClose}
      footer={
        <>
          <span className="erp-wo-split-footer-count">
            분할 후 계획 건수 {appliedParts.length}건
          </span>
          <Button variant="outlined" onClick={onClose}>
            취소
          </Button>
          <Button
            aria-describedby={!valid || conditionsDirty ? validationId : undefined}
            disabled={!valid || conditionsDirty || calendarBusy}
            onClick={() => {
              if (valid && !conditionsDirty) onApply(appliedParts);
            }}
          >
            분할 적용
          </Button>
        </>
      }
    >
      <div className="erp-wo-split-content" aria-busy={calendarBusy}>
        {calendar.isError && (
          <p className="erp-wo-planning-day-notice" role="status">
            근무일 정보를 조회하지 못했습니다.
          </p>
        )}
        <p className="visually-hidden" id={validationId}>
          분할 조건을 적용하고 계획일과 단위 소수 자릿수를 확인한 뒤 분할 생산량 합계를 맞추세요.
        </p>
        <dl className="erp-wo-split-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <section className="erp-wo-split-section">
          <h3>분할 조건</h3>
          <div className="erp-wo-split-conditions">
            <TextField
              containerClassName="erp-wo-split-input"
              size="md"
              label="분할 후 계획 건수"
              aria-label="분할 후 계획 건수"
              inputMode="numeric"
              value={count}
              disabled={calendarBusy || method === 'fixed'}
              onChange={(event) => {
                setCount(event.target.value);
                setConditionsDirty(true);
              }}
            />
            <div className="field-cell">
              <span className="field-label">분할 방식</span>
              <Select
                disabled={calendarBusy}
                aria-label="분할 방식"
                value={method}
                onChange={(value) => {
                  setMethod(value);
                  setConditionsDirty(true);
                }}
                options={[
                  { value: 'equal', label: '균등 배분' },
                  { value: 'fixed', label: '계획당 생산량 지정' },
                  { value: 'manual', label: '계획별 직접 입력' },
                ]}
              />
            </div>
            {method === 'fixed' && (
              <TextField
                containerClassName="erp-wo-split-input"
                disabled={calendarBusy}
                size="md"
                label={`계획당 생산량 (${unit})`}
                aria-label="계획당 생산량"
                inputMode="decimal"
                value={per}
                onChange={(event) => {
                  setPer(event.target.value);
                  setConditionsDirty(true);
                }}
              />
            )}
            <div className="field-cell">
              <span className="field-label">계획일 설정</span>
              <Select
                disabled={calendarBusy}
                aria-label="계획일 설정"
                value={dates}
                onChange={(value) => {
                  setDates(value);
                  setConditionsDirty(true);
                }}
                options={[
                  { value: 'same', label: '동일일' },
                  { value: 'sequence', label: '1일 간격' },
                  { value: 'manual', label: '계획별 지정' },
                ]}
              />
            </div>
            <div className="erp-wo-split-period-actions">
              <div className="field-cell">
                <span className="field-label">편성 시작일</span>
                <DatePicker
                  disabled={calendarBusy}
                  size="md"
                  aria-label="편성 시작일"
                  value={start}
                  onChange={(value) => {
                    setStart(value);
                    setConditionsDirty(true);
                  }}
                />
              </div>
              <Button
                className="erp-wo-split-action"
                size="md"
                variant="tonal"
                disabled={calendarBusy}
                onClick={preview}
              >
                {calendarBusy ? '휴일 확인 중' : '분할 조건 적용'}
              </Button>
            </div>
          </div>
          {error && <p role="alert">{error}</p>}
        </section>
        <section className="erp-wo-split-section">
          <div className="erp-wo-split-heading">
            <h3>분할 계획 {appliedParts.length}건</h3>
            <Button
              className="erp-wo-split-action"
              size="md"
              variant="tonal"
              disabled={calendarBusy || parts.length >= 12}
              onClick={() => {
                setCount(String(parts.length + 1));
                setParts((current) => [
                  ...current,
                  {
                    plannedQty: '',
                    planDate: start,
                    ...(plantId ? { planDateSourceCode: 'USER' as const } : {}),
                  },
                ]);
              }}
            >
              계획 추가
            </Button>
          </div>
          <div className="erp-wo-split-table-scroll">
            <table className="erp-wo-split-table">
              <colgroup>
                <col style={{ width: '70px' }} />
                <col />
                <col />
                <col style={{ width: '110px' }} />
                <col style={{ width: '60px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>순번</th>
                  <th>생산량 ({unit})</th>
                  <th>계획일</th>
                  <th>근무 구분</th>
                  <th>
                    <span className="visually-hidden">삭제</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {numberedRows.map(({ part, index: i, day, sequence }) => {
                  const status =
                    dayOf(part.planDate) ?? (day?.date === part.planDate ? day : undefined);
                  const holiday = status?.statusCode === 'HOLIDAY';
                  const label = holiday
                    ? planningHolidayLabel(status)
                    : status?.statusCode === 'WORKING'
                      ? '근무일'
                      : status?.statusCode === 'PARTIAL'
                        ? '부분 가동'
                        : '미설정';
                  return (
                    <tr key={day ? `holiday-${day.date}` : i}>
                      <td>{sequence ?? '—'}</td>
                      <td>
                        <TextField
                          containerClassName="erp-wo-split-input"
                          size="md"
                          disabled={calendarBusy}
                          inputMode="decimal"
                          aria-label={day ? `${day.date} 휴일 생산량` : `계획 ${i + 1} 생산량`}
                          value={part.plannedQty}
                          onChange={(event) =>
                            day
                              ? setHolidayQuantities((current) => ({
                                  ...current,
                                  [day.date]: event.target.value,
                                }))
                              : setParts((current) =>
                                  current.map((p, index) =>
                                    index === i ? { ...p, plannedQty: event.target.value } : p,
                                  ),
                                )
                          }
                        />
                      </td>
                      <td>
                        <DatePicker
                          size="md"
                          disabled={calendarBusy}
                          aria-label={day ? `${day.date} 휴일 계획일` : `계획 ${i + 1} 계획일`}
                          value={part.planDate}
                          onChange={(planDate) =>
                            day
                              ? setHolidayDates((current) => ({ ...current, [day.date]: planDate }))
                              : setParts((current) =>
                                  current.map((p, index) =>
                                    index === i
                                      ? {
                                          ...p,
                                          planDate,
                                          ...(plantId
                                            ? { planDateSourceCode: 'USER' as const }
                                            : {}),
                                        }
                                      : p,
                                  ),
                                )
                          }
                        />
                      </td>
                      <td>
                        <Chip variant="status" size="sm" status={holiday ? 'warning' : 'idle'}>
                          {label}
                        </Chip>
                      </td>
                      <td>
                        <Button
                          size="md"
                          variant="outlined"
                          aria-label={day ? `${day.date} 휴일 삭제` : `계획 ${i + 1} 삭제`}
                          disabled={calendarBusy || (!day && parts.length <= 1)}
                          onClick={() => {
                            if (day) setRemovedHolidays((current) => [...current, day.date]);
                            else {
                              setCount(String(parts.length - 1));
                              setParts((current) => current.filter((_, index) => index !== i));
                            }
                          }}
                        >
                          −
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="erp-wo-split-totals" aria-live="polite">
            <div>
              <dt>분할 생산량</dt>
              <dd>
                {formatQty(total)} {unit}
              </dd>
            </div>
            <div>
              <dt>분할 생산량 합계</dt>
              <dd>
                {formatQty(sumUnits / scale)} {unit}
              </dd>
            </div>
            <div>
              <dt>{difference < 0 ? '초과 수량' : '미배분 수량'}</dt>
              <dd>
                {formatQty(Math.abs(difference))} {unit}
              </dd>
            </div>
          </dl>
          {!valid && parts.length > 1 && (
            <p className="field-note" role="status">
              각 생산량과 계획일을 확인하고 합계를 {formatQty(total)} {unit}로 맞추세요.
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
};

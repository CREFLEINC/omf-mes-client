import { shiftPlanDate } from './plan-view-model';
import type { PlanLine } from './plan-step';

export interface ScheduledDraft {
  planDate: string;
  plannedLineId: string;
  plannedQty: string;
}

export interface DistributionTarget {
  id: string;
  label: string;
  unit: string;
  pending: number;
  decimalScale?: number;
  lines: readonly PlanLine[];
}
export interface DistributionSegment {
  id: string;
  owner: string;
  start: string;
  end: string;
  lineId: string;
  mode: 'equal' | 'daily';
  quantity: string;
  daily: Record<string, string>;
  applied?: boolean;
}
export interface OwnedDraft extends ScheduledDraft {
  owner: string;
}
export interface SegmentPreview {
  drafts: OwnedDraft[];
  orders: { id: string; label: string; unit: string; added: number; pending: number }[];
  totals: {
    date: string;
    lineId: string;
    lineLabel: string;
    unit: string;
    existing: number;
    added: number;
  }[];
  warnings: string[];
}
const SCALE = 1_000_000;
const amount = (value: string | number): number => {
  const text =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value - Number(value.toFixed(6))) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 8
      ? String(Number(value.toFixed(6)))
      : String(value).trim();
  const number = Number(text);
  const scaled = Math.round(number * SCALE);
  if (
    !/^\d+(?:\.\d{1,6})?$/.test(text) ||
    !Number.isFinite(number) ||
    !Number.isSafeInteger(scaled)
  )
    throw new Error('수량은 0 이상, 소수 여섯 자리 이내로 입력하세요.');
  return scaled;
};
const add = (a: number, b: number) => {
  if (!Number.isSafeInteger(a + b)) throw new Error('합산 수량이 처리 가능한 범위를 초과합니다.');
  return a + b;
};
export const segmentDates = (start: string, end: string): string[] => {
  if (
    !start ||
    !end ||
    shiftPlanDate(start, 0) !== start ||
    shiftPlanDate(end, 0) !== end ||
    start > end
  )
    throw new Error('시작일과 종료일을 확인하세요.');
  const dates: string[] = [];
  for (let date = start; date <= end; date = shiftPlanDate(date, 1)) {
    if (dates.length >= 366) throw new Error('한 구간은 최대 366일까지 편성할 수 있습니다.');
    dates.push(date);
  }
  return dates;
};
/** 균등 배분은 입력 수량의 자릿수를 유지하고 나머지를 앞 날짜부터 배정한다. */
export const expandSegment = (
  segment: DistributionSegment,
  decimalScale?: number,
): { date: string; quantity: string }[] => {
  const dates = segmentDates(segment.start, segment.end);
  if (segment.mode === 'daily')
    return dates.map((date) => ({
      date,
      quantity: String(amount(segment.daily[date] || '0') / SCALE),
    }));
  const total = amount(segment.quantity);
  if (total <= 0) throw new Error('구간 수량은 0보다 커야 합니다.');
  const trimmed = segment.quantity.trim().replace(/0+$/, '');
  const precision =
    decimalScale ?? (segment.quantity.includes('.') ? (trimmed.split('.')[1]?.length ?? 0) : 0);
  if (!Number.isInteger(precision) || precision < 0 || precision > 6)
    throw new Error('단위 소수 자릿수를 확인하세요.');
  const step = 10 ** (6 - precision);
  if (total % step !== 0) throw new Error(`수량은 단위 소수 ${precision}자리 이내로 입력하세요.`);
  const units = Math.round(total / step);
  const base = Math.floor(units / dates.length),
    remainder = units % dates.length;
  return dates.map((date, index) => ({
    date,
    quantity: String(((base + (index < remainder ? 1 : 0)) * step) / SCALE),
  }));
};

export const previewSegments = (
  targets: readonly DistributionTarget[],
  segments: readonly DistributionSegment[],
  existing: readonly OwnedDraft[],
): SegmentPreview => {
  const result: SegmentPreview = { drafts: [], orders: [], totals: [], warnings: [] };
  const lookup = new Map(targets.map((target) => [target.id, target]));
  const active = segments.filter((segment) => !segment.applied);
  if (!active.length) throw new Error('새 구간을 추가하거나 적용 전 조건을 입력하세요.');
  const generated = new Map<
    string,
    { owner: string; date: string; lineId: string; quantity: number }
  >();
  const allocated = new Map<string, number>();
  for (const [index, segment] of active.entries()) {
    const target = lookup.get(segment.owner);
    if (!target) throw new Error(`구간 ${index + 1}: ERP W/O를 선택하세요.`);
    if (!target.lines.some((line) => String(line.id) === segment.lineId))
      throw new Error(`${target.label}: 생산 라인을 선택하세요.`);
    if (
      target.decimalScale !== undefined &&
      (!Number.isInteger(target.decimalScale) || target.decimalScale < 0 || target.decimalScale > 6)
    )
      throw new Error(`${target.label}: 단위 소수 자릿수를 확인하세요.`);
    let pieces: ReturnType<typeof expandSegment>;
    try {
      pieces = expandSegment(segment, target.decimalScale);
    } catch (error) {
      throw new Error(
        `${target.label}: ${error instanceof Error ? error.message : '기간과 수량을 확인하세요.'}`,
      );
    }
    if (
      target.decimalScale !== undefined &&
      pieces.some((piece) => amount(piece.quantity) % 10 ** (6 - target.decimalScale!) !== 0)
    )
      throw new Error(
        `${target.label}: 단위 소수 ${target.decimalScale}자리 이내로 수량을 입력하세요.`,
      );
    const total = pieces.reduce((sum, piece) => add(sum, amount(piece.quantity)), 0);
    if (!total) throw new Error(`${target.label}: 날짜별 수량을 입력하세요.`);
    const next = add(allocated.get(target.id) ?? 0, total);
    if (next > amount(target.pending))
      throw new Error(
        `${target.label}: 구간 합계 ${next / SCALE} ${target.unit}가 편성 대기 ${target.pending} ${target.unit}를 초과합니다.`,
      );
    allocated.set(target.id, next);
    for (const piece of pieces) {
      const qty = amount(piece.quantity);
      if (!qty) continue;
      const key = JSON.stringify([target.id, piece.date, segment.lineId]);
      const row = generated.get(key);
      if (row)
        result.warnings.push(
          `${target.label} / ${piece.date}: 같은 날짜와 라인의 구간을 합산합니다.`,
        );
      generated.set(key, {
        owner: target.id,
        date: piece.date,
        lineId: segment.lineId,
        quantity: add(row?.quantity ?? 0, qty),
      });
    }
  }
  const totals = new Map<
    string,
    {
      date: string;
      lineId: string;
      lineLabel: string;
      unit: string;
      existing: number;
      added: number;
    }
  >();
  const occupied = new Set(
    existing
      .filter((row) => amount(row.plannedQty) > 0)
      .map((row) => JSON.stringify([row.owner, row.planDate, row.plannedLineId])),
  );
  for (const [key, row] of generated) {
    const target = lookup.get(row.owner)!;
    if (occupied.has(key))
      result.warnings.push(
        `${target.label} / ${row.date}: 같은 라인의 기존 계획을 보존하고 추가 계획을 만듭니다.`,
      );
    result.drafts.push({
      owner: row.owner,
      planDate: row.date,
      plannedLineId: row.lineId,
      plannedQty: String(row.quantity / SCALE),
    });
    const totalKey = JSON.stringify([row.date, row.lineId, target.unit]);
    const cell = totals.get(totalKey) ?? {
      date: row.date,
      lineId: row.lineId,
      lineLabel: target.lines.find((line) => String(line.id) === row.lineId)?.name ?? row.lineId,
      unit: target.unit,
      existing: 0,
      added: 0,
    };
    cell.added = add(cell.added, row.quantity);
    totals.set(totalKey, cell);
  }
  for (const row of existing) {
    const target = lookup.get(row.owner);
    if (!target) continue;
    const key = JSON.stringify([row.planDate, row.plannedLineId, target.unit]);
    const cell = totals.get(key);
    if (cell) cell.existing = add(cell.existing, amount(row.plannedQty));
  }
  result.totals = [...totals.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.lineId.localeCompare(b.lineId))
    .map((row) => ({ ...row, added: row.added / SCALE, existing: row.existing / SCALE }));
  result.orders = targets.map((target) => ({
    id: target.id,
    label: target.label,
    unit: target.unit,
    added: (allocated.get(target.id) ?? 0) / SCALE,
    pending: (amount(target.pending) - (allocated.get(target.id) ?? 0)) / SCALE,
  }));
  result.drafts.sort(
    (a, b) =>
      a.owner.localeCompare(b.owner) ||
      a.planDate.localeCompare(b.planDate) ||
      a.plannedLineId.localeCompare(b.plannedLineId),
  );
  result.warnings = [...new Set(result.warnings)];
  return result;
};

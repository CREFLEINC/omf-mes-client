import type {
  DashboardEquipment,
  DashboardEquipmentItem,
  DashboardEquipmentStatusCode,
} from '@omf-mes/api-client';

import type { SelectOption } from './types';

/**
 * 설비 현황(omf-all-around#111)이 다루는 모양.
 *
 * ⭐ **상태는 서버가 판단한다**(#118 2차 응답 규격 「상태 판단」). 화면은 받은 상태 코드를 그대로
 * 그린다 — 작업세션 · 비가동 · 고장 기록을 여기서 다시 조합하지 않는다. 조합을 두 벌 두면 서버와
 * 화면이 같은 설비를 서로 다른 상태로 말하는 날이 온다.
 *
 * ⛔ 실측 C/T · C/T 달성률은 없다 — 실측을 수집하지 않는다(PLC 연동 없음). 표준 C/T 만 보인다.
 */

/** 규격의 상태 순서 — 가동 · 정지 · 대기 · 교체 · 비가동. 집계 줄과 범례가 이 순서로 선다. */
export const EQUIPMENT_STATUS_ORDER: readonly DashboardEquipmentStatusCode[] = [
  'RUNNING',
  'STOPPED',
  'WAITING',
  'CHANGEOVER',
  'IDLE',
];

export interface EquipmentItemView {
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  /** 톤수(설비 유형 이름). 설정되지 않았으면 `null`. */
  tonnage: string | null;
  productionLineId: number | null;
  productionLineName: string | null;
  statusCode: DashboardEquipmentStatusCode;
  /** 상태가 시작된 시각(원문). */
  statusSince: string | null;
  reasonName: string | null;
  /**
   * 상태가 이어진 분. **서버의 판단 시각(`asOf`)까지** 잰다 — 브라우저 시계로 재면 과거 기준일을 볼 때
   * 「지금까지」가 되어 엉뚱하게 길어지고, 단말 시계가 틀리면 음수가 난다. 잴 수 없으면 `null`.
   */
  elapsedMinutes: number | null;
  todayTotalQty: number;
  todayNgQty: number;
  defectRate: number | null;
  standardCycleTimeSec: number | null;
  currentWorkOrderNo: string | null;
  currentItemCode: string | null;
  currentItemName: string | null;
}

export interface EquipmentStatusCountView {
  statusCode: DashboardEquipmentStatusCode;
  count: number;
}

export interface EquipmentView {
  asOf: string;
  statusCounts: EquipmentStatusCountView[];
  totalCount: number;
  items: EquipmentItemView[];
}

const parseInstant = (value: string): number | null => {
  const time = Date.parse(value);

  return Number.isNaN(time) ? null : time;
};

/** 시작 시각부터 판단 시각까지의 분. 둘 중 하나라도 읽을 수 없거나 거꾸로면 `null`. */
export const elapsedMinutesOf = (since: string | null, asOf: string): number | null => {
  if (since === null) return null;

  const start = parseInstant(since);
  const end = parseInstant(asOf);
  if (start === null || end === null || end < start) return null;

  return Math.floor((end - start) / 60_000);
};

const toItemView = (source: DashboardEquipmentItem, asOf: string): EquipmentItemView => ({
  equipmentId: source.equipmentId,
  equipmentCode: source.equipmentCode,
  equipmentName: source.equipmentName,
  tonnage: source.equipmentTypeName,
  productionLineId: source.productionLineId,
  productionLineName: source.productionLineName,
  statusCode: source.statusCode,
  statusSince: source.statusSince,
  reasonName: source.statusReasonName,
  elapsedMinutes: elapsedMinutesOf(source.statusSince, asOf),
  todayTotalQty: source.todayTotalQty,
  todayNgQty: source.todayNgQty,
  defectRate: source.defectRate,
  standardCycleTimeSec: source.standardCycleTimeSec,
  currentWorkOrderNo: source.currentWorkOrderNo,
  currentItemCode: source.currentItemCode,
  currentItemName: source.currentItemName,
});

/**
 * 응답의 설비 섹션을 화면 모양으로 옮긴다. **섹션이 오지 않으면 `null`이다** — 서버가 아직 2차
 * 규격을 배포하지 않았을 때다. 빈 목록(설비 0대)과 같은 모양으로 그리면 「설비가 없다」로 읽힌다.
 */
export const toEquipmentView = (source: DashboardEquipment | undefined): EquipmentView | null => {
  if (source === undefined) return null;

  const statusCounts = EQUIPMENT_STATUS_ORDER.map((statusCode) => ({
    statusCode,
    count: source.statusCounts[statusCode],
  }));

  return {
    asOf: source.asOf,
    statusCounts,
    totalCount: statusCounts.reduce((sum, entry) => sum + entry.count, 0),
    items: source.items.map((item) => toItemView(item, source.asOf)),
  };
};

/** 설비 가동 현황 타일의 기본 표시 대수(사용자 지시 2026-10-16). 나머지는 「전체 설비 보기」 창에서. */
export const EQUIPMENT_TILE_PREVIEW_COUNT = 12;

/**
 * 타일 표시 우선순위(사용자 지시 2026-10-16) — 정지 → 대기 → 교체 → 비가동 → 가동.
 * 정지(고장 · 중단)가 가장 급하고, 대기는 근무 중인데 일이 없는 손실, 교체는 계획된 작업이지만 진행 확인이
 * 필요하고, 비가동은 계획 정지 · 비근무라 급하지 않다. 가동은 정상이라 맨 뒤.
 */
export const BOARD_STATUS_PRIORITY: readonly DashboardEquipmentStatusCode[] = [
  'STOPPED',
  'WAITING',
  'CHANGEOVER',
  'IDLE',
  'RUNNING',
];

/** 설비 코드 자연 정렬 — PERF-E-1-2 < PERF-E-1-10. */
const codeCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** 설비 코드 자연 정렬 비교 — 설비 타일 · 호기별 불량률이 같은 규칙을 쓴다. */
export const compareEquipmentCode = (a: string, b: string): number => codeCollator.compare(a, b);

/** 우선순위 → 같은 상태 안에서는 설비 코드 자연 정렬. 받은 배열은 건드리지 않는다. */
export const sortForBoard = (items: readonly EquipmentItemView[]): EquipmentItemView[] =>
  [...items].sort(
    (a, b) =>
      BOARD_STATUS_PRIORITY.indexOf(a.statusCode) - BOARD_STATUS_PRIORITY.indexOf(b.statusCode) ||
      codeCollator.compare(a.equipmentCode, b.equipmentCode),
  );

/** 라인 필터의 「전체」. 라인 번호는 양의 정수라 빈 문자열과 겹치지 않는다. */
export const ALL_LINES = '';

/**
 * 라인 선택지 — **받은 설비에서 뽑는다.** 라인 목록을 따로 부르지 않는다: 설비가 없는 라인을
 * 고르면 빈 화면만 남고, 공장을 바꿨을 때 다른 공장의 라인이 남는다. 라인이 없는 설비는 「전체」에서만 보인다.
 */
export const toLineOptions = (items: readonly EquipmentItemView[]): SelectOption[] => {
  const lines = new Map<number, string>();
  for (const item of items) {
    if (item.productionLineId !== null && !lines.has(item.productionLineId)) {
      lines.set(item.productionLineId, item.productionLineName ?? String(item.productionLineId));
    }
  }

  /*
   * 이름이 같은 라인이 여럿이면(공장 전체 선택 시 다른 공장의 같은 이름 라인) 라인 번호를 덧붙여 가른다 —
   * 「PERF · 3」. 데이터는 그대로 두고 표기만 바꾼다(사용자 지시 2026-10-16).
   */
  const nameCount = new Map<string, number>();
  for (const name of lines.values()) nameCount.set(name, (nameCount.get(name) ?? 0) + 1);

  return [...lines.entries()]
    .sort(([idA, a], [idB, b]) => a.localeCompare(b) || idA - idB)
    .map(([id, name]) => ({
      value: String(id),
      label: (nameCount.get(name) ?? 0) > 1 ? `${name} · ${String(id)}` : name,
    }));
};

/** 고른 라인의 설비. 라인은 `effectiveLine`을 거친 값을 넘긴다. */
export const filterByLine = (
  items: readonly EquipmentItemView[],
  line: string,
): EquipmentItemView[] =>
  line === ALL_LINES ? [...items] : items.filter((item) => String(item.productionLineId) === line);

/**
 * 실제로 걸 라인. 고른 라인이 지금 선택지에 없으면(공장을 바꿨다 · 자동 갱신으로 빠졌다) **전체로 본다** —
 * 남은 선택이 화면을 텅 비게 두면 사용자는 설비가 다 사라진 것으로 읽는다.
 */
export const effectiveLine = (options: readonly SelectOption[], line: string): string =>
  options.some((option) => option.value === line) ? line : ALL_LINES;

/**
 * 멈춘 설비 — 가동이 아닌 설비(정지 · 대기 · 교체 · 비가동). **오래 멈춘 것부터** 선다:
 * 이 목록은 「어디부터 가 볼까」를 정하는 자리다. 경과를 잴 수 없는 설비는 뒤로 간다.
 */
export const toStoppedItems = (items: readonly EquipmentItemView[]): EquipmentItemView[] =>
  items
    .filter((item) => item.statusCode !== 'RUNNING')
    .sort((a, b) => (b.elapsedMinutes ?? -1) - (a.elapsedMinutes ?? -1));

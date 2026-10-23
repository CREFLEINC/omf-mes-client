import type {
  InboundLotProgress,
  InboundScheduleLine,
  InboundStageCode,
  InboundStageCounts,
  InboundStageGroup,
  PurchaseOrderSummary,
} from './types';

/**
 * 입고 단계의 **순수 규칙** — 단계 코드 → 묶음 · 색, 발주의 「가장 뒤처진 단계」, 라인 아래 LOT 줄 펴기.
 *
 * 단계 자체는 서버가 판정한다(C-17). 여기는 서버가 준 값을 **보이는 모양으로 옮기기만** 한다 —
 * 검사 결과·입고 전표·적치 작업을 조합해 단계를 지어내는 코드는 두지 않는다.
 */

/** 묶음의 차례 — 흐름 순서다. 앞에 있을수록 「뒤처진」 것이다(검사가 안 끝난 LOT 이 입고 대기 LOT 보다 앞 단계). */
export const STAGE_GROUPS: readonly InboundStageGroup[] = [
  'INSPECTION',
  'HELD',
  'RECEIPT',
  'PUTAWAY',
];

const GROUP_OF: Record<InboundStageCode, InboundStageGroup | null> = {
  INSPECTION_REQUIRED: 'INSPECTION',
  INSPECTION_REQUESTED: 'INSPECTION',
  INSPECTION_IN_PROGRESS: 'INSPECTION',
  INSPECTION_HELD: 'HELD',
  RECEIPT_READY: 'RECEIPT',
  PUTAWAY_PENDING: 'PUTAWAY',
  PUTAWAY_TEMPORARY: 'PUTAWAY',
  COMPLETED: null,
  CANCELLED: null,
};

export const isStageCode = (code: string): code is InboundStageCode => code in GROUP_OF;

/** 주소의 `stage=` 값이 묶음인가 — 아니면 조건으로 보지 않는다. */
export const isStageGroup = (value: string): value is InboundStageGroup =>
  (STAGE_GROUPS as readonly string[]).includes(value);

/** 단계 코드의 묶음. 끝난 것(완료·취소)과 모르는 코드는 `null` — 어느 칩에도 세지 않는다. */
export const stageGroupOf = (code: string): InboundStageGroup | null =>
  isStageCode(code) ? GROUP_OF[code] : null;

/** 진행 표식의 색 — 저장소 관례(기다림 warning · 문제 error · 이 화면의 할 일 info · 다른 곳의 할 일 idle · 끝 success). */
export type StageTone = 'idle' | 'info' | 'success' | 'error' | 'warning';

const TONE_OF: Record<InboundStageCode, StageTone> = {
  /* 검사 의뢰 전은 **이 화면의 할 일**(IQC 의뢰 요청)이라 입고 대기와 같은 파랑이다. */
  INSPECTION_REQUIRED: 'info',
  INSPECTION_REQUESTED: 'warning',
  INSPECTION_IN_PROGRESS: 'warning',
  INSPECTION_HELD: 'error',
  RECEIPT_READY: 'info',
  PUTAWAY_PENDING: 'idle',
  PUTAWAY_TEMPORARY: 'idle',
  COMPLETED: 'success',
  CANCELLED: 'idle',
};

export const stageTone = (code: string): StageTone => (isStageCode(code) ? TONE_OF[code] : 'idle');

const GROUP_TONE: Record<InboundStageGroup, StageTone> = {
  INSPECTION: 'warning',
  HELD: 'error',
  RECEIPT: 'info',
  PUTAWAY: 'idle',
};

export const stageGroupTone = (group: InboundStageGroup): StageTone => GROUP_TONE[group];

/** 수가 있는 묶음만 흐름 순서로. */
export const presentGroups = (counts: InboundStageCounts): InboundStageGroup[] =>
  STAGE_GROUPS.filter((group) => (counts[group] ?? 0) > 0);

/**
 * 발주의 「진행」 한 칸 — 가장 뒤처진 묶음과 그 수, 나머지 묶음 수(「외 N」). 아무 묶음도 없으면 `null`.
 * 여럿을 다 늘어놓지 않는다 — 칸 하나에 칩 둘 이상이면 줄이 넘친다(C-16·C-17 「첫 사유와 외 N」).
 */
export interface StageLead {
  group: InboundStageGroup;
  count: number;
  others: number;
}

export const stageLead = (counts: InboundStageCounts): StageLead | null => {
  const groups = presentGroups(counts);
  const first = groups[0];

  if (first === undefined) return null;

  return { group: first, count: counts[first] ?? 0, others: groups.length - 1 };
};

/** 왼쪽 표에 「진행」 열을 세울 것인가 — 서버가 한 줄에라도 묶음 수를 실었는가. 앞선 서버면 열이 없다. */
export const hasStageCounts = (rows: readonly PurchaseOrderSummary[]): boolean =>
  rows.some((row) => row.inboundStageCounts !== undefined);

/**
 * LOT 을 발주 라인별로 묶는다. 한 라인 안은 **입하 일시 → LOT 번호** 순이다 — 먼저 들어온 것이 위다.
 * 라인에 없는 LOT(서버가 다른 라인 번호를 실었다)은 어느 줄 아래에도 서지 않는다.
 */
export const progressByLine = (
  items: readonly InboundLotProgress[],
): ReadonlyMap<number, InboundLotProgress[]> => {
  const byLine = new Map<number, InboundLotProgress[]>();

  for (const item of items) {
    const bucket = byLine.get(item.purchaseOrderLineId) ?? [];
    bucket.push(item);
    byLine.set(item.purchaseOrderLineId, bucket);
  }

  for (const bucket of byLine.values()) {
    bucket.sort(
      (left, right) =>
        left.receiptDatetime.localeCompare(right.receiptDatetime) ||
        left.lotNo.localeCompare(right.lotNo),
    );
  }

  return byLine;
};

/**
 * 오른쪽 표의 한 줄 — 발주 라인이거나, 그 아래 딸린 LOT 줄이다.
 *
 * 표 부품에 하위 줄이 없어 같은 열에 평평하게 편다(입하 등록 창의 LOT 줄과 같은 길). 계층은 첫 칸의 안내선이
 * 보인다 — 발주 라인의 접기 손잡이 가운데에서 선이 내려와 마지막 LOT 앞에서 갈고리로 꺾인다(사이드바 묶음과 같은 모양).
 */
export type LineTableRow =
  | { kind: 'line'; line: InboundScheduleLine; lots: InboundLotProgress[]; isExpanded: boolean }
  | { kind: 'lot'; line: InboundScheduleLine; lot: InboundLotProgress; isLast: boolean };

const NO_LOTS: InboundLotProgress[] = [];

/**
 * 라인과 LOT 을 표 줄로 편다. 접힌 라인(`collapsed`)의 LOT 은 내지 않는다 — 접기는 라인 단위다.
 * 진행 자료가 없으면(`lots === undefined` — 앞선 서버·조회 전) 라인만 선다.
 */
export const toLineTableRows = (
  lines: readonly InboundScheduleLine[],
  lots: ReadonlyMap<number, InboundLotProgress[]> | undefined,
  collapsed: ReadonlySet<number>,
): LineTableRow[] =>
  lines.flatMap((line): LineTableRow[] => {
    const own = lots?.get(line.purchaseOrderLineId) ?? NO_LOTS;
    const isExpanded = own.length > 0 && !collapsed.has(line.purchaseOrderLineId);

    return [
      { kind: 'line', line, lots: own, isExpanded },
      ...(isExpanded
        ? own.map((lot, index): LineTableRow => ({
            kind: 'lot',
            line,
            lot,
            isLast: index === own.length - 1,
          }))
        : []),
    ];
  });

/** React key — 화면에 나오지 않는다. */
export const lineTableRowId = (row: LineTableRow): string =>
  row.kind === 'line'
    ? String(row.line.purchaseOrderLineId)
    : `${String(row.line.purchaseOrderLineId)}:lot:${String(row.lot.lotId)}`;

/** LOT 이 딸린 라인 번호 전부 — 「모두 접기」가 접는 대상이다. */
export const linesWithLots = (
  lines: readonly InboundScheduleLine[],
  lots: ReadonlyMap<number, InboundLotProgress[]> | undefined,
): number[] =>
  lines
    .filter((line) => (lots?.get(line.purchaseOrderLineId)?.length ?? 0) > 0)
    .map((line) => line.purchaseOrderLineId);

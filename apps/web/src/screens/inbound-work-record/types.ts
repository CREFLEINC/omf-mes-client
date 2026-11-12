import type { ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toPlantDateTimeParts } from '../../patterns/plant-time';
import type {
  Allocation,
  Candidate,
  FinalizeBlocker,
  MaterialLot,
  WorkRecordLot,
} from './forward-contract';

const t = messages.inboundWorkRecord;

/** 보기 탭(screens/W-01-16.md) — 주소 `?view=ready|prog|final`. */
export const VIEWS = ['ready', 'prog', 'final'] as const;
export type View = (typeof VIEWS)[number];

export const parseView = (value: string | null): View =>
  VIEWS.find((view) => view === value) ?? 'ready';

/** 행이 어느 보기에 서는가 — 최종 마감 › 마감 승인 대기(`finalizable`) › 진행 중. */
export const viewOf = (lot: Pick<WorkRecordLot, 'statusCode' | 'finalizable'>): View => {
  if (lot.statusCode === 'FINALIZED') return 'final';
  return lot.finalizable ? 'ready' : 'prog';
};

const qtyFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });

/** 수량 「2,050」. */
export const formatQty = (value: number): string => qtyFormatter.format(value);

/** 공장 시각 「MM-DD HH:mm」 — 못 읽으면 null. */
export const formatAt = (value: string | null | undefined): string | null => {
  const parts = toPlantDateTimeParts(value);
  if (parts === null) return null;
  return `${parts.date.slice(5)} ${parts.time.slice(0, 5)}`;
};

/** 날짜 「MM-DD」(`YYYY-MM-DD` 의 뒤). */
export const shortDate = (value: string): string => value.slice(5, 10);

/**
 * P/O 라인 짧은 이름 「{P/O 끝}/{라인}」(screens/W-01-16.md) — P/O 번호의 마지막 `-` 뒤 토막과 라인 번호.
 * 매칭 요약 · 매칭 수정 오류 줄이 같은 이름을 쓴다.
 */
export const lineLabel = (line: Pick<Allocation, 'purchaseOrderNo' | 'lineNo'>): string => {
  const tail = line.purchaseOrderNo.split('-').pop() ?? line.purchaseOrderNo;
  return `${tail}/${String(line.lineNo)}`;
};

/** 막힘 한 줄의 문구(「IQC 진행 중 — 자재 관리 LOT N개」). */
export const blockerText = (blocker: FinalizeBlocker): string =>
  t.blockers[blocker.code](blocker.lotNos.length);

/** 막힘 여럿을 「 · 」로 잇는다. 없으면 null. */
export const blockersText = (blockers: readonly FinalizeBlocker[] | undefined): string | null =>
  blockers === undefined || blockers.length === 0
    ? null
    : blockers.map(blockerText).join(t.list.separator);

/** 「진행 중」 행 · 상세의 최종 마감 못 하는 이유. */
export const reasonOf = (
  lot: Pick<WorkRecordLot, 'statusCode' | 'finalizeBlockers'>,
  blockers?: readonly FinalizeBlocker[],
): string => {
  if (lot.statusCode === 'RECEIVING') return t.list.receiving;
  return blockersText(blockers ?? lot.finalizeBlockers) ?? t.list.blockedUnknown;
};

/** 자재 관리 LOT 한 개의 상태 칩(상세 표 — 시안의 「입고됨 · 반품 처분 끝 · …」). */
export const materialLotStatus = (
  lot: MaterialLot,
  inboundStatus: WorkRecordLot['statusCode'],
): { label: string; status: ChipStatus } => {
  const s = t.detail.lotStatus;
  if (lot.goodsReceived === true) return { label: s.received, status: 'success' };
  if (lot.dispositionStatusCode === 'RETURNED') return { label: s.returned, status: 'idle' };
  if (lot.dispositionStatusCode === 'DISPOSED') return { label: s.disposed, status: 'idle' };
  if (lot.dispositionStatusCode === 'IN_PROGRESS')
    return { label: s.dispositionInProgress, status: 'warning' };
  if (lot.statusCode === 'INSPECTION_PENDING')
    return inboundStatus === 'RECEIVING'
      ? { label: s.inspectionHold, status: 'warning' }
      : { label: s.iqcInProgress, status: 'warning' };
  return { label: s.waitingReceipt, status: 'warning' };
};

/** 매칭 요약 한 토막 — 화면이 강조(초과 · P/O 없음)를 고른다. */
export type MatchPart =
  { kind: 'line'; text: string; excess: boolean } | { kind: 'unallocated'; text: string };

/** 행의 P/O 매칭 요약(screens/W-01-16.md 「P/O 매칭 칸」). 입하 중이면 null(「마감 때 자동 매칭」). */
export const matchParts = (
  lot: Pick<WorkRecordLot, 'statusCode' | 'poAllocations' | 'unallocatedQty'>,
): MatchPart[] | null => {
  if (lot.statusCode === 'RECEIVING') return null;
  const parts: MatchPart[] = (lot.poAllocations ?? [])
    .filter((allocation) => allocation.qty > 0)
    .map((allocation) => {
      const excess = allocation.excessQty ?? 0;
      const base = t.list.matchLine(lineLabel(allocation), formatQty(allocation.qty));
      return excess > 0
        ? { kind: 'line', text: `${base} ${t.list.excess(formatQty(excess))}`, excess: true }
        : { kind: 'line', text: base, excess: false };
    });
  if (lot.unallocatedQty > 0)
    parts.push({ kind: 'unallocated', text: t.list.unallocated(formatQty(lot.unallocatedQty)) });
  return parts;
};

/** 후보 라인의 이전 받은 양(이 입하 LOT 몫 뺀 것). */
export const previousOf = (candidate: Candidate): number =>
  candidate.receivedQty - candidate.thisLotQty;

/** 후보 라인의 잔량을 넘은 매칭(초과) — 발주 − 이전 받은 양 을 넘은 몫. */
export const excessOf = (candidate: Candidate, qty: number): number =>
  Math.max(0, qty - (candidate.orderedQty - previousOf(candidate)));

/** 매칭 수정 칸의 값 — 비었거나 수가 아니면 NaN. 천 단위 쉼표는 지운다. */
export const parseQty = (value: string): number => {
  const trimmed = value.replace(/,/g, '').trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
};

export interface EditorError {
  /** 줄 오류면 그 P/O 라인, 합계 오류면 null. */
  purchaseOrderLineId: number | null;
  text: string;
}

/** 한도 넘음 문구 — 즉시 검사와 서버 400 `RANGE` 가 같은 문구를 쓴다. */
export const overLimitText = (
  candidate: Candidate,
  qty: number,
  limit: number,
  uom: string,
): string =>
  t.editor.overLimit(
    lineLabel(candidate),
    formatQty(qty),
    formatQty(limit),
    uom,
    formatQty(candidate.orderedQty),
    formatQty(candidate.toleranceQty),
    formatQty(previousOf(candidate)),
  );

/**
 * 매칭 수정 즉시 검사(screens/W-01-16.md 「즉시 검사」) — 줄마다 0 이상의 수 · 한도(`maxQty`), 매칭 합 ≤ 입하 수량.
 * P/O 없음은 입력이 아니라 입하 수량 − 매칭 합이다.
 */
export const checkAllocations = (
  candidates: readonly Candidate[],
  values: Readonly<Record<number, string>>,
  receivedQty: number,
  uom: string,
): { errors: EditorError[]; sum: number; unallocated: number } => {
  const errors: EditorError[] = [];
  let sum = 0;
  for (const candidate of candidates) {
    const qty = parseQty(values[candidate.purchaseOrderLineId] ?? '0');
    if (!Number.isFinite(qty) || qty < 0) {
      errors.push({
        purchaseOrderLineId: candidate.purchaseOrderLineId,
        text: t.editor.notNumber(lineLabel(candidate)),
      });
      continue;
    }
    sum += qty;
    if (qty > candidate.maxQty)
      errors.push({
        purchaseOrderLineId: candidate.purchaseOrderLineId,
        text: overLimitText(candidate, qty, candidate.maxQty, uom),
      });
  }
  if (sum > receivedQty)
    errors.push({
      purchaseOrderLineId: null,
      text: t.editor.overTotal(
        formatQty(sum),
        formatQty(receivedQty),
        uom,
        formatQty(sum - receivedQty),
      ),
    });
  return { errors, sum, unallocated: receivedQty - sum };
};

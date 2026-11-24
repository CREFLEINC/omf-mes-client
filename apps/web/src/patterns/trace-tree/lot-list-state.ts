import type { TraceLotPage, TraceLotRow, TraceMatchedBy, TraceStartMatch } from './types';

/**
 * 왼쪽 LOT 목록의 상태(피처 015 data-model §4) — 순수 함수만 둔다.
 *
 * - 최근: 처음 열 때와 [최근 목록으로]. 줄은 최근 목록 API 가 준다(여기에 담지 않는다).
 * - 조건: 공급사·고객 + 기간. 줄은 조건 목록 API 의 쪽들을 차례로 붙인 것이다(`conditionRows`).
 * - 스캔: 번호를 넣거나 스캔했을 때. 최근·조건에서 스캔하면 비우고 넣고, 스캔 상태에서 스캔하면 아래에 쌓는다.
 *   계보의 LOT 번호 누르기·`?lot=` 주소로 들어오기도 스캔과 같다.
 *
 * 고른 LOT 은 주소(`lot`·`serial`)가 갖는다. 스캔이 고를 LOT 을 정하면 `select` 로 돌려주고 부르는 쪽이 주소에 쓴다.
 */

/** 스캔 목록에 둘 수 있는 LOT 수(plan 「설계에서 정한 세부」). 서버 번호 풀기도 한 번호에 200개까지 준다. */
export const SCAN_CAP = 200;

export type ListMode = 'RECENT' | 'CONDITION' | 'SCAN';

/** 조건 — 공급사(자재 기준)·고객(제품 기준) + 기간(공장 날짜, 양 끝 포함). */
export interface ListCondition {
  partnerId: number;
  from: string;
  to: string;
}

/** 어느 번호로 목록에 들어왔는지 — 스캔 줄만 있다. */
export interface EntrySource {
  matchedBy: TraceMatchedBy;
  label: string;
}

export interface ListEntry {
  row: TraceLotRow;
  source: EntrySource | null;
  /** 시리얼로 들어온 줄 — 고르면 역방향 계보 맨 위가 시리얼이다. */
  serialNo: string | null;
}

export interface LotListState {
  mode: ListMode;
  condition: ListCondition | null;
  /** 스캔 상태의 줄. 최근·조건 상태는 비어 있다(줄은 목록 API 가 준다). */
  entries: ListEntry[];
}

export const initialListState: LotListState = { mode: 'RECENT', condition: null, entries: [] };

export const startCondition = (condition: ListCondition): LotListState => ({
  mode: 'CONDITION',
  condition,
  entries: [],
});

/** 최근 목록의 줄 — 들어온 번호가 없다. */
export const recentRows = (rows: readonly TraceLotRow[]): ListEntry[] =>
  rows.map((row) => ({ row, source: null, serialNo: null }));

/** 조건 결과 — 받은 쪽을 차례로 붙인다. 쪽 사이에 같은 LOT 이 다시 오면(그새 바뀐 자료) 한 번만 둔다. */
export const conditionRows = (pages: readonly TraceLotPage[]): ListEntry[] => {
  const seen = new Set<number>();
  const out: ListEntry[] = [];
  for (const page of pages) {
    for (const row of page.items) {
      if (seen.has(row.lot.lotId)) continue;
      seen.add(row.lot.lotId);
      out.push({ row, source: null, serialNo: null });
    }
  }
  return out;
};

/**
 * 스캔 결과 알림.
 * - `added` 새로 더함 · `existing` 이미 있어 고르기만 함 · `notFound` 없는 번호 · `otherDirection` 반대 방향 LOT
 * - `full` 상한(200)에 걸려 넣지 못한 LOT 이 있음 · `truncated` 번호 하나의 LOT 이 200개를 넘어 앞 200개만 받음
 */
export type ScanNotice =
  | { kind: 'added'; added: number; label: string; matchedBy: TraceMatchedBy; selected: boolean }
  | { kind: 'existing'; label: string; matchedBy: TraceMatchedBy }
  | { kind: 'notFound' }
  | { kind: 'otherDirection'; label: string; lotId: number }
  | { kind: 'full'; skipped: number; label: string }
  | { kind: 'truncated'; added: number; label: string };

export interface ScanOutcome {
  state: LotListState;
  /** 고를 줄. 없으면 고른 LOT 을 바꾸지 않는다. */
  select: ListEntry | null;
  notice: ScanNotice;
}

/**
 * 번호 풀기(`trace-starts`) 결과를 목록에 반영한다(data-model §4 「스캔 결과에 따른 동작」).
 *
 * | 결과 | 목록 | 고르기 |
 * | LOT 하나가 새로 들어옴 | 더함 | 그 LOT |
 * | 이미 목록에 있는 LOT 하나 | 그대로 | 그 LOT |
 * | 묶음으로 여럿 | 없는 것만 더함 | 고르지 않음(더해진 것이 하나뿐이면 그 LOT) |
 * | 찾을 수 없음 · 반대 방향 | 그대로 | 그대로 |
 * | 상한 200 넘음 | 넘는 것은 넣지 않음 | 「목록이 가득 찼습니다」 |
 *
 * 같은 번호가 바른 방향 묶음과 반대 방향 묶음에 함께 맞으면 바른 방향 것만 쓴다.
 */
export const applyScan = (
  state: LotListState,
  matches: readonly TraceStartMatch[],
): ScanOutcome => {
  if (matches.length === 0) return { state, select: null, notice: { kind: 'notFound' } };
  const usable = matches.filter((match) => !match.otherDirection);
  if (usable.length === 0) {
    const first = matches[0];
    return {
      state,
      select: null,
      notice: {
        kind: 'otherDirection',
        label: first?.label ?? '',
        lotId: first?.lots[0]?.lot.lotId ?? 0,
      },
    };
  }
  const head = usable[0] as TraceStartMatch;
  const label = head.label;

  /* 들어온 LOT — 번호 묶음 순서대로, 같은 LOT 은 처음 것 하나. */
  const incoming: ListEntry[] = [];
  const incomingIds = new Set<number>();
  for (const match of usable) {
    for (const row of match.lots) {
      if (incomingIds.has(row.lot.lotId)) continue;
      incomingIds.add(row.lot.lotId);
      incoming.push({
        row,
        source: { matchedBy: match.matchedBy, label: match.label },
        serialNo: match.serialNo,
      });
    }
  }
  if (incoming.length === 0) return { state, select: null, notice: { kind: 'notFound' } };

  const base = state.mode === 'SCAN' ? state.entries : [];
  const baseIds = new Set(base.map((entry) => entry.row.lot.lotId));
  const fresh = incoming.filter((entry) => !baseIds.has(entry.row.lot.lotId));
  const room = Math.max(0, SCAN_CAP - base.length);
  const added = fresh.slice(0, room);
  const skipped = fresh.length - added.length;

  /*
   * 이미 있는 줄에 시리얼로 다시 들어오면 시리얼을 단다 — 그 줄을 고르면 계보 맨 위가 시리얼이다.
   * 그 밖에는 있던 줄을 그대로 둔다(목록이 그대로여야 고른 자리가 흔들리지 않는다).
   */
  const serialOf = new Map(
    incoming
      .filter((entry) => entry.serialNo !== null)
      .map((entry) => [entry.row.lot.lotId, entry]),
  );
  const kept =
    serialOf.size === 0
      ? base
      : base.map((entry) => {
          const serial = serialOf.get(entry.row.lot.lotId);
          return serial === undefined
            ? entry
            : { ...entry, source: serial.source, serialNo: serial.serialNo };
        });
  const entries =
    added.length === 0 && kept === base && state.mode === 'SCAN' ? base : [...kept, ...added];
  const next: LotListState = { mode: 'SCAN', condition: null, entries };
  const find = (lotId: number) => entries.find((entry) => entry.row.lot.lotId === lotId) ?? null;

  const only = incoming.length === 1 ? (incoming[0] as ListEntry) : null;
  const select =
    only !== null
      ? find(only.row.lot.lotId)
      : added.length === 1 && skipped === 0
        ? find((added[0] as ListEntry).row.lot.lotId)
        : null;

  const notice: ScanNotice =
    skipped > 0
      ? { kind: 'full', skipped, label }
      : usable.some((match) => match.truncated)
        ? { kind: 'truncated', added: added.length, label }
        : added.length === 0
          ? { kind: 'existing', label, matchedBy: head.matchedBy }
          : {
              kind: 'added',
              added: added.length,
              label,
              matchedBy: head.matchedBy,
              selected: select !== null,
            };
  return { state: next, select, notice };
};

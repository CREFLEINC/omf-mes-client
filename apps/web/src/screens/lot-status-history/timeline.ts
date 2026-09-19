import type { LotHoldEventView, LotStatusEventView } from './types';

/*
 * LOT 이력은 두 곳에 나뉘어 있다(omf-all-around#24).
 *
 * 보류 등록·해제는 보류 사건(`/quality/lot-hold-events`)에만 남고, 합격·불합격 같은 상태
 * 변경은 상태 변경이력(`/trace/lot-status-events`)에만 남는다. 보류가 LOT 상태를 바꾸면
 * 양쪽에 한 줄씩 남는데, 하나는 보류 문서의 사건이고 하나는 상태의 전이라 둘 다 보인다.
 * 어느 한쪽만 부르면 다른 쪽 사건이 통째로 빠지므로 화면이 둘을 시간순으로 합친다.
 */
export type LotTimelineEntry =
  | { kind: 'hold'; key: string; occurredAt: string; lotNo: string; event: LotHoldEventView }
  | { kind: 'status'; key: string; occurredAt: string; lotNo: string; event: LotStatusEventView };

export const holdEntry = (event: LotHoldEventView): LotTimelineEntry => ({
  kind: 'hold',
  key: `hold:${String(event.lotHoldId)}:${event.eventTypeCode}:${event.occurredAt}`,
  occurredAt: event.occurredAt,
  lotNo: event.lotNo,
  event,
});

export const statusEntry = (event: LotStatusEventView): LotTimelineEntry => ({
  kind: 'status',
  key: `status:${String(event.lotStatusHistoryId)}`,
  occurredAt: event.changedAt,
  lotNo: event.lotNo,
  event,
});

/** 같은 종류·같은 시각의 순서 — 서버 정렬(시각 desc, 식별자 desc)과 같게 숫자로 가른다. */
const sameKindOrder = (a: LotTimelineEntry, b: LotTimelineEntry): number => {
  if (a.kind === 'status' && b.kind === 'status') {
    return b.event.lotStatusHistoryId - a.event.lotStatusHistoryId;
  }
  if (a.kind === 'hold' && b.kind === 'hold') {
    const byHold = b.event.lotHoldId - a.event.lotHoldId;
    if (byHold !== 0) return byHold;
    // 한 보류의 해제는 등록 뒤의 일이다 — 위(최신)에 둔다.
    if (a.event.eventTypeCode === b.event.eventTypeCode) return 0;
    return a.event.eventTypeCode === 'RELEASED' ? -1 : 1;
  }
  return 0;
};

/** 최신이 위. 같은 시각이면 보류가 원인이므로 보류 사건을 상태 변경보다 아래(먼저 일어난 쪽)에 둔다. */
export const mergeTimeline = (
  holds: readonly LotHoldEventView[],
  statuses: readonly LotStatusEventView[],
): LotTimelineEntry[] =>
  [...holds.map(holdEntry), ...statuses.map(statusEntry)].sort((a, b) => {
    const diff = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
    if (diff !== 0) return diff;
    if (a.kind !== b.kind) return a.kind === 'status' ? -1 : 1;
    return sameKindOrder(a, b);
  });

export interface StatusEventScope {
  /** 보류 사건 조회와 같은 뜻 — LOT 번호 정확히 일치. 비우면 거르지 않는다. */
  lotNo: string;
  /** 앱 계정 행위자. 보류 사건의 `actorId` 와 같은 축이다. */
  actorId: number | undefined;
}

/**
 * 상태 변경이력 API 는 기간·LOT id·전이 코드만 받는다. 보류 사건 쪽이 서버에서 거르는
 * 행위자·LOT 번호를 여기서 같은 뜻으로 거른다 — 안 거르면 한 표에서 두 줄 종류가 서로 다른
 * 조건으로 뽑힌다.
 */
export const scopeStatusEvents = (
  events: readonly LotStatusEventView[],
  scope: StatusEventScope,
): LotStatusEventView[] =>
  events.filter(
    (event) =>
      (scope.lotNo === '' || event.lotNo === scope.lotNo) &&
      (scope.actorId === undefined || event.changedBy === scope.actorId),
  );

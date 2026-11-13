import { AlertBanner, Dialog, Table, type Column } from '@crefle/web-ui';
import type { InspectionRequestEventForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatQty } from '../../patterns/package-qty';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { useInboundLotRefs, useInspectionEvents, type InboundLotRef } from './inbound-queries';
import { useReinspectionReasons } from './reinspection-reason-field';

const t = messages.iqcInboundLot.history;
const judgmentLabel = messages.partsIqcInspection.judgment as Record<string, string | undefined>;

type Summary = Record<string, unknown>;

const objectOf = (value: unknown): Summary | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Summary) : null;

const numbersOf = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((each): each is number => typeof each === 'number') : [];

/** 자재 관리 LOT 번호는 끝 4자리로 — 서버 이력 한 줄과 같은 줄임(「매칭 0001, 0002」). */
const tailOf = (lotNo: string): string => lotNo.slice(-4);

/** 「내용」을 그리는 데 쓰는 것 — 재검 사유 이름 · 분리 상대 입하 LOT. */
export interface EventDetailContext {
  reasonNameOf: (code: string) => string;
  inboundLotOf: (inboundLotId: number) => InboundLotRef | undefined;
}

/** 결과 요약 한 벌(서버 `resultSummaryWithin`) — 「합격 · 검사 200 · 매칭 0001, 0002 · 재검 사유: …」. */
const resultSummaryText = (summary: Summary, context: EventDetailContext): string => {
  const code = summary.overallJudgmentCode;
  const parts = [
    typeof code === 'string' ? (judgmentLabel[code] ?? code) : t.noJudgment,
    t.inspected(formatQty(typeof summary.inspectedQty === 'number' ? summary.inspectedQty : 0)),
  ];
  const lots = Array.isArray(summary.matchedLotNos)
    ? summary.matchedLotNos.map((lotNo) => tailOf(String(lotNo)))
    : [];
  if (lots.length > 0) parts.push(t.matched(lots));
  const reason = summary.reinspectionReasonCode;
  if (typeof reason === 'string') parts.push(t.reinspectionReason(context.reasonNameOf(reason)));
  return parts.join(' · '); // ui-check-ignore: C-13 서버 이력 「내용」과 같은 「·」 잇기
};

/** 결과 수정 — 「결과 2 수정 — {전} → {후}」(screens/W-01-01 「변경 이력」). 요약이 하나라도 없으면 `null`. */
const resultUpdatedText = (row: InspectionRequestEventForward, context: EventDetailContext) => {
  const before = objectOf(row.summaryBefore);
  const after = objectOf(row.summaryAfter);
  if (before === null || after === null) return null;
  const round = after.inspectionRound ?? before.inspectionRound;
  return t.resultUpdated(
    typeof round === 'number' ? round : null,
    resultSummaryText(before, context),
    resultSummaryText(after, context),
  );
};

/** 분리 — 떠난 쪽 「0003, 0004 → IL-…」, 생긴 쪽 「IL-… 에서 자재 관리 LOT n개」. 상대 번호를 못 읽으면 개수로. */
const splitText = (row: InspectionRequestEventForward, context: EventDetailContext) => {
  const after = objectOf(row.summaryAfter);
  if (after === null) return null;
  const movedLotIds = numbersOf(after.movedLotIds);
  if (row.eventCode === 'SPLIT_OUT') {
    const to =
      typeof after.newInboundLotId === 'number'
        ? context.inboundLotOf(after.newInboundLotId)
        : undefined;
    const lotNos = movedLotIds.flatMap((lotId) => {
      const lotNo = to?.lotNoOf.get(lotId);
      return lotNo === undefined ? [] : [tailOf(lotNo)];
    });
    return t.splitOut(
      lotNos.length === movedLotIds.length && lotNos.length > 0 ? lotNos : null,
      movedLotIds.length,
      to?.inboundLotNo ?? null,
    );
  }
  const from =
    typeof after.fromInboundLotId === 'number'
      ? context.inboundLotOf(after.fromInboundLotId)
      : undefined;
  return t.splitIn(from?.inboundLotNo ?? null, movedLotIds.length);
};

/**
 * 「내용」 칸 — 결과 수정 · 분리는 요약(`summaryBefore` · `summaryAfter`)으로 「전 → 후」 · 출발 · 도착 입하 LOT 을 그리고(T139),
 * 그 밖은 서버가 만든 한 줄, 없으면 사유, 그것도 없으면 「—」(빈 칸 없음 · G2 M4).
 */
export const eventDetailOf = (
  row: InspectionRequestEventForward,
  context: EventDetailContext,
): string => {
  const built =
    row.eventCode === 'RESULT_UPDATED'
      ? resultUpdatedText(row, context)
      : row.eventCode === 'SPLIT_OUT' || row.eventCode === 'SPLIT_IN'
        ? splitText(row, context)
        : null;
  if (built !== null) return built;
  if (row.detail != null && row.detail.trim() !== '') return row.detail;
  if (row.reason != null && row.reason.trim() !== '') return row.reason;
  return '—';
};

/** 분리 줄이 가리키는 상대 입하 LOT id. */
const splitPartnerIdsOf = (rows: readonly InspectionRequestEventForward[]): number[] =>
  rows.flatMap((row) => {
    if (row.eventCode !== 'SPLIT_OUT' && row.eventCode !== 'SPLIT_IN') return [];
    const after = objectOf(row.summaryAfter);
    const id = after?.newInboundLotId ?? after?.fromInboundLotId;
    return typeof id === 'number' ? [id] : [];
  });

/**
 * 변경 이력 — 오른쪽 덮개(520, screens/W-01-01.md 「변경 이력」 · US3-6). 결과 기록 · 수정 · 삭제, 판정 확정 · 취소, 분리를
 * 누가 · 언제 · 무엇을 했는지. 내용은 결과 수정 · 분리만 요약으로 그리고 나머지는 서버가 만든 한 줄을 보인다.
 */
export const InboundHistory = ({
  inspectionRequestId,
  inboundLotNo,
  onClose,
}: {
  inspectionRequestId: number;
  inboundLotNo: string;
  onClose: () => void;
}) => {
  const events = useInspectionEvents(inspectionRequestId);
  const rows = events.data ?? [];
  const reasons = useReinspectionReasons(rows.some((row) => row.eventCode === 'RESULT_UPDATED'));
  const inboundLots = useInboundLotRefs(splitPartnerIdsOf(rows));
  const context: EventDetailContext = {
    reasonNameOf: (code) => reasons.data?.find((each) => each.value === code)?.label ?? code,
    inboundLotOf: (id) => inboundLots.get(id),
  };

  const columns: Column<InspectionRequestEventForward>[] = [
    {
      key: 'when',
      header: t.columns.when,
      render: (row) => formatPlantDateTime(row.occurredAt) ?? row.occurredAt,
    },
    { key: 'who', header: t.columns.who, render: (row) => row.actorName ?? '—' },
    {
      key: 'what',
      header: t.columns.what,
      render: (row) => t.events[row.eventCode] ?? row.eventCode,
    },
    { key: 'detail', header: t.columns.detail, render: (row) => eventDetailOf(row, context) },
  ];

  return (
    <Dialog
      open
      placement="right"
      size="md"
      className="iqc-inbound-history"
      title={t.title(inboundLotNo)}
      onClose={onClose}
    >
      <p className="field-note">{t.help}</p>
      {events.isError ? (
        <AlertBanner variant="error">{t.loadFailed}</AlertBanner>
      ) : events.data === undefined ? null : events.data.length === 0 ? (
        <p className="field-note">{t.empty}</p>
      ) : (
        <Table
          density="compact"
          columns={columns}
          rows={events.data}
          getRowId={(row, index) => `${row.occurredAt}-${String(index)}`}
          aria-label={t.title(inboundLotNo)}
        />
      )}
    </Dialog>
  );
};

import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import type { InspectionRequestEventForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatQty } from '../../patterns/package-qty';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { LIST_PAGE_SIZES } from '../iqc-inspection/filters';
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

/** 판정 수량 칸 — 서버 요약의 합격 · 불합격 · 보류 수량(T142). 0 이거나 없으면 뺀다. */
const JUDGED_QTY_FIELDS = [
  ['acceptedQty', 'ACCEPTED'],
  ['rejectedQty', 'REJECTED'],
  ['heldQty', 'HELD'],
] as const;

/** 결과 요약 한 벌(서버 `resultSummaryWithin`) — 「합격 · 검사 200 · 합격 150 · 불합격 50 · 매칭 0001, 0002 · 재검 사유: …」. */
const resultSummaryText = (summary: Summary, context: EventDetailContext): string => {
  const code = summary.overallJudgmentCode;
  const parts = [
    typeof code === 'string' ? (judgmentLabel[code] ?? code) : t.noJudgment,
    t.inspected(formatQty(typeof summary.inspectedQty === 'number' ? summary.inspectedQty : 0)),
  ];
  for (const [field, judgment] of JUDGED_QTY_FIELDS) {
    const qty = summary[field];
    if (typeof qty === 'number' && qty > 0) {
      parts.push(t.judgedQty(judgmentLabel[judgment] ?? judgment, formatQty(qty)));
    }
  }
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
  if (row.detail != null && row.detail.trim() !== '') return tidyDetail(row.detail);
  if (row.reason != null && row.reason.trim() !== '') return row.reason;
  return '—';
};

/**
 * 서버가 만든 한 줄을 표에 맞게 다듬는다(사용자 시안 2026-11-16 · #274) — 「—」 잇기를 「·」로, 단위 앞 수량에 천 단위 쉼표.
 * 글자만 바꾼다(값은 그대로). 0 으로 시작하는 번호(LOT 끝 마디 등)는 건드리지 않는다.
 */
const tidyDetail = (detail: string): string =>
  detail
    .replaceAll(' — ', ' · ') // ui-check-ignore: C-13 서버 이력 한 줄의 잇기 표기 정리
    .replace(/결과 (\d+)(?!건)/g, '$1회차') // 「결과 n」 → 「n회차」(사용자 지시 2026-11-16)
    .replace(/\b([1-9]\d{3,})(?= [A-Z]{1,4}\b)/g, (qty) => formatQty(Number(qty)));

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
}: {
  inspectionRequestId: number;
  inboundLotNo: string;
}) => {
  const events = useInspectionEvents(inspectionRequestId);
  const rows = events.data ?? [];
  /* 쪽 넘김 — 목록 화면과 같은 아래 줄(사용자 지시 2026-11-16 · #274). 이력은 한 번에 다 받으므로 화면에서 자른다. */
  const [paging, setPaging] = useState<{ page: number; size: (typeof LIST_PAGE_SIZES)[number] }>({
    page: 1,
    size: 20,
  });
  const pageRows = rows.slice((paging.page - 1) * paging.size, paging.page * paging.size);
  const reasons = useReinspectionReasons(rows.some((row) => row.eventCode === 'RESULT_UPDATED'));
  const inboundLots = useInboundLotRefs(splitPartnerIdsOf(rows));
  const context: EventDetailContext = {
    reasonNameOf: (code) => reasons.data?.find((each) => each.value === code)?.label ?? code,
    inboundLotOf: (id) => inboundLots.get(id),
  };

  /* 작업 유형 · 상세 내용 · 작업자 · 일시 순(사용자 지시 2026-11-16 · #274). */
  const columns: Column<InspectionRequestEventForward>[] = [
    {
      key: 'what',
      align: 'center',
      header: t.columns.what,
      render: (row) => t.events[row.eventCode] ?? row.eventCode,
    },
    {
      key: 'detail',
      align: 'center',
      header: t.columns.detail,
      render: (row) => eventDetailOf(row, context),
    },
    { key: 'who', align: 'center', header: t.columns.who, render: (row) => row.actorName ?? '—' },
    {
      key: 'when',
      align: 'center',
      header: t.columns.when,
      render: (row) => formatPlantDateTime(row.occurredAt) ?? row.occurredAt,
    },
  ];

  return (
    /* 「변경 이력」 탭 본문(사용자 지시 2026-11-16 · omf-all-around#274) — 종전에는 오른쪽 창으로 떴다. */
    <div className="iqc-inbound-history">
      {events.isError ? (
        <AlertBanner variant="error">{t.loadFailed}</AlertBanner>
      ) : events.data === undefined ? null : events.data.length === 0 ? (
        <p className="field-note">{t.empty}</p>
      ) : (
        <>
          <Table
            density="compact"
            columns={columns}
            rows={pageRows}
            getRowId={(row, index) => `${row.occurredAt}-${String(index)}`}
            aria-label={t.title(inboundLotNo)}
          />
          <PageNav
            meta={{ page: paging.page, size: paging.size, total: rows.length }}
            sizes={LIST_PAGE_SIZES}
            buttonSize="md"
            onChangePage={(page) => setPaging((now) => ({ ...now, page }))}
            onChangeSize={(size) => setPaging({ page: 1, size })}
          />
        </>
      )}
    </div>
  );
};

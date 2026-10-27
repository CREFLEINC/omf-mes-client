import { Chip, EmptyState, Icon, IconButton, Table, type Column } from '@crefle/web-ui';
import type { InspectionHistory, InspectionHistoryEvent } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useFitColumns } from '../../patterns/column-fit';
import { useClientPage } from '../../patterns/client-page';
import { useColumnOrder } from '../../patterns/column-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { FilterChips } from '../../patterns/filter-chips';
import { PageNav } from '../../patterns/page-nav';
import { runRequest } from '../../patterns/request';

const t = messages.inspectionHistory;

/** 검사 이력 조회 열쇠 — 회차를 저장한 화면이 이 뿌리로 다시 부를 수 있게 내보낸다. */
export const inspectionHistoryKeys = {
  all: ['inspection-history'] as const,
  one: (inspectionRequestId: number) => ['inspection-history', inspectionRequestId] as const,
};

const formatAt = (iso: string): string => {
  const at = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

/**
 * 한 줄의 설명 — 무엇이 일어났는지는 제목이, 무엇이 바뀌었는지는 이 줄이 말한다.
 * 판정은 부르는 화면이 준 이름으로 보인다 — 주지 않았거나 모르는 코드는 코드 그대로다(지어내지 않는다).
 */
export const detailLines = (
  event: InspectionHistoryEvent,
  judgmentLabelOf: (code: string) => string = (code) => code,
): string[] => {
  const parts: string[] = [];
  if (event.inspectionRound !== undefined) parts.push(t.round(event.inspectionRound));
  if (event.overallJudgmentCode !== undefined) {
    parts.push(t.judgment(judgmentLabelOf(event.overallJudgmentCode)));
  }
  if (event.eventTypeCode !== 'LOT_STATUS_CHANGED' && event.acceptedQty !== undefined) {
    parts.push(t.quantities(event.acceptedQty, event.rejectedQty ?? 0, event.heldQty ?? 0));
  }
  if (event.eventTypeCode === 'LOT_STATUS_CHANGED' && event.newStatusCode !== undefined) {
    parts.push(
      t.lotStatus(event.lotNo ?? '', event.previousStatusCode ?? t.empty, event.newStatusCode),
    );
  }
  if (event.actorName !== undefined) parts.push(t.by(event.actorName));
  return parts;
};

/**
 * 검사 이력 조회 — 구획과, 구획을 접는 줄의 건수(IQC · #133)가 같은 열쇠로 한 번만 부른다.
 * 의뢰가 없으면 부르지 않는다.
 */
export const useInspectionHistory = (inspectionRequestId: number | null, revision = '') => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...inspectionHistoryKeys.one(inspectionRequestId ?? 0), revision],
    enabled: inspectionRequestId !== null,
    queryFn: (): Promise<InspectionHistory> =>
      runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}/history', {
          params: { path: { inspectionRequestId: inspectionRequestId ?? 0 } },
        }),
      ),
  });
};

export interface InspectionHistoryPanelProps {
  inspectionRequestId: number;
  /**
   * 회차가 바뀐 표식(저장·확정·재검사) — 바뀌면 이력을 새로 부른다. 회차 «개수»만 보면 확정이나 같은 회차의
   * 재저장이 이력에 뜨지 않는다.
   */
  revision?: string;
  /** 종합 판정 코드 → 화면 이름. 부르는 화면이 이미 가진 선택지로 준다. */
  judgmentLabelOf?: (code: string) => string;
  /** 대상 LOT 을 감춘다 — 위에 같은 LOT 이 이미 보이는 자리(IQC 상세 · #133). */
  hideSourceLot?: boolean;
  /** 표 모양(회차 · 검사 일시 · 검사자 · 판정 · 구분 · 비고 · #185). 기본은 시간순 목록이다(OQC 상세). */
  layout?: 'list' | 'table';
  /** 넘칠 때 줄이지 않고 표 안에서 가로로 구른다(좌우 배치 · 사용자 지시 2026-10-27 · #185). */
  scrollX?: boolean;
  /** 10 · 20 · 50건씩 쪽으로 나눈다(IQC 상세 탭 · 사용자 지시 2026-10-27 · #185). */
  paged?: boolean;
}

const JUDGMENT_TONE: Record<string, 'success' | 'error' | 'warning'> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
};

/** 비고 칸 — 수량(결과 저장 · 확정) 또는 LOT 상태 변경. 회차 · 판정 · 처리자는 제 칸이 있어 넣지 않는다. */
const noteOf = (event: InspectionHistoryEvent): string => {
  if (event.eventTypeCode === 'LOT_STATUS_CHANGED' && event.newStatusCode !== undefined)
    return t.lotStatus(event.lotNo ?? '', event.previousStatusCode ?? t.empty, event.newStatusCode);
  if (event.acceptedQty !== undefined)
    return t.quantities(event.acceptedQty, event.rejectedQty ?? 0, event.heldQty ?? 0);
  return t.empty;
};

/**
 * 검사 이력 표 — 목록 표처럼 열 순서 · 폭을 바꾸고 브라우저에 남긴다(사용자 지시 2026-10-26 · #185). 상자 폭에 맞춘다.
 * 회차 · 검사 일시 · 검사자 · 판정 · 구분은 가운데, 비고는 왼쪽.
 */
const HistoryTable = ({
  events,
  judgmentLabelOf,
  scrollX,
  paged,
}: {
  events: readonly InspectionHistoryEvent[];
  judgmentLabelOf: (code: string) => string;
  scrollX: boolean;
  paged: boolean;
}) => {
  const columns: Column<InspectionHistoryEvent & { key: string }>[] = [
    {
      key: 'round',
      header: t.columns.round,
      width: '80px',
      align: 'center',
      render: (row) => (row.inspectionRound === undefined ? t.empty : t.round(row.inspectionRound)),
    },
    {
      key: 'at',
      header: t.columns.at,
      width: '150px',
      align: 'center',
      /* 오름 · 내림차순(사용자 지시 2026-10-27 · #185). */
      sortable: true,
      sortAccessor: (row) => row.occurredAt,
      render: (row) => formatAt(row.occurredAt),
    },
    {
      key: 'actor',
      header: t.columns.actor,
      width: '110px',
      align: 'center',
      render: (row) => row.actorName ?? t.empty,
    },
    {
      key: 'judgment',
      header: t.columns.judgment,
      width: '90px',
      align: 'center',
      /* 판정은 상태 칩(합격 초록 · 불합격 빨강 · 보류 노랑 · 사용자 지시 2026-10-26). */
      render: (row) =>
        row.overallJudgmentCode === undefined ? (
          t.empty
        ) : (
          <Chip
            variant="status"
            size="sm"
            status={JUDGMENT_TONE[row.overallJudgmentCode] ?? 'idle'}
          >
            {judgmentLabelOf(row.overallJudgmentCode)}
          </Chip>
        ),
    },
    {
      key: 'event',
      header: t.columns.event,
      width: '130px',
      align: 'center',
      render: (row) => t.events[row.eventTypeCode],
    },
    { key: 'note', header: t.columns.note, width: '240px', render: noteOf },
  ];
  const ordered = useColumnOrder('omf-mes:inspection-history:columns:order', columns);
  const resizable = useColumnWidths('omf-mes:inspection-history:columns', ordered, {
    fitContent: scrollX,
  });
  const fit = useFitColumns(resizable.columns, { scrollX });
  const keyed = events.map((event, index) => ({
    ...event,
    key: `${event.eventTypeCode}-${event.occurredAt}-${String(index)}`,
  }));
  /* 판정으로 거른다(IQC 상세 · 사용자 지시 2026-10-27 · #185) — 판정이 없는 사건(전달 · LOT 상태 변경)은 「전체」에서만 보인다. */
  const [judgmentFilter, setJudgmentFilter] = useState<string | null>(null);
  const paging = useClientPage(
    judgmentFilter === null
      ? keyed
      : keyed.filter((row) => row.overallJudgmentCode === judgmentFilter),
    { at: (row) => row.occurredAt },
  );

  return (
    <>
      {paged && (
        <FilterChips
          label={t.filterLabel}
          options={[
            { value: null, label: t.filterAll },
            ...Object.keys(JUDGMENT_TONE).map((code) => ({
              value: code,
              label: judgmentLabelOf(code),
            })),
          ]}
          value={judgmentFilter}
          countOf={(code) =>
            code === null
              ? keyed.length
              : keyed.filter((row) => row.overallJudgmentCode === code).length
          }
          onChange={setJudgmentFilter}
        />
      )}
      <div ref={fit.ref} className="inspection-queue-table" style={resizable.style}>
        <Table
          caption={<span className="iqc-inspection-table-caption">{t.heading}</span>}
          density="compact"
          columns={fit.columns}
          rows={paged ? paging.rows : keyed}
          {...(paged ? { sort: paging.sort, onSortChange: paging.onSortChange } : {})}
          getRowId={(row) => row.key}
          empty={
            <EmptyState
              size="sm"
              icon={<Icon name="history_toggle_off" size={32} />}
              title={t.emptyTitle}
              description={t.emptyHint}
            />
          }
        />
      </div>
      {paged && paging.nav !== null && <PageNav {...paging.nav} />}
    </>
  );
};

/**
 * 검사 대상 이력(omf-all-around#61 · 서버 선행 P-55) — IQC(W-01-01)·PQC(W-03-11)·OQC(W-04-03) 상세가 함께 쓴다.
 *
 * ⭐ 앞 단계가 넘긴 문서(입하·작업지시·출하 지시 번호)와, 전달 → 회차 저장·확정 → LOT 상태 변경을 시간순으로 보인다.
 * ⛔ 읽기 전용이다. 같은 LOT 의 다른 일(보류·처분)은 LOT 현황 화면의 몫이라 담지 않는다.
 */
export const InspectionHistoryPanel = ({
  inspectionRequestId,
  revision = '',
  judgmentLabelOf,
  hideSourceLot = false,
  layout = 'list',
  scrollX = false,
  paged = false,
}: InspectionHistoryPanelProps) => {
  const detailOf = (event: InspectionHistoryEvent): string[] => detailLines(event, judgmentLabelOf);
  const history = useInspectionHistory(inspectionRequestId, revision);

  return (
    <section aria-label={t.heading} className="inspection-history">
      <h3>{t.heading}</h3>
      {history.isError ? (
        <p className="field-note">{t.loadFailed}</p>
      ) : history.data === undefined ? (
        <p className="field-note">{t.loading}</p>
      ) : (
        <>
          {layout === 'table' ? (
            /*
             * 전달 문서 줄(사용자 지시 2026-10-26 · #185) — 문서 아이콘 · 이름 · 번호 · 복사 단추를 한 줄 상자로.
             */
            <div className="inspection-history-source-bar">
              <Icon name="description" size={20} aria-hidden />
              <span className="inspection-history-source-label">{t.source}</span>
              <span className="inspection-history-source-value">
                {history.data.source.documentNo ?? t.empty}
              </span>
              {history.data.source.documentNo != null && (
                <IconButton
                  icon="content_copy"
                  size="sm"
                  aria-label={t.copySource}
                  title={t.copySource}
                  onClick={() => {
                    void navigator.clipboard?.writeText(history.data.source.documentNo ?? '');
                  }}
                />
              )}
            </div>
          ) : (
            <dl className="filter-bar">
              <div className="field-cell">
                <dt className="field-label">{t.source}</dt>
                <dd>{history.data.source.documentNo ?? t.empty}</dd>
              </div>
              {!hideSourceLot && (
                <div className="field-cell">
                  <dt className="field-label">{t.sourceLot}</dt>
                  <dd>{history.data.source.lotNo ?? t.empty}</dd>
                </div>
              )}
            </dl>
          )}
          {layout === 'table' ? (
            <HistoryTable
              events={history.data.events}
              judgmentLabelOf={judgmentLabelOf ?? ((code) => code)}
              scrollX={scrollX}
              paged={paged}
            />
          ) : (
            <ol className="inspection-history-events">
              {history.data.events.map((event, index) => (
                <li
                  key={`${event.eventTypeCode}-${event.occurredAt}-${String(index)}`}
                  data-event={event.eventTypeCode}
                >
                  {/* 일시 · 작업 · 처리 결과를 각각 한 칸에 — 줄끼리 세로로 맞춰 읽힌다(app.css). */}
                  <span className="inspection-history-at">{formatAt(event.occurredAt)}</span>
                  <span className="field-label">{t.events[event.eventTypeCode]}</span>
                  {detailOf(event).length > 0 && (
                    <span className="field-note">{detailOf(event).join(' · ')}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
};

import { Chip, type ChipStatus, type Column, type SortState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import type { FilterOption } from './lot-filter-bar';
import { codeName, useLotHoldReasonOptions, type LotCodeOption } from './options';
import type { LotTimelineEntry } from './timeline';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav, type PageSize } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string): string => formatPlantDateTime(value) ?? value;

const eventLabel = (entry: LotTimelineEntry): string => {
  if (entry.kind === 'status') return t.history.events.statusChanged;
  return entry.event.eventTypeCode === 'HELD' ? t.history.events.held : t.history.events.released;
};

const statusLabel = (options: readonly FilterOption[], code: string): string =>
  options.find((option) => option.value === code)?.label ?? t.values.unlisted(code);

const reasonText = (
  entry: LotTimelineEntry,
  reasons: readonly LotCodeOption[] | undefined,
): string => {
  if (entry.kind === 'hold') {
    return entry.event.reasonCode === null ? EMPTY : codeName(reasons, entry.event.reasonCode);
  }
  const transition = t.history.transitions[entry.event.transitionCode];
  return entry.event.reason === null ? transition : `${transition} · ${entry.event.reason}`;
};

/*
 * LOT 상세 창에서만 구분 칩에 옅은 색을 준다 — 상태 변경·보류 등록·보류 해제를 한눈에 가른다
 * (사용자 지시 2026-09-19 · 「이력으로 찾기」 표는 그대로 둔다). 해제는 끝난 일이라 색을 빼 둔다.
 */
const eventTone = (entry: LotTimelineEntry): ChipStatus => {
  if (entry.kind === 'status') return 'info';
  return entry.event.eventTypeCode === 'HELD' ? 'warning' : 'idle';
};

interface LotTimelineTableProps {
  caption: string;
  entries: readonly LotTimelineEntry[];
  statusOptions: readonly FilterOption[];
  /** 앱 계정 id 로 이름을 푼다. 못 풀면 null. */
  appUserName: (appUserId: number) => string | null;
  /**
   * history — 「이력으로 찾기」: 여러 LOT 을 담아 LOT 열이 있다.
   * detail — LOT 상세 창: 한 LOT 이라 LOT 열을 빼고, 열 폭·칩 색·행 높이를 창에 맞춘다.
   */
  variant: 'history' | 'detail';
  empty: ReactNode;
  /** 다시 받는 중 — 표 상자에 `aria-busy` 로 싣는다. */
  busy?: boolean;
}

export const LotTimelineTable = ({
  caption,
  entries,
  statusOptions,
  appUserName,
  variant,
  empty,
  busy = false,
}: LotTimelineTableProps) => {
  const reasons = useLotHoldReasonOptions();
  const isDetail = variant === 'detail';
  /*
   * LOT 상세에서는 처리 일시로 오름·내림차순을 고른다(사용자 2026-10-30). 받은 줄은 이미 최신순이라 오름차순은
   * 뒤집기만 한다 — 같은 시각의 줄 순서도 그대로 거꾸로 선다. 머리를 누를 때마다 두 순서를 오간다
   * (표 부품은 내림차순 다음에 정렬 해제를 주므로 그것을 오름차순으로 받는다).
   */
  const [sort, setSort] = useState<SortState>({ key: 'occurredAt', direction: 'descending' });
  const rows = isDetail && sort.direction === 'ascending' ? [...entries].reverse() : [...entries];
  /* LOT 상세 탭에서는 화면이 쪽을 나눈다 — 받은 이력을 한 번에 다 갖고 있다(사용자 2026-10-30). */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const actorName = (entry: LotTimelineEntry): string => {
    if (entry.kind === 'hold') return entry.event.actorName?.trim() || t.history.actorUnknown;
    const id = entry.event.changedBy;
    return (id === null ? null : appUserName(id)) ?? t.history.actorUnknown;
  };
  const changeText = (entry: LotTimelineEntry): ReactNode => {
    if (entry.kind === 'hold') return EMPTY;
    const text = `${
      entry.event.fromStatusCode === null
        ? t.history.initialStatus
        : statusLabel(statusOptions, entry.event.fromStatusCode)
    } → ${statusLabel(statusOptions, entry.event.toStatusCode)}`;
    // LOT 상세에서는 이 표에서 가장 먼저 읽을 값이라 굵기로 세운다(app.css .lot-timeline-change).
    return isDetail ? <span className="lot-timeline-change">{text}</span> : text;
  };
  // ⭐ 표 머리와 모든 열 가운데 정렬(사용자 지시 2026-09-19). 열 폭은 LOT 상세에서 값 길이대로 다시 준다.
  const columns: Column<LotTimelineEntry>[] = [
    {
      key: 'occurredAt',
      header: isDetail ? t.timeline.columns.occurredAt : t.history.columns.occurredAt,
      align: 'center',
      width: isDetail ? '172px' : '220px',
      sortable: isDetail,
      render: (entry) => formatDateTime(entry.occurredAt),
    },
    ...(isDetail
      ? []
      : [
          {
            key: 'lotNo',
            header: t.history.columns.lot,
            align: 'center' as const,
            render: (entry: LotTimelineEntry) => entry.lotNo,
          },
        ]),
    {
      key: 'event',
      header: isDetail ? t.timeline.columns.event : t.history.columns.event,
      align: 'center',
      width: isDetail ? '104px' : '120px',
      render: (entry) =>
        isDetail ? (
          <Chip variant="status" status={eventTone(entry)} size="sm">
            {eventLabel(entry)}
          </Chip>
        ) : (
          <Chip variant="status" size="sm">
            {eventLabel(entry)}
          </Chip>
        ),
    },
    {
      key: 'change',
      header: isDetail ? t.timeline.columns.change : t.history.columns.change,
      align: 'center',
      render: changeText,
    },
    {
      key: 'actor',
      header: isDetail ? t.timeline.columns.actor : t.history.columns.actor,
      align: 'center',
      width: isDetail ? '140px' : undefined,
      render: actorName,
    },
    {
      key: 'reason',
      header: isDetail ? t.timeline.columns.reason : t.history.columns.reason,
      align: 'center',
      width: isDetail ? '160px' : '224px',
      render: (entry) => reasonText(entry, reasons.data?.items),
    },
  ];

  /* 열 너비 끌기 · 열 순서 바꾸기 — LOT 목록 표와 같다(사용자 2026-10-30). 두 표는 너비·순서를 따로 기억한다. */
  const storageKey = isDetail
    ? 'omf-mes:lot-status:columns:timeline'
    : 'omf-mes:lot-status:columns:history';
  const ordered = useColumnOrder(`${storageKey}:order`, columns);
  const resizable = useColumnWidths(storageKey, ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  if (!isDetail) {
    return (
      <div
        ref={fit.ref}
        className="wide-table lot-status-table"
        style={resizable.style}
        aria-busy={busy}
      >
        <Table
          density="compact"
          caption={caption}
          columns={fit.columns}
          rows={rows}
          getRowId={(entry) => entry.key}
          empty={empty}
        />
      </div>
    );
  }

  const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
  const shownPage = Math.min(page, lastPage);
  return (
    <>
      <div
        ref={fit.ref}
        className="wide-table lot-status-table lot-detail-table"
        style={resizable.style}
      >
        <Table
          density="comfortable"
          caption={caption}
          columns={fit.columns}
          rows={rows.slice((shownPage - 1) * pageSize, shownPage * pageSize)}
          getRowId={(entry) => entry.key}
          empty={empty}
          sort={sort}
          onSortChange={(next: SortState | null) => {
            setSort(next ?? { key: 'occurredAt', direction: 'ascending' });
            setPage(1);
          }}
        />
      </div>
      <PageNav
        controlSize="sm"
        buttonSize="md"
        meta={{ page: shownPage, size: pageSize, total: rows.length }}
        onChangePage={setPage}
        onChangeSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </>
  );
};

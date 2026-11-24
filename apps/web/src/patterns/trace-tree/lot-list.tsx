import {
  AlertBanner,
  Button,
  Chip,
  EmptyState,
  Icon,
  SkeletonText,
  type Column,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnWidths } from '../column-resize';
import { SelectableTable } from '../selectable-table';
import { SCAN_CAP, type ListEntry, type ListMode } from './lot-list-state';
import { TraceLotNo, lotStatusTone, shortDateTime } from './cells';
import type { TraceDirection } from './types';

const t = messages.traceTree;

export interface TraceLotListProps {
  direction: TraceDirection;
  mode: ListMode;
  entries: readonly ListEntry[];
  selectedLotId: number | null;
  onSelect: (entry: ListEntry) => void;
  /** 목록을 받는 중(처음) · 실패. 스캔 목록은 늘 `ready`. */
  status: 'loading' | 'error' | 'ready';
  error?: ReactNode;
  /** 조건 상태 — 제목에 상대 · 기간, 「n개 중 m개」, [더 보기]. */
  condition?: {
    partnerLabel: string;
    from: string;
    to: string;
    total: number;
    hasMore: boolean;
    loadingMore: boolean;
    onMore: () => void;
  };
  statusName: (code: string) => string;
}

/**
 * 왼쪽 LOT 목록(FR-025) — 줄 전체를 눌러 고른다(C-1). 고른 줄은 오른쪽에 계보가 선다.
 * 칸: LOT 번호 · (스캔 목록이면) 스캔 번호 · 품목명 · 공급사명 또는 고객명 · 기준일 · 상태.
 * 자재 기준의 날짜는 최근 목록이면 마지막 투입, 조건이면 입하일. 제품 기준은 LOT 마다 출하일 또는 입고일 하나라
 * 날짜 앞에 그 종류(「출하」·「입고」)를 둔다.
 */
export const TraceLotList = ({
  direction,
  mode,
  entries,
  selectedLotId,
  onSelect,
  status,
  error,
  condition,
  statusName,
}: TraceLotListProps) => {
  const words = direction === 'FORWARD' ? t.material : t.product;
  const columns: Column<ListEntry>[] = [
    {
      key: 'lotNo',
      header: t.list.columns.lotNo,
      width: '220px',
      render: (entry) => <TraceLotNo lotNo={entry.row.lot.lotNo} />,
    },
    ...(mode === 'SCAN'
      ? [
          {
            key: 'source',
            header: t.list.columns.source,
            width: '180px',
            render: (entry: ListEntry) =>
              entry.source === null ? (
                ''
              ) : (
                <span
                  className="ellipsis-cell trace-tree-source"
                  title={`${t.matchedBy[entry.source.matchedBy]} ${entry.source.label}`}
                >
                  {`${t.matchedBy[entry.source.matchedBy]} ${entry.source.label}`}
                </span>
              ),
          },
        ]
      : []),
    {
      key: 'item',
      header: t.list.columns.itemName,
      width: '160px',
      render: (entry) => (
        <span className="ellipsis-cell" title={named(entry.row.item.name, entry.row.item.code)}>
          {entry.row.item.name}
        </span>
      ),
    },
    {
      key: 'partner',
      header: words.partnerName,
      width: '140px',
      render: (entry) =>
        entry.row.partner === null ? (
          ''
        ) : (
          <span
            className="ellipsis-cell"
            title={named(entry.row.partner.name, entry.row.partner.code)}
          >
            {entry.row.partner.name}
          </span>
        ),
    },
    {
      key: 'date',
      header: mode === 'CONDITION' ? words.conditionDate : words.recentDate,
      width: '150px',
      render: (entry) => {
        const kind = entry.row.sortDateKind;
        if (entry.row.sortDate === null) return '';
        return (
          <span className="trace-tree-date">
            {direction === 'BACKWARD' && kind !== null && (
              <span className="trace-tree-date-kind" data-kind={kind}>
                {t.list.sortKinds[kind]}
              </span>
            )}
            {shortDateTime(entry.row.sortDate, kind === 'INBOUND')}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: t.list.columns.status,
      width: '84px',
      render: (entry) => (
        <Chip variant="status" size="sm" status={lotStatusTone(entry.row.lot.statusCode)}>
          {statusName(entry.row.lot.statusCode)}
        </Chip>
      ),
    },
  ];
  const resizable = useColumnWidths(`omf-mes:trace-tree:list:${direction}:${mode}`, columns, {
    fitContent: true,
  });

  const title =
    mode === 'SCAN'
      ? t.list.scanTitle
      : mode === 'CONDITION' && condition !== undefined
        ? t.list.conditionTitle(condition.partnerLabel, condition.from, condition.to)
        : t.list.recentTitle;
  const count =
    mode === 'SCAN'
      ? t.list.scanCount(entries.length, SCAN_CAP)
      : mode === 'CONDITION' && condition !== undefined && condition.total > entries.length
        ? t.list.ofTotal(entries.length, condition.total)
        : t.list.count(entries.length);

  const foot =
    mode === 'SCAN'
      ? t.list.scanFoot
      : mode === 'CONDITION'
        ? words.conditionFoot
        : words.recentFoot;

  return (
    <>
      <div className="trace-tree-list-head">
        <h2 className="pane-title" title={title}>
          {title}
        </h2>
        {status === 'ready' && (
          <Chip variant="status" size="sm" status="idle">
            {count}
          </Chip>
        )}
      </div>
      {status === 'loading' ? (
        <div role="status" aria-label={t.list.loading}>
          <SkeletonText lines={5} />
        </div>
      ) : status === 'error' ? (
        error
      ) : (
        <>
          <div className="trace-tree-list-rows inspection-queue-table" style={resizable.style}>
            <SelectableTable
              className="trace-tree-list-table"
              caption={<span className="visually-hidden">{t.list.caption}</span>}
              columns={resizable.columns}
              rows={[...entries]}
              getRowId={(entry) => String(entry.row.lot.lotId)}
              activeId={selectedLotId === null ? null : String(selectedLotId)}
              rowLabel={(entry) => t.list.openRow(entry.row.lot.lotNo)}
              onActivate={onSelect}
              empty={
                <EmptyState
                  size="sm"
                  icon={<Icon name="search_off" size={24} />}
                  title={mode === 'CONDITION' ? t.list.emptyCondition : t.list.emptyRecent}
                  description={mode === 'CONDITION' ? words.conditionEmptyHint : undefined}
                />
              }
            />
          </div>
          {mode === 'CONDITION' && condition?.hasMore === true && (
            <div className="trace-tree-list-more">
              <Button
                variant="outlined"
                size="sm"
                leadingIcon={<Icon name="expand_more" size={18} />}
                loading={condition.loadingMore}
                disabled={condition.loadingMore}
                onClick={condition.onMore}
              >
                {t.list.more(condition.total - entries.length)}
              </Button>
            </div>
          )}
          <p className="field-note trace-tree-list-foot">{foot}</p>
        </>
      )}
    </>
  );
};

/** 목록 실패 — 다시 시도. */
export const TraceListFailure = ({ onRetry }: { onRetry: () => void }) => (
  <AlertBanner
    variant="error"
    title={t.list.loadFailed}
    action={
      <Button size="sm" variant="outlined" onClick={onRetry}>
        {messages.common.retry}
      </Button>
    }
  >
    {t.list.loadFailedDescription}
  </AlertBanner>
);

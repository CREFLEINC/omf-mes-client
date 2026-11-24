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
import { PaneListHead, type PaneCollapse } from '../po-board';
import { ApiRequestError } from '../request';
import { LIST_PAGE_SIZE } from './queries';
import { SelectableTable } from '../selectable-table';
import { SCAN_CAP, type ListEntry, type ListMode } from './lot-list-state';
import { TraceLotCell, lotStatusTone, shortDateTime } from './cells';
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
  /** 목록 접기(제목 줄의 [목록 접기]). */
  collapse: PaneCollapse;
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
  collapse,
}: TraceLotListProps) => {
  const words = direction === 'FORWARD' ? t.material : t.product;
  const columns: Column<ListEntry>[] = [
    {
      key: 'lot',
      header: t.list.columns.lotItem,
      render: (entry) => {
        const partner = entry.row.partner;
        return (
          <TraceLotCell
            lotNo={entry.row.lot.lotNo}
            source={
              entry.source === null
                ? null
                : `${t.matchedBy[entry.source.matchedBy]} ${entry.source.label}`
            }
            sub={[entry.row.item.name, partner?.name ?? '']
              .filter((part) => part !== '')
              .join(', ')}
            subTitle={[
              named(entry.row.item.name, entry.row.item.code),
              partner === null ? '' : named(partner.name, partner.code),
            ]
              .filter((part) => part !== '')
              .join(', ')}
          />
        );
      },
    },
    {
      key: 'date',
      header: mode === 'CONDITION' ? words.conditionDate : words.recentDate,
      width: direction === 'BACKWARD' ? '152px' : '112px',
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
      <PaneListHead title="" collapse={collapse} className="trace-tree-list-head">
        {/* 조건 목록의 제목(상대 · 기간)은 길 수 있어 줄을 접어 다 보이고, 전체는 마우스를 올려도 보인다. */}
        <h2 className="pane-title trace-tree-list-title" title={title}>
          {title}
        </h2>
        {status === 'ready' && (
          <Chip variant="status" size="sm" status="idle">
            {count}
          </Chip>
        )}
      </PaneListHead>
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
                {t.list.more(
                  Math.min(LIST_PAGE_SIZE, condition.total - entries.length),
                  condition.total - entries.length,
                )}
              </Button>
            </div>
          )}
          <p className="field-note trace-tree-list-foot">{foot}</p>
        </>
      )}
    </>
  );
};

/** 목록 실패 — 권한 없음(403)은 권한 안내(다시 시도 없음), 그 밖은 다시 시도. */
export const TraceListFailure = ({
  error,
  direction,
  onRetry,
}: {
  error: unknown;
  direction: TraceDirection;
  onRetry: () => void;
}) =>
  error instanceof ApiRequestError && error.httpStatus === 403 ? (
    <AlertBanner variant="warning" title={t.detail.forbiddenTitle}>
      {(direction === 'FORWARD' ? t.material : t.product).forbidden}
    </AlertBanner>
  ) : (
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

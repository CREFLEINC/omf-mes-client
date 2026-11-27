import { Chip, EmptyState, Skeleton, type Column, type SortState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ManagedTable } from '../../patterns/managed-table';

import { LoadErrorBanner } from './load-error-banner';
import { formatMoment, type AckListResult, type AckState, type AckView } from './types';

const t = messages.notice;

const STATE_LABEL: Record<AckState, string> = {
  done: t.ack.done,
  opened: t.ack.opened,
  pending: t.ack.pending,
};

const STATE_TONE: Record<AckState, 'success' | 'warning' | 'idle'> = {
  done: 'success',
  opened: 'warning',
  pending: 'idle',
};

export interface AckPanelProps {
  /** 확인을 요구한 공지인가. 아니면 목록 자체를 열지 않는다. */
  required: boolean;
  /** 상태 라벨로 고른 상태(#361). 비면 전체. */
  stateFilter: AckState | null;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: AckListResult | undefined;
  onRetry: () => void;
}

/**
 * 확인 현황.
 *
 * ⭐ **확인을 요구하지 않은 공지에는 이 목록이 뜻이 없다** — 빈 목록을 그리면 「아무도 확인하지
 * 않았다」로 읽힌다. 그럴 때는 목록 대신 그 사실을 적는다.
 *
 * ⭐ **세 갈래를 같은 모양으로 그리지 않는다** — 확인 · 열람(미확인) · 미확인. 「닫기」로 남은
 * 행에도 시각이 찍히므로 시각 유무만으로는 가를 수 없고, 독촉할 대상이 갈린다.
 */
export const AckPanel = ({
  required,
  stateFilter,
  isPending,
  isError,
  error,
  data,
  onRetry,
}: AckPanelProps) => {
  const [sort, setSort] = useState<SortState | null>(null);

  if (!required) {
    return <p className="pane-lead">{t.ack.notRequired}</p>;
  }

  const columns: Column<AckView>[] = [
    { key: 'who', header: t.ack.who, align: 'center', render: (row) => row.who },
    {
      key: 'state',
      header: t.ack.state,
      align: 'center',
      render: (row) => (
        <Chip size="sm" status={STATE_TONE[row.state]}>
          {STATE_LABEL[row.state]}
        </Chip>
      ),
    },
    {
      key: 'at',
      header: t.ack.at,
      align: 'center',
      /* 확인 일시 오름 · 내림차순(#361). 시각이 없는 행은 늘 뒤에 둔다. */
      sortable: true,
      render: (row) => (row.at === null ? t.ack.notAvailable : formatMoment(row.at)),
    },
  ];

  return (
    <>
      {isError ? (
        <LoadErrorBanner error={error} onRetry={onRetry} />
      ) : isPending ? (
        <Skeleton variant="rect" height="8rem" />
      ) : (
        /* 열 폭 끌기 · 순서 바꾸기(#361) — 다른 목록과 같은 공용 표. */
        <ManagedTable
          storageKey="omf-mes:notice:ack"
          className="notice-ack-table"
          scrollX
          caption={t.ack.title}
          columns={columns}
          rows={sortByAt(
            (data?.items ?? []).filter((row) => stateFilter === null || row.state === stateFilter),
            sort,
          )}
          sort={sort}
          onSortChange={setSort}
          getRowId={(row) => row.key}
          empty={<EmptyState size="sm" live title={t.ack.emptyTitle} description={t.ack.empty} />}
        />
      )}
    </>
  );
};

const sortByAt = (rows: AckView[], sort: SortState | null): AckView[] => {
  if (sort?.key !== 'at') return rows;
  const sign = sort.direction === 'ascending' ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (a.at === null || b.at === null) return a.at === null ? (b.at === null ? 0 : 1) : -1;
    return sign * a.at.localeCompare(b.at);
  });
};

const ACK_STATES: readonly AckState[] = ['done', 'opened', 'pending'];

export interface AckStateChipsProps {
  rows: AckView[] | undefined;
  value: AckState | null;
  onChange: (value: AckState | null) => void;
}

/** 확인 현황 상태 라벨(#361) — 건수가 붙고, 다시 누르면 전체로 돌아간다. 0건 라벨은 고른 것이 아니면 감춘다. */
export const AckStateChips = ({ rows, value, onChange }: AckStateChipsProps) => {
  if (rows === undefined) return null;

  return (
    <div className="inspection-hub-counts" role="group" aria-label={t.ack.state}>
      {ACK_STATES.map((state) => {
        const isActive = value === state;
        const count = rows.filter((row) => row.state === state).length;
        if (count === 0 && !isActive) return null;

        return (
          <Chip
            key={state}
            variant="filter"
            size="sm"
            selected={isActive}
            aria-pressed={isActive}
            onSelectedChange={() => {
              onChange(isActive ? null : state);
            }}
          >
            {messages.common.inspectionHub.count(STATE_LABEL[state], count)}
          </Chip>
        );
      })}
    </div>
  );
};

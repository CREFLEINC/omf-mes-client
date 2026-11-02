import { Button, type Column, DatePicker, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { PageNav as ListPageNav, type PageNavMeta } from '../../patterns/page-nav';
import { ItemFilterField } from '../iqc-inspection/item-filter-field';
import { dispositionTypeLabel } from './disposition-codes';
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from './filters';
import type { HistoryFilters } from './history-filters';
import type { DispositionLookup } from './lookups';
import type { PageView } from './pagination';
import type { HistoryRow } from './types';

export interface HistoryFilterBarProps {
  applied: HistoryFilters;
  onApply: (filters: HistoryFilters) => void;
  onReset: () => void;
}

/**
 * 처분 이력 조회 조건 — 처분 대기 조회 조건과 같은 한 줄(사용자 지시 · #223).
 * 판정 시작일 · 종료일 · 품목, 오른쪽 끝에 조회 · 초기화. 기간은 비울 수 없다(L-3).
 * 처분 유형은 탭 줄 칩이 거른다(#223) — 처분 대기의 상태 칩과 같다.
 */
export const HistoryFilterBar = ({ applied, onApply, onReset }: HistoryFilterBarProps) => {
  const t = messages.dispositionDecision;
  const fromId = useId();
  const toId = useId();
  const [draft, setDraft] = useState<HistoryFilters>(applied);
  const { from, to, itemId, dispositionTypeCode } = applied;

  useEffect(() => {
    setDraft({ from, to, itemId, dispositionTypeCode });
  }, [from, to, itemId, dispositionTypeCode]);

  return (
    <div className="filter-bar disposition-filter disposition-history-filter">
      <div className="field-cell">
        <label className="field-label" htmlFor={fromId}>
          {t.fields.decidedFrom}
        </label>
        <DatePicker
          id={fromId}
          placeholder={messages.common.selectDate}
          max={draft.to === '' ? undefined : draft.to}
          value={draft.from === '' ? null : draft.from}
          onChange={(value) => setDraft((current) => ({ ...current, from: value ?? '' }))}
        />
      </div>
      <div className="field-cell">
        <label className="field-label" htmlFor={toId}>
          {t.fields.decidedTo}
        </label>
        <DatePicker
          id={toId}
          placeholder={messages.common.selectDate}
          min={draft.from === '' ? undefined : draft.from}
          value={draft.to === '' ? null : draft.to}
          onChange={(value) => setDraft((current) => ({ ...current, to: value ?? '' }))}
        />
      </div>
      <div className="field-cell">
        <ItemFilterField
          value={draft.itemId}
          onChange={(value) => setDraft((current) => ({ ...current, itemId: value }))}
        />
      </div>
      <div className="disposition-filter-actions">
        <div className="filter-actions">
          <Button onClick={() => onApply(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};

export interface HistoryListProps {
  rows: HistoryRow[];
  uoms: DispositionLookup;
  page: PageView;
  /** 표 아래 쪽 이동 줄 — 처분 대기 목록과 같은 모양(#223). */
  meta: PageNavMeta;
  isLoading: boolean;
  error: ReactNode;
  /** 고른 줄의 판정 번호. */
  selectedId: number | null;
  onSelect: (row: HistoryRow) => void;
  onChangePage: (page: number) => void;
  onChangeSize: (size: PageSizeOption) => void;
}

/**
 * 처분 이력 목록 — 처분 대기 목록과 같은 표(줄 누르기 선택 · 고른 줄 파란 바탕 · 열 순서 · 폭 남김 · 건수 10·20·50).
 * 한 줄이 판정 한 건이다 — 고르면 오른쪽에 그 부적합의 상세 · 판정 이력이 선다.
 */
export const HistoryList = ({
  rows,
  uoms,
  page,
  meta,
  isLoading,
  error,
  selectedId,
  onSelect,
  onChangePage,
  onChangeSize,
}: HistoryListProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<HistoryRow>[] = [
    {
      key: 'nonconformanceNo',
      align: 'center',
      width: '170px',
      header: t.fields.nonconformanceNo,
      /* 고르기는 줄 누르기가 맡는다 — 눌린 줄의 판정 번호를 이 칸에서 읽는다. */
      render: (row) => (
        <span
          className="disposition-nc-no"
          data-decision-id={row.dispositionDecisionId}
          data-selected={row.dispositionDecisionId === selectedId ? 'true' : undefined}
        >
          {row.nonconformanceNo}
        </span>
      ),
    },
    {
      key: 'dispositionTypeCode',
      align: 'center',
      header: t.fields.historyType,
      render: (row) => dispositionTypeLabel(row.dispositionTypeCode),
    },
    {
      key: 'qty',
      align: 'center',
      header: t.fields.historyQty,
      render: (row) => `${row.decisionQtyText} ${lookupDisplayLabel(uoms, row.uomId)}`,
    },
    {
      key: 'reason',
      align: 'center',
      header: t.fields.historyReason,
      render: (row) => row.reason,
    },
    {
      key: 'decidedAt',
      align: 'center',
      header: t.fields.decidedAt,
      render: (row) => row.decidedAtText,
    },
  ];

  const ordered = useColumnOrder('omf-mes:dispositions:columns:history:order', columns);
  const resizable = useColumnWidths('omf-mes:dispositions:columns:history', ordered);
  const fit = useFitColumns(resizable.columns, {});

  if (error !== null && error !== undefined) return error;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.historyLoading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const empty = page.isBeyondLast ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.beyondTitle}
      description={t.empty.beyondDescription}
      action={
        <Button variant="outlined" onClick={() => onChangePage(1)}>
          {t.actions.goFirstPage}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.historyTitle}
      description={t.empty.historyDescription}
    />
  );

  return (
    <div className="disposition-list">
      <div
        ref={fit.ref}
        className="disposition-table disposition-pending-table disposition-history-table inspection-queue-table"
        style={resizable.style}
        onClick={(event) => {
          const id = (event.target as Element)
            .closest('tbody tr')
            ?.querySelector<HTMLElement>('[data-decision-id]')?.dataset.decisionId;
          const row = rows.find((candidate) => String(candidate.dispositionDecisionId) === id);
          if (row !== undefined) onSelect(row);
        }}
      >
        <Table
          density="compact"
          caption={<span className="disposition-table-caption">{t.panes.history}</span>}
          columns={fit.columns}
          rows={rows}
          getRowId={(row) => String(row.dispositionDecisionId)}
          empty={empty}
        />
      </div>
      <ListPageNav
        meta={meta}
        sizes={PAGE_SIZE_OPTIONS}
        controlSize="sm"
        buttonSize="md"
        onChangePage={onChangePage}
        onChangeSize={onChangeSize}
      />
    </div>
  );
};

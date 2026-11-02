import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { PageNav as ListPageNav, type PageNavMeta } from '../../patterns/page-nav';
import { codeValueLabel } from './disposition-codes';
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from './filters';
import type { DispositionLookup } from './lookups';
import type { PageView } from './pagination';
import { dispositionProgressLabel, type NonconformanceRow } from './types';

export interface NonconformanceListProps {
  rows: NonconformanceRow[];
  items: DispositionLookup;
  /** 심각도·상태 열의 표시명(G-32). 모르는 코드는 코드 그대로 보인다(G-9). */
  severity: DispositionLookup;
  status: DispositionLookup;
  isLoading: boolean;
  error: ReactNode;
  page: PageView;
  /** 표 아래 쪽 이동 줄 — 다른 목록과 같은 「총 N건 · 처음 · 이전 · n/N · 다음 · 마지막」(#223). */
  meta: PageNavMeta;
  selectedId: number | null;
  onSelect: (nonconformanceId: number) => void;
  onChangePage: (page: number) => void;
  /** 한 쪽 건수 10 · 20 · 50(사용자 지시 · #223). */
  onChangeSize: (size: PageSizeOption) => void;
}

/**
 * ⭐ 「판정 진행」 열은 서버가 대상 수량 합과 결정 수량 합을 롤업해 낸 `dispositionProgressCode`를
 * 그대로 보인다 — `statusCode`의 「판정 대기」 한 값은 미판정·일부 판정을 가르지 못한다.
 * 근거: W-03-10 §4-A · omf-mes#253(회신 반영).
 */
export const NonconformanceList = ({
  rows,
  items,
  severity,
  status,
  isLoading,
  error,
  page,
  meta,
  selectedId,
  onSelect,
  onChangePage,
  onChangeSize,
}: NonconformanceListProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<NonconformanceRow>[] = [
    {
      key: 'nonconformanceNo',
      header: t.fields.nonconformanceNo,
      /* 번호는 글자다 — 고르기는 줄 누르기가 맡는다(사용자 지시 · #223). 고른 줄 표시는 이 칸의 `data-selected` 로 건다. */
      render: (row) => (
        <span
          className="disposition-nc-no"
          data-nc-id={row.nonconformanceId}
          data-selected={row.nonconformanceId === selectedId ? 'true' : undefined}
        >
          {row.nonconformanceNo}
        </span>
      ),
    },
    {
      key: 'item',
      header: t.fields.item,
      render: (row) => lookupDisplayLabel(items, row.itemId),
    },
    { key: 'qty', header: t.fields.qty, align: 'end', render: (row) => row.affectedQtyText },
    {
      key: 'dispositionProgress',
      header: t.fields.dispositionProgressCode,
      render: (row) => dispositionProgressLabel(row.dispositionProgressCode),
    },
    {
      key: 'severity',
      header: t.fields.severityCode,
      render: (row) => codeValueLabel(severity, row.severityCode),
    },
    { key: 'openedAt', header: t.fields.openedAt, render: (row) => row.openedAtText },
    {
      key: 'status',
      header: t.fields.statusCode,
      render: (row) => codeValueLabel(status, row.statusCode),
    },
  ];

  if (error !== null && error !== undefined) return error;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading}>
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
    <EmptyState size="sm" live title={t.empty.title} description={t.empty.description} />
  );

  return (
    <div className="disposition-list">
      {/*
       * ⭐ 여기 있던 「원천으로 거를 수 없다」 안내(A-11)를 걷었다 — **물러났던 것이 아니라
       * 되살아났다.** 축이 `sourceCode`로 정의돼 필터 바에 섰으므로(W-03-10 §5-4 · #648)
       * 그 자리에 남겨 두면 화면이 «있는 기능»을 없다고 말하게 된다.
       */}
      {/*
       * 줄을 누르면 고른다(#223) — DS 표에 줄 클릭이 없어 눌린 줄의 번호 칸에서 부적합을 읽는다.
       * 고른 줄을 다시 누르면 풀린다(`onSelect` 가 같은 번호면 선택을 지운다).
       */}
      <div
        className="disposition-table disposition-pending-table"
        onClick={(event) => {
          const id = (event.target as Element)
            .closest('tbody tr')
            ?.querySelector<HTMLElement>('[data-nc-id]')?.dataset.ncId;
          if (id !== undefined) onSelect(Number(id));
        }}
      >
        <Table
          density="compact"
          caption={<span className="disposition-table-caption">{t.panes.list}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.nonconformanceId)}
          empty={empty}
        />
      </div>
      <ListPageNav
        meta={meta}
        sizes={PAGE_SIZE_OPTIONS}
        controlSize="md"
        onChangePage={onChangePage}
        onChangeSize={onChangeSize}
      />
    </div>
  );
};

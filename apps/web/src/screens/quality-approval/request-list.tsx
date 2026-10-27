import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { approvalTypeLabelOf, statusBadgeOf } from './code-options';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { RequestRow } from './types';

export interface RequestListProps {
  rows: RequestRow[];
  isLoading: boolean;
  error: ReactNode;
  page: PageView;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onChangePage: (page: number) => void;
  /** 대상 열 이름 — 탭(승인 유형)에 맞춘다(#193). 주지 않으면 「대상 LOT」. */
  targetHeader?: string;
  /** 승인 유형 열 — 한 유형 탭(특채 · IQC 생략 · OQC 생략)은 탭이 이미 유형을 말해 두지 않는다(#193). 기본은 보인다. */
  showType?: boolean;
}

export const RequestList = ({
  rows,
  isLoading,
  error,
  page,
  selectedId,
  onSelect,
  onChangePage,
  targetHeader,
  showType = true,
}: RequestListProps) => {
  const t = messages.qualityApproval;
  const columns: Column<RequestRow>[] = [
    {
      key: 'request',
      header: t.fields.request,
      width: '140px',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.selectRow(row.approvalRequestNo)}
          aria-current={row.approvalRequestId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.approvalRequestId)}
        >
          {row.approvalRequestNo}
        </button>
      ),
    },
    /* 대상 LOT 은 폭을 정하지 않는다 — 남는 폭을 흡수한다(`patterns/column-resize.tsx`). */
    { key: 'target', header: targetHeader ?? t.fields.targetLot, render: (row) => row.targetName },
    /* 언제 상신됐는지 — 모든 탭 목록에 둔다(사용자 지시 2026-10-27 · #193). */
    {
      key: 'requestedAt',
      header: t.fields.requestedAt,
      width: '150px',
      align: 'center',
      render: (row) => row.requestedAtText,
    },
    /* 상태는 코드 대신 사용자 용어 배지로(#144) — 대기 주황 · 승인 초록 · 반려 빨강. */
    {
      key: 'status',
      header: t.fields.statusCode,
      width: '96px',
      align: 'center',
      render: (row) => (
        <Chip size="sm" status={statusBadgeOf(row.statusCode).tone}>
          {statusBadgeOf(row.statusCode).label}
        </Chip>
      ),
    },
    /* 승인 유형 꼬리표(#144) — 전체 탭에서만 둔다. 한 유형 탭은 탭이 유형을 말한다(사용자 지시 2026-10-27). */
    ...(showType
      ? [
          {
            key: 'type',
            header: t.fields.approvalTypeCode,
            width: '160px',
            align: 'center',
            render: (row: RequestRow) => (
              <Chip size="sm">{approvalTypeLabelOf(row.approvalTypeCode)}</Chip>
            ),
          } satisfies Column<RequestRow>,
        ]
      : []),
    /* 내 차례 꼬리표(#144) — 칸 가운데에 둔다(#186 사용자 지시). */
    {
      key: 'myTurn',
      header: t.fields.myTurn,
      width: '96px',
      align: 'center',
      render: (row) =>
        row.isMyTurn ? (
          <Chip size="sm" status="info">
            {t.values.myTurn}
          </Chip>
        ) : null,
    },
  ];
  /* 머리칸을 끌어 순서를 바꾸고, 오른쪽 끝을 끌어 폭을 바꾼다(#186) — 둘 다 이 브라우저에 남는다. */
  const ordered = useColumnOrder('omf-mes:quality-approvals:column-order', columns);
  const resizable = useColumnWidths('omf-mes:quality-approvals:columns', ordered);

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
    <div className="quality-approval-list">
      {/*
       * 줄 아무 곳이나 눌러도 고른다(#144, IQC #133 과 같은 방식) — DS 표에 줄 클릭이 없어 눌린 줄의 요청 단추로
       * 넘긴다. 키보드·화면 낭독기는 종전처럼 그 단추 하나로 고른다.
       */}
      <div
        className="quality-approval-table"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target.closest('tbody tr')?.querySelector<HTMLButtonElement>('.link-cell')?.click();
        }}
      >
        <Table
          density="compact"
          caption={<span className="quality-approval-table-caption">{t.panes.list}</span>}
          columns={resizable.columns}
          rows={rows}
          getRowId={(row) => String(row.approvalRequestId)}
          empty={empty}
        />
      </div>
      <PageNav view={page} onChange={onChangePage} />
    </div>
  );
};

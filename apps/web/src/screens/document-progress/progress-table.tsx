import { Button, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { BoardTable } from '../../patterns/board-table';
import { describeCancelBlockReason, readCancelAvailability } from './cancel-availability';
import type { CodeNameOf } from './queries';
import type { DocumentProgressView } from './types';

const t = messages.documentProgress;

export interface ProgressColumnsInput {
  statusName: CodeNameOf;
  subTypeName: CodeNameOf;
}

/**
 * 목록의 열 구성 — **여덟 개**다. 문서번호 열은 뺐다(사용자 지시 2026-11-19) — 고른 전표의 번호는 오른쪽
 * 머리가 말하고, 줄 고르기 단추의 접근 이름에 번호가 실린다.
 *
 * ⛔ **문서 유형 열이 없다.** 계약이 `documentTypeCode`를 목록 조회의 **필수** 질의값으로 두어
 * 한 응답의 모든 행이 같은 유형이다 — 지금 무슨 유형을 보고 있는지는 조건 줄의 선택칸이 말한다.
 *
 * ⭐ **후속 건수와 취소 가능이 열로 있는 것이 이 표의 요점이다.** 상세를 열어야 취소 가능 여부를
 * 알면 실무자가 목록에서 대상을 고르지 못한다(착수 이슈 §6). 둘 다 서버가 판정해 내려준 값이다.
 *
 * **정렬을 열지 않는다.** 계약의 이 조회에 정렬 파라미터가 없다(실측).
 *
 * 「선택」 열은 없다 — 입고 관리 표처럼 줄 어디를 눌러도 그 전표를 고르고 오른쪽에 상세가 나온다
 * (`BoardTable` 의 줄 고르기). 세부구분 · 상태 칸은 서버가 정하는 코드 이름이라 길면 말줄임된다.
 */
export const buildProgressColumns = ({
  statusName,
  subTypeName,
}: ProgressColumnsInput): Column<DocumentProgressView>[] => [
  { key: 'documentDate', header: t.table.documentDate, width: '104px' },
  {
    key: 'documentSubTypeCode',
    header: t.table.subType,
    width: '96px',
    /* 없이 오는 문서가 실재한다 — 빈 칸으로 두면 화면이 빠뜨린 것과 구분되지 않는다. */
    render: (row) =>
      row.documentSubTypeCode === null ? t.values.empty : subTypeName(row.documentSubTypeCode),
  },
  {
    key: 'statusCode',
    header: t.table.status,
    width: '88px',
    render: (row) => statusName(row.statusCode),
  },
  {
    key: 'plannedQty',
    header: t.table.plannedQty,
    width: '88px',
    align: 'end',
    render: (row) => String(row.plannedQty),
  },
  {
    key: 'processedQty',
    header: t.table.processedQty,
    width: '88px',
    align: 'end',
    render: (row) => String(row.processedQty),
  },
  {
    key: 'remainingQty',
    header: t.table.remainingQty,
    width: '88px',
    align: 'end',
    render: (row) => String(row.remainingQty),
  },
  {
    key: 'successorCount',
    header: t.table.successorCount,
    width: '56px',
    align: 'end',
    /* **서버가 센 값을 그대로 낸다.** 0도 그대로 낸다 — 0건은 정상이다. */
    render: (row) => String(row.successorCount),
  },
  {
    key: 'cancelAvailability',
    header: t.table.cancelAvailability,
    /*
     * 가능하면 「취소 요청 가능」, 막혔으면 사유 한 줄. 「취소 불가」를 따로 앞에 붙이지 않는다 — 사유가 곧
     * 불가의 뜻이다. 사유 코드가 문면을 갖지 않으면 코드 문자열 그대로다(`describeCancelBlockReason`).
     */
    render: (row) => {
      const availability = readCancelAvailability(row);

      return availability.kind === 'available'
        ? t.cancel.available
        : describeCancelBlockReason(availability);
    },
  },
];

export type ListEmptyReason = 'typesPending' | 'noDocumentType' | 'beyondLast' | 'noResult';

export interface EmptyReasonInput {
  /** 유형 표가 비어 주입된 예외 상태. */
  isTypeListPending: boolean;
  /** 조회가 성립했는가(문서 유형을 골랐는가). */
  hasDocumentType: boolean;
  /** 결과는 있는데 지금 쪽이 마지막 쪽 너머인가. */
  isBeyondLast: boolean;
}

/** 표가 비었을 때 **왜 비었는가** — 갈래마다 말이 다르다. */
export const readEmptyReason = ({
  isTypeListPending,
  hasDocumentType,
  isBeyondLast,
}: EmptyReasonInput): ListEmptyReason => {
  if (isTypeListPending) return 'typesPending';
  if (!hasDocumentType) return 'noDocumentType';

  return isBeyondLast ? 'beyondLast' : 'noResult';
};

export interface ProgressTableProps extends EmptyReasonInput, ProgressColumnsInput {
  rows: DocumentProgressView[];
  isLoading: boolean;
  onFirstPage: () => void;
  /** 지금 고른 전표. 그 줄의 바탕을 칠한다. */
  selectedDocumentId: number | null;
  /**
   * ⭐ **취소 요청 · 실행이 나가는 중인가** — 나가는 중에 다른 문서로 옮기면 앞 요청의 결과가 지금 보는
   * 맥락에 나타난다. 그동안은 줄을 눌러도 고르지 않는다.
   */
  isLocked: boolean;
  onSelect: (documentId: number) => void;
}

const rowIdOf = (row: DocumentProgressView): string =>
  `${row.documentTypeCode}:${String(row.documentId)}`;

/** 진행현황 목록 — 입고 관리 짜임의 표(`BoardTable`). */
export const ProgressTable = ({
  rows,
  isLoading,
  isTypeListPending,
  hasDocumentType,
  isBeyondLast,
  onFirstPage,
  selectedDocumentId,
  isLocked,
  onSelect,
  statusName,
  subTypeName,
}: ProgressTableProps) => {
  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.list}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const emptySlot = (): ReactNode => {
    switch (readEmptyReason({ isTypeListPending, hasDocumentType, isBeyondLast })) {
      case 'typesPending':
        return <EmptyState size="sm" title={t.empty.typesPendingTitle} />;
      case 'noDocumentType':
        return <EmptyState size="sm" title={t.empty.noDocumentTypeTitle} />;
      case 'beyondLast':
        return (
          <EmptyState
            size="sm"
            live
            title={t.empty.beyondLastTitle}
            action={
              <Button variant="outlined" onClick={onFirstPage}>
                {t.actions.goFirstPage}
              </Button>
            }
          />
        );
      case 'noResult':
        return <EmptyState size="sm" live title={t.empty.noResultTitle} />;
    }
  };

  const selectedRow = rows.find((row) => row.documentId === selectedDocumentId);

  return (
    <BoardTable
      label={t.panes.list}
      widthKey="omf-mes:document-progress:columns:list"
      fit
      columns={buildProgressColumns({ statusName, subTypeName })}
      rows={rows}
      /*
       * 유형까지 넣어 행 키를 만든다 — 유형을 바꿔 다시 조회하면 같은 번호의 다른 문서가 같은 키를 받아
       * 행이 재사용될 수 있다.
       */
      getRowId={rowIdOf}
      pick={{
        columnKey: 'documentDate',
        label: (row) => t.actions.selectRow(row.documentNo),
        currentId: selectedRow === undefined ? null : rowIdOf(selectedRow),
        onPick: (row) => {
          if (!isLocked) onSelect(row.documentId);
        },
      }}
      empty={emptySlot()}
    />
  );
};

import { Button, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
import { directionName, documentNoOf, interfaceName } from './message-labels';
import { formatDateTime, toStatusView } from './message-status';
import type { IntegrationMessageRow } from './types';

const t = messages.integrationSync;

export interface MessageTableProps {
  rows: IntegrationMessageRow[];
  isLoading: boolean;
  /** 기간이 갖춰져 실제로 조회한 상태인가. 빈 상태의 문구가 갈린다. */
  hasPeriod: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
  onOpenDetail: (id: number) => void;
  /** 오른쪽에 상세가 열린 메시지 — 그 줄을 칠한다(입고 관리의 고른 발주와 같다). */
  openedId?: number | null;
  onRetry: (row: IntegrationMessageRow) => void;
  /** 지금 재처리를 보내고 있는 건. 그 행의 버튼만 진행 중으로 보인다. */
  retryingId: number | null;
  /** 고른 행의 식별자. 디자인 시스템 `Table`의 선택은 제어형이다. */
  selectedIds: readonly string[];
  onSelectionChange: (nextIds: string[]) => void;
  /**
   * 상태 보조 문구의 기준 시각. 화면이 한 번 만들어 넘긴다 —
   * 셀마다 지금 시각을 만들면 같은 표 안에서 행마다 다른 기준으로 판정된다.
   */
  now: Date;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 연계 메시지 목록 표.
 *
 * 계약의 `IntegrationMessage`에는 필드가 14개 있으나 **자료 열은 일곱이다**(+ 재처리 열). 코드는 업무 이름으로
 * 옮겨 낸다(구분 · 항목 · 번호 · 상태 — `message-labels.ts`).
 * 전부 열로 만들면 표가 짓눌려 셀이 낱말 단위로 쪼개진다 —
 * 앞 화면에서 「표를 읽을 수 없다」로 보고된 결함이다. 나머지는 상세에서 본다.
 *
 * 정렬 열을 두지 않는다. 계약의 목록 쿼리에 **정렬 파라미터가 없어** 클라이언트 정렬은
 * 지금 쪽 안에서만 정렬되고, 사용자에게는 「정렬했는데 순서가 이상하다」로 나타난다.
 */
export const MessageTable = ({
  rows,
  isLoading,
  hasPeriod,
  isBeyondLast,
  onFirstPage,
  onOpenDetail,
  openedId = null,
  onRetry,
  retryingId,
  selectedIds,
  onSelectionChange,
  now,
}: MessageTableProps) => {
  const columns: Column<IntegrationMessageRow>[] = [
    /* 코드 대신 업무 이름(사용자 지시 2026-10-27) — `message-labels.ts`. */
    {
      key: 'directionCode',
      header: t.table.direction,
      width: '64px',
      render: (row) => directionName(row.directionCode),
    },
    {
      key: 'interfaceCode',
      header: t.table.interfaceCode,
      width: '112px',
      render: (row) => <OneLine text={interfaceName(row.interfaceCode)} />,
    },
    {
      key: 'messageKey',
      header: t.table.messageKey,
      width: '168px',
      /* 상세를 여는 단추 자리(`BoardTable` 의 `pick`) — 줄 어디를 눌러도 연다(체크 · 재처리 단추는 그쪽이 받는다). */
      render: (row) => <OneLine text={documentNoOf(row)} />,
    },
    {
      key: 'statusCode',
      header: t.table.status,
      width: '152px',
      render: (row) => {
        const view = toStatusView(row, now);

        return (
          <>
            <Chip variant="status" size="sm" status={view.tone}>
              {view.label}
            </Chip>
            {view.note !== null && <span className="field-note">{view.note}</span>}
          </>
        );
      },
    },
    { key: 'retryCount', header: t.table.retryCount, align: 'end', width: '64px' },
    {
      key: 'createdAt',
      header: t.table.createdAt,
      width: '148px',
      render: (row) => orEmptyMark(formatDateTime(row.createdAt)),
    },
    /* 폭을 지정하지 않는 유일한 열이다 — 남는 폭을 이 열이 가져간다. */
    {
      key: 'lastErrorMessage',
      header: t.table.lastErrorMessage,
      render: (row) => <OneLine text={row.lastErrorMessage ?? t.values.empty} />,
    },
    {
      key: 'retry',
      header: t.table.retry,
      width: '88px',
      /*
       * **상태 코드로도 `lockedBy`로도 막지 않는다.** 실서버의 상태 어휘를 화면이 모르므로
       * 「실패일 때만」으로 막으면 어휘가 다른 서버에서 버튼이 전부 죽는다. 화면의 자료는 낡기도 한다.
       * 계약이 두 실패(400 NOT_RETRYABLE · 409 workerLease)를 정의했고, 판정은 서버 몫이다.
       * 막지 않는 대신 상태 열의 보조 한 줄이 「처리 중」을 미리 알린다.
       */
      render: (row) => (
        <Button
          variant="outlined"
          size="sm"
          loading={retryingId === row.integrationMessageId}
          aria-label={t.actions.retryRow(row.messageKey)}
          onClick={() => {
            onRetry(row);
          }}
        >
          {t.actions.retry}
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.messages}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /** 조회 전 → 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 셋은 사용자가 할 조치가 서로 다르다. */
  const emptySlot = (): ReactNode => {
    if (!hasPeriod) {
      return <EmptyState size="sm" title={t.empty.noPeriodTitle} />;
    }

    if (isBeyondLast) {
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
    }

    return <EmptyState size="sm" live title={t.empty.noResultTitle} />;
  };

  /* 입고 관리와 같은 표 — 열 폭 끌기 · 줄 어디를 눌러도 상세 · 연 줄 칠하기(`patterns/board-table.tsx`). */
  return (
    <BoardTable
      label={t.panes.list}
      widthKey="omf-mes:integration-sync:columns:messages"
      minWidth="60rem"
      columns={columns}
      rows={rows}
      /*
       * 반드시 준다. 미지정이면 인덱스가 식별자가 되어 쪽이 바뀔 때
       * 엉뚱한 건이 선택된 것처럼 보인다.
       */
      getRowId={(row) => String(row.integrationMessageId)}
      pick={{
        columnKey: 'messageKey',
        // 접근 이름에 메시지 키를 넣는다 — 「상세 열기」가 행마다 되풀이되면 어느 건인지 알 수 없다.
        label: (row) => t.detail.openAction(row.messageKey),
        currentId: openedId === null ? null : String(openedId),
        onPick: (row) => {
          onOpenDetail(row.integrationMessageId);
        },
      }}
      /*
       * 화면이 선택을 거르지 않는다. 「재처리 가능한 것만 남기게」 걸러 보면
       * 머리글 체크박스가 절대 완전히 체크되지 않아 토글이 먹지 않는 것처럼 보이고,
       * 무엇이 재처리 가능한지는 화면이 판정할 수도 없다. 서버가 건별로 판정한다.
       */
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      empty={emptySlot()}
    />
  );
};
